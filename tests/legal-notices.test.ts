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
  assert.match(src, /delivery_status: 'pending',\s*sent_at:/);
  assert.match(
    src,
    /\.or\(`delivery_status\.eq\.failed,and\(delivery_status\.eq\.pending,sent_at\.lt\.\$\{stale\}\)`\)\s*\.select\('id'\)\s*\.maybeSingle\(\)/,
  );
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
