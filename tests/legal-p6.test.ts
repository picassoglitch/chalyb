// Old P6 leftovers: ARCO requests (Aviso de privacidad §5), copyright
// notice-and-takedown with re-upload blocking and repeat infringers (Uso
// aceptable §5), the ≥30-day change email (aceptacion-ux §8) and the
// retention cron. The 72-month purge itself is tested against Postgres in
// scripts/test-migrations.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arcoDueSoon, arcoEffectiveBy, arcoError, arcoRespondBy } from '@/lib/legal/arco';
import {
  contentFingerprint,
  counterNoticeOutcome,
  isRepeatInfringer,
  normalizeContentUrl,
  strikeCount,
  takedownMissing,
  takedownTooLong,
} from '@/lib/legal/takedown';
import { termsChangeEmail } from '@/lib/legal/terms-change';
import { attentionItems } from '@/lib/admin/attention';
import { CLIP_FAILURE_REASONS } from '@/lib/tools/adapters/types';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DAY = 86_400_000;

// ── ARCO ───────────────────────────────────────────────────────────────

test('ARCO: a right from §5.1, a description, and the correct value for a rectification', () => {
  assert.equal(arcoError({ right: 'access', description: 'Qué datos tienen de mí' }), null);
  assert.equal(arcoError({ right: 'automated', description: 'Me negaron la prueba' }), null);
  assert.equal(arcoError({ right: 'delete-everything', description: 'x' }), 'right');
  assert.equal(arcoError({ right: 'access', description: '   ' }), 'description');
  assert.equal(arcoError({ right: 'rectification', description: 'Mi nombre' }), 'correctValue');
  assert.equal(
    arcoError({ right: 'rectification', description: 'Mi nombre', correctValue: 'Ana' }),
    null,
  );
  assert.equal(arcoError({ right: 'access', description: 'x'.repeat(4001) }), 'tooLong');
});

test('ARCO: 20 days to answer (40 once extended), then 15 to carry it out (§5.3)', () => {
  const t0 = new Date('2026-10-03T12:00:00Z');
  assert.equal(arcoRespondBy(t0).toISOString(), '2026-10-23T12:00:00.000Z');
  assert.equal(arcoRespondBy(t0, true).toISOString(), '2026-11-12T12:00:00.000Z');
  assert.equal(arcoEffectiveBy(t0).toISOString(), '2026-10-18T12:00:00.000Z');
  const rows = [
    { respond_by: new Date(t0.getTime() + 2 * DAY).toISOString(), responded_at: null },
    { respond_by: new Date(t0.getTime() - DAY).toISOString(), responded_at: null },
    { respond_by: new Date(t0.getTime() + 10 * DAY).toISOString(), responded_at: null },
    { respond_by: new Date(t0.getTime() + DAY).toISOString(), responded_at: t0.toISOString() },
  ];
  assert.equal(arcoDueSoon(rows, t0), 2, 'due within 5 days or overdue, unanswered');
});

test('ARCO: Mi cuenta links the form, which stores the request and logs arco_request_received', () => {
  assert.match(
    read('src/app/[locale]/(dashboard)/app/settings/page.tsx'),
    /title=\{t\('privacy\.arco'\)\}\s*href="\/app\/settings\/arco"/,
  );
  assert.ok(existsSync(join(ROOT, 'src/app/[locale]/(dashboard)/app/settings/arco/page.tsx')));
  const server = read('src/lib/legal/legal-server.ts');
  assert.match(server, /event_type: 'arco_request_received'/);
  assert.match(server, /from\('arco_requests'\)\s*\.insert/);
});

// ── Takedown ───────────────────────────────────────────────────────────

const notice = {
  claimantName: 'Disquera Y',
  claimantContact: 'legal@disquera.example',
  contentIdentification: 'El clip con la canción X',
  rightStatement: 'Titular de los derechos de la grabación',
  contentLocation: 'https://youtu.be/abc123',
};

test('takedown: the four minimum fields of §5.1 are required, the optional ones never', () => {
  assert.deepEqual(takedownMissing(notice), []);
  assert.deepEqual(takedownMissing({ ...notice, claimantName: ' ', contentLocation: '' }), [
    'claimantName',
    'contentLocation',
  ]);
  assert.deepEqual(
    takedownMissing({
      ...notice,
      workDescription: '',
      ownershipEvidence: '',
      declaredTruthful: false,
    }),
    [],
  );
  assert.equal(takedownTooLong({ ...notice, contentLocation: 'x'.repeat(2001) }), true);
});

