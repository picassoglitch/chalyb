// Legal change notices (aceptacion-ux §8), 7a review of #49: a dispatch is
// claimed 'pending', taken over only when failed or stale, and is 'sent'
// only with a provider id; the version takes effect only once every
// eligible person got the notice ≥ 30 days earlier. Recipient selection is
// tested against Postgres in scripts/test-migrations.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchStatusAfterSend, STALE_PENDING_MS } from '@/lib/legal/notice-dispatch';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('H2 · "sent" only with a provider id; anything else is failed and retried', () => {
  assert.deepEqual(dispatchStatusAfterSend({ ok: true, id: 'msg_1' }), {
    delivery_status: 'sent',
    provider_message_id: 'msg_1',
  });
  assert.deepEqual(dispatchStatusAfterSend({ ok: true }), {
    delivery_status: 'failed',
    provider_message_id: null,
  });
  assert.deepEqual(dispatchStatusAfterSend({ ok: false, id: 'x' }), {
    delivery_status: 'failed',
    provider_message_id: null,
  });
});

test('H2 · claim inserts pending, takes over only failed or >10 min pending, through one conditional UPDATE', () => {
  const src = read('src/lib/legal/notice-dispatch.ts');
  // The claim is one SQL statement since 0060 (claim_notice_dispatch):
  // insert pending, or retake failed / > 10-minute pending, atomically.
  assert.match(src, /db\.rpc\('claim_notice_dispatch'/);
  const sql = read('supabase/migrations/0060_legal_retention_v2.sql');
  assert.match(sql, /'pending', now\(\), 1, now\(\)\)\s*on conflict \(user_id, kind, period_key\) do nothing/);
  assert.match(sql, /delivery_status = 'pending' and sent_at < now\(\) - interval '10 minutes'/);
  assert.equal(STALE_PENDING_MS, 600_000);
  // finish only moves a row this run still holds as pending.
  assert.match(src, /\.eq\('id', id\)\.eq\('delivery_status', 'pending'\)/);
  const runner = read('src/lib/legal/legal-server.ts');
  assert.match(runner, /claimNoticeDispatch\(db,/);
  assert.match(runner, /finishNoticeDispatch\(db, claimed, res\)/);
  assert.doesNotMatch(
    runner,
    /delivery_status: res\.ok \? 'sent'/,
    'the old optimistic write is gone',
  );
});

import {
  inForceFrom,
  noticeIsLate,
  personNoticed,
  termsChangeDecision,
} from '@/lib/legal/terms-change';
import { termsPrompt } from '@/lib/legal/reaccept';
import { noticeRequired } from '@/lib/legal/registry';

const DAY = 86_400_000;
const meta = (
  o: Partial<{
    published: boolean;
    effective: string | null;
    relevance: 'relevant' | 'minor';
  }> = {},
) => ({
  published: true,
  effective: '2026-12-01T06:00:00.000Z',
  relevance: 'relevant' as const,
  changes: ['Cambia el plazo de cancelación'],
  ...o,
});

test('H1 · the cron keeps sending until every notice is out; the first version sends nothing', () => {
  const d = (o: Partial<Parameters<typeof termsChangeDecision>[0]> = {}) =>
    termsChangeDecision({
      published: true,
      meta: meta(),
      noticeRequired: true,
      completeAt: null,
      ...o,
    });
  assert.equal(d(), 'send');
  assert.equal(d({ completeAt: '2026-10-20T00:00:00Z' }), 'complete');
  assert.equal(d({ noticeRequired: false }), 'none', 'v1.0: no earlier version to change');
  assert.equal(d({ meta: meta({ relevance: 'minor' }) }), 'none');
  assert.equal(d({ published: false }), 'none');
  assert.equal(noticeRequired('terminos', '1.0'), false, 'today: no earlier published version');
});

test('H1 · a version applies from the later of its date and the last notice + 30 days', () => {
  assert.equal(
    inForceFrom(meta(), { noticeRequired: true, completeAt: null }),
    null,
    'notices still owed',
  );
  assert.equal(
    inForceFrom(meta(), { noticeRequired: true, completeAt: '2026-10-01T00:00:00.000Z' }),
    '2026-12-01T06:00:00.000Z',
    'finished in time: the registry date',
  );
  assert.equal(
    inForceFrom(meta(), { noticeRequired: true, completeAt: '2026-11-20T00:00:00.000Z' }),
    '2026-12-20T00:00:00.000Z',
    'a run died and finished late: the date moves',
  );
  assert.equal(
    inForceFrom(meta(), { noticeRequired: false, completeAt: null }),
    '2026-12-01T06:00:00.000Z',
  );
  assert.equal(noticeIsLate(meta(), new Date('2026-11-15T00:00:00Z'), 3), true);
  assert.equal(
    noticeIsLate(meta(), new Date('2026-11-15T00:00:00Z'), 0),
    false,
    'too_late only while people are owed',
  );
  assert.equal(noticeIsLate(meta(), new Date('2026-10-01T00:00:00Z'), 3), false);
});

test('H1 · nobody is asked to accept without a successful notice ≥ 30 days before', () => {
  const at = '2026-12-01T06:00:00.000Z';
  assert.equal(
    personNoticed({ delivery_status: 'sent', sent_at: '2026-10-15T00:00:00Z' }, at),
    true,
  );
  assert.equal(
    personNoticed({ delivery_status: 'delivered', sent_at: '2026-11-01T06:00:00Z' }, at),
    true,
    'exactly 30 days',
  );
  assert.equal(
    personNoticed({ delivery_status: 'sent', sent_at: '2026-11-10T00:00:00Z' }, at),
    false,
    'less than 30 days',
  );
  for (const st of ['pending', 'failed', 'bounced']) {
    assert.equal(
      personNoticed({ delivery_status: st, sent_at: '2026-10-01T00:00:00Z' }, at),
      false,
      st,
    );
  }
  assert.equal(personNoticed(null, at), false);
  const base = {
    published: true,
    current: '1.1',
    meta: meta(),
    history: { acceptedVersion: '1.0', noticeShown: [] },
    now: new Date(Date.parse(at) + DAY),
  };
  assert.equal(termsPrompt({ ...base, inForceAt: at, noticed: true }), 'modal');
  assert.equal(
    termsPrompt({ ...base, inForceAt: at, noticed: false }),
    'none',
    'not noticed: never asked',
  );
  assert.equal(
    termsPrompt({ ...base, inForceAt: null, noticed: true }),
    'none',
    'notices still owed: not in force',
  );
  assert.equal(
    termsPrompt({ ...base, inForceAt: '2026-12-20T00:00:00.000Z', noticed: true }),
    'none',
    'moved date not reached',
  );
});

test('H1 · the prompt and the cron read the notice state; the dashboard shows it', () => {
  const srv = read('src/lib/legal/reaccept-server.ts');
  assert.match(srv, /inForceFrom\(meta, \{ noticeRequired: required, completeAt \}\)/);
  assert.match(srv, /personNoticed\(mine, inForceAt\)/);
  const cron = read('src/lib/legal/legal-server.ts');
  assert.match(cron, /if \(remaining === 0 && report\.failed === 0\)/);
  assert.match(cron, /\.is\('complete_at', null\)/);
  assert.match(
    read('src/app/[locale]/(dashboard)/dashboard/(admin)/legal/page.tsx'),
    /legal_change_notices/,
  );
});

import { effectiveInstant } from '@/lib/legal/registry';

test('LOW · a date-only effective date is 00:00 in Mexico City, not UTC', () => {
  assert.equal(effectiveInstant('2026-12-01'), '2026-12-01T06:00:00.000Z');
  assert.equal(effectiveInstant('2026-12-01T00:00:00-06:00'), '2026-12-01T06:00:00.000Z');
  assert.equal(effectiveInstant('2026-12-01T12:00:00Z'), '2026-12-01T12:00:00.000Z');
  assert.equal(effectiveInstant('mañana'), null);
  assert.equal(effectiveInstant(null), null);
});

test('H1 gaps · undeliverable after 5 tries / 72 h; pending counts as owed; email and pages use the real date', () => {
  const nd = read('src/lib/legal/notice-dispatch.ts');
  assert.match(nd, /db\.rpc\('claim_notice_dispatch'/);
  const sql = read('supabase/migrations/0060_legal_retention_v2.sql');
  assert.match(sql, /set delivery_status = 'undeliverable'/);
  assert.match(sql, /'sent', 'delivered', 'bounced', 'undeliverable'/);
  const s = read('src/lib/legal/legal-server.ts');
  assert.match(
    s,
    /\.eq\('delivery_status', 'pending'\);\s*const remaining = \(\(left \?\? \[\]\) as unknown\[\]\)\.length \+ \(inFlight \?\? 0\);/,
  );
  assert.match(
    s,
    /Math\.max\(\s*Date\.parse\(meta\.effective\),\s*now\.getTime\(\) \+ TERMS_CHANGE_NOTICE_DAYS \* 86_400_000/,
  );
  assert.match(
    read('src/components/legal/legal-doc-page.tsx'),
    /await versionInForceAt\(doc, version\)/,
  );
  assert.match(
    read('src/components/legal/legal-changes-page.tsx'),
    /await versionInForceAt\(doc, version\)/,
  );
  assert.match(
    read('src/app/[locale]/(dashboard)/dashboard/(admin)/legal/page.tsx'),
    /\.in\('delivery_status', \['bounced', 'undeliverable'\]\)/,
  );
});

test('LOW · no publishing while terms are pending; disputes triage needs a provider-confirmed notice', () => {
  assert.match(
    read('src/app/api/tools/consent/route.ts'),
    /if \(await termsAcceptancePending\(session\.user\.id\)\)\s*return NextResponse\.json\(\{ ok: false, code: 'TERMS_PENDING' \}/,
  );
  const d = read('src/lib/billing/disputes-server.ts');
  assert.match(
    d,
    /\(n\.delivery_status === 'sent' \|\| n\.delivery_status === 'delivered'\) && !!n\.provider_message_id/,
  );
  assert.match(d, /\(notices \?\? \[\]\)\.find\(\(n\) => noticeWasSent\(n\)\)/);
});