test('takedown: one fingerprint per video however the link is written (§5.2.3)', () => {
  const same = [
    'https://youtu.be/abc123',
    'https://www.youtube.com/watch?v=abc123&utm_source=x',
    'https://m.youtube.com/watch?si=zz&v=abc123',
    'https://youtube.com/shorts/abc123',
    'https://www.youtube.com/live/abc123?feature=share',
  ];
  const fps = new Set(same.map(contentFingerprint));
  assert.equal(fps.size, 1);
  assert.equal(normalizeContentUrl(same[1]!), 'youtube.com/watch?v=abc123');
  assert.notEqual(contentFingerprint('https://youtu.be/other'), contentFingerprint(same[0]!));
  assert.equal(
    normalizeContentUrl('https://www.twitch.tv/videos/123/?t=10'),
    'twitch.tv/videos/123',
  );
  assert.equal(contentFingerprint('no es un enlace'), null);
  assert.equal(contentFingerprint('javascript:alert(1)'), null);
});

test('takedown: a removed source is refused before the engine sees it', () => {
  assert.ok((CLIP_FAILURE_REASONS as readonly string[]).includes('content_blocked'));
  assert.match(
    read('src/lib/tools/clips-jobs.ts'),
    /if \(await isContentBlocked\(input\.sourceUrl\)\)[\s\S]{0,80}content_blocked/,
  );
  assert.match(read('src/components/app/clips/clip-error.tsx'), /case 'content_blocked':/);
});

test('takedown: repeat infringers at 3 upheld removals in 12 months (§5.4 example)', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  const at = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  const history = [
    { status: 'removed', removed_at: at(10) },
    { status: 'upheld', removed_at: at(100) },
    { status: 'restored', removed_at: at(50) }, // counter-notice won
    { status: 'removed', removed_at: at(400) }, // outside the window
    { status: 'rejected', removed_at: null },
  ];
  assert.equal(strikeCount(history, now), 2);
  assert.equal(isRepeatInfringer(2), false);
  assert.equal(strikeCount([...history, { status: 'counter_noticed', removed_at: at(5) }], now), 3);
  assert.equal(isRepeatInfringer(3), true);
});

test('takedown: a counter-notice restores after 15 business days unless the claimant shows a proceeding', () => {
  const deadline = '2026-10-24T05:59:59.999Z';
  const n = {
    status: 'counter_noticed',
    claimant_deadline: deadline,
    claimant_proceeding_at: null,
  };
  assert.equal(counterNoticeOutcome(n, new Date('2026-10-20T00:00:00Z')), 'wait');
  assert.equal(counterNoticeOutcome(n, new Date('2026-10-25T00:00:00Z')), 'restore');
  assert.equal(
    counterNoticeOutcome(
      { ...n, claimant_proceeding_at: '2026-10-21T00:00:00Z' },
      new Date('2026-10-25T00:00:00Z'),
    ),
    'upheld',
  );
  assert.equal(counterNoticeOutcome({ ...n, status: 'removed' }, new Date()), null);
  assert.match(
    read('src/lib/legal/legal-server.ts'),
    /addMxBusinessDays\(now, COUNTER_NOTICE_BUSINESS_DAYS\)/,
  );
});

test('takedown: the public form is at /derechos-de-autor (Uso aceptable §5.1)', () => {
  assert.ok(existsSync(join(ROOT, 'src/app/[locale]/derechos-de-autor/page.tsx')));
  assert.ok(existsSync(join(ROOT, 'src/app/api/legal/takedown/route.ts')));
  const route = read('src/app/api/legal/takedown/route.ts');
  assert.doesNotMatch(route, /getSessionUser/, 'no sign-in: claimants rarely have an account');
});

// ── Change email (aceptacion-ux §8) ────────────────────────────────────

test('change email: date, changes, links, cancel; escaped; a service notice, no marketing', () => {
  const m = termsChangeEmail({
    doc: 'suscripcion',
    nombre: 'Ana <b>',
    fecha: '1 de diciembre de 2026',
    changes: ['Cambia <script>x</script>', 'dos', 'tres', 'cuatro'],
    changesUrl: 'https://www.chalyb.com/legal/subscription/changes/v1-1',
    docUrl: 'https://www.chalyb.com/legal/subscription/v1-1',
    cancelUrl: 'https://www.chalyb.com/app/billing?cancelar=1',
  });
  assert.equal(
    m.subject,
    'Cambios en los Términos de Suscripción de Chalyb a partir del 1 de diciembre de 2026',
  );
  assert.match(m.html, /Ana &lt;b&gt;/);
  assert.doesNotMatch(m.html, /<script>/);
  assert.match(m.text, /• tres/);
  assert.doesNotMatch(m.text, /cuatro/, 'at most three lines');
  assert.match(m.text, /cancelar tu plan sin costo/);
  assert.match(m.text, /changes\/v1-1/);
  assert.doesNotMatch(m.text, /promoci|oferta|descuento/i);
  const priv = termsChangeEmail({
    doc: 'privacidad',
    nombre: 'A',
    fecha: 'f',
    changes: [],
    changesUrl: 'u',
    docUrl: 'd',
    cancelUrl: 'c',
  });
  assert.match(priv.subject, /^Cambios en el Aviso de privacidad de Chalyb/);
});

test('cron: /api/cron/legal is daily, behind CRON_SECRET, and runs all three steps', () => {
  const vercel = JSON.parse(read('vercel.json')) as { crons: { path: string; schedule: string }[] };
  const c = vercel.crons.find((x) => x.path === '/api/cron/legal');
  assert.ok(c && /^\d+ \d+ \* \* \*$/.test(c.schedule), 'daily');
  const route = read('src/app/api/cron/legal/route.ts');
  assert.match(route, /Bearer \$\{secret\}/);
  for (const step of ['runTermsChangeNotices', 'runCounterNoticeRestores', 'runRetention'])
    assert.match(route, new RegExp(step));
  assert.doesNotMatch(
    read('src/app/api/cron/billing/route.ts'),
    /runRetention|runTermsChangeNotices/,
  );
  assert.match(read('src/lib/legal/legal-server.ts'), /rpc\('legal_retention_purge'/);
});

test('admin: ARCO deadlines and open notices are "Necesita tu atención" items → /dashboard/legal', () => {
  const items = attentionItems({
    failedCharges: 0,
    refundRequests: 0,
    slowTools: 0,
    newIdeas: 0,
    bouncedNotices: 0,
    chargesWithoutNotice: 0,
    arcoDue: 1,
    takedownsOpen: 2,
  });
  assert.deepEqual(
    items.map((i) => [i.key, i.n, i.href]),
    [
      ['arcoDue', 1, '/dashboard/legal'],
      ['takedownsOpen', 2, '/dashboard/legal'],
    ],
  );
  assert.ok(
    existsSync(join(ROOT, 'src/app/[locale]/(dashboard)/dashboard/(admin)/legal/page.tsx')),
  );
  assert.match(
    read('src/app/api/admin/legal/route.ts'),
    /const actor = await adminSession\(\);\s*if \(!actor\)/,
  );
});

// ── #49 review: ARCO answers, guards, evidence ─────────────────────────

import { arcoAnswerEmail, ARCO_DAILY_LIMIT } from '@/lib/legal/arco';

test('MED 7 · an ARCO answer is emailed (outcome, date), notified in-app, kept as a dispatch, shown on the page', () => {
  const m = arcoAnswerEmail({
    folio: 'ab12cd34',
    right: 'cancellation',
    outcome: 'granted',
    effectiveBy: '18 de octubre de 2026',
  });
  assert.match(m.subject, /folio ab12cd34/);
  assert.match(m.text, /Resultado: Procede\./);
  assert.match(m.text, /a más tardar el 18 de octubre de 2026/);
  const inc = arcoAnswerEmail({
    folio: 'x',
    right: 'access',
    outcome: 'incomplete',
    effectiveBy: null,
  });
  assert.match(inc.text, /Nos falta información/);
  assert.doesNotMatch(inc.text, /efectiva/);
  const s = read('src/lib/legal/legal-server.ts');
  assert.match(s, /kind: 'arco_answer',\s*periodKey: `arco:\$\{id\}`/);
  assert.match(s, /kind: 'arcoAnswered'/);
  assert.match(read('src/app/[locale]/(dashboard)/app/settings/arco/page.tsx'), /t\('effectiveBy'/);
});

test('LOW · ARCO: extension only once and before the deadline; daily limit; no free text in the evidence', () => {
  const s = read('src/lib/legal/legal-server.ts');
  assert.match(
    s,
    /\.is\('responded_at', null\)\s*\.is\('extended_at', null\)\s*\.gte\('respond_by', now\.toISOString\(\)\)/,
  );
  assert.equal(ARCO_DAILY_LIMIT, 5);
  assert.match(s, /p_ip: `arco:\$\{session\.user\.id\}`/);
  assert.match(
    s,
    /disclosure_text: `Solicitud ARCO \(\$\{input\.right\}\) · folio \$\{String\(data\.id\)\}`/,
  );
  assert.doesNotMatch(s, /disclosure_text: disclosure/);
});
