// WS-3 · 7-day Pro trial (Law: PRICING-2026-10-03-REVISION "What the P5 test
// suite should check" 1–11; PRICING-CARDS-SPEC §16.12).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICING, assertReminderWindows, planHasTrial } from '@/config/pricing';
import { BILLING_CRON_UTC_HOUR, trialDates } from '@/lib/billing/trial-dates';
import { dueNotices, holdDecision, trialNoticeKey } from '@/lib/billing/reminders';
import { billingEmail } from '@/lib/email/billing-templates';
import { initialTrialPlan } from '@/lib/billing/trial-choice';
import { changeTiming } from '@/lib/billing/plan-change';
import { paidPlansBlocked } from '@/lib/billing/quebec';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DAY = 86_400_000;
const START = new Date('2026-10-03T18:00:00Z');
const CHARGE = new Date(START.getTime() + 7 * DAY);
const H = 3_600_000;

// ── Config (1–4) ───────────────────────────────────────────────────────────

test('1–2 · 7 days, on whichever plan a first-time customer picks (owner, 2026-10-03)', () => {
  assert.equal(PRICING.trial.days, 7);
  assert.equal(planHasTrial('pro_month'), true);
  assert.equal(planHasTrial('pro_year'), true);
  assert.equal(planHasTrial('vip_month'), true);
  assert.deepEqual([...PRICING.trial.plans], ['pro_month', 'pro_year', 'vip_month']);
});

test('3 · the notice goes out ≥ 5 days before the charge; a 3-day trial can never ship', () => {
  assert.equal(PRICING.trial.reminderDaysBefore, 5);
  assert.doesNotThrow(() => assertReminderWindows());
  assert.throws(() =>
    assertReminderWindows({
      ...PRICING,
      trial: { ...PRICING.trial, days: 3, reminderDaysBefore: 3 },
    }),
  );
  assert.throws(() =>
    assertReminderWindows({
      ...PRICING,
      trial: { ...PRICING.trial, days: 7, reminderDaysBefore: 8 },
    }),
  );
});

test('4 · renewal windows unchanged and ≥ 5 days', () => {
  assert.equal(PRICING.reminders.monthDaysBefore, 7);
  assert.deepEqual([...PRICING.reminders.yearDaysBefore], [30, 7]);
});

// ── Dates and notices (5–7) ────────────────────────────────────────────────

const NOTICE = new Date('2026-10-05T15:00:00Z'); // the last cron run ≥ 5 d (+1 h) before

test('5 · trialDates: end = charge = start + 7 d; notice at the last cron run ≥ 5 d before (3 oct → 5 oct → 10 oct 2026)', () => {
  const d = trialDates(START);
  assert.equal(d.trialEndsAt.toISOString(), CHARGE.toISOString());
  assert.equal(d.chargeAt.toISOString(), CHARGE.toISOString());
  assert.equal(d.reminderAt.toISOString(), NOTICE.toISOString());
  assert.equal(d.chargeAt.toISOString().slice(0, 10), '2026-10-10');
  // Whatever the signup hour: between 5 and ~6 days ahead, at a cron run, after signup.
  for (const h of [0, 6, 14, 15, 16, 23]) {
    const start = new Date(Date.UTC(2026, 9, 1, h, 30));
    const { trialEndsAt, reminderAt } = trialDates(start);
    const lead = trialEndsAt.getTime() - reminderAt.getTime();
    assert.ok(lead >= 5 * DAY && lead < 6 * DAY + 2 * H, `signup ${h}:30 → lead ${lead / H}h`);
    assert.equal(reminderAt.getUTCHours(), BILLING_CRON_UTC_HOUR);
    assert.ok(reminderAt > start);
  }
  const cron = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')).crons.find(
    (c: { path: string }) => c.path === '/api/cron/billing',
  );
  assert.equal(cron.schedule, `0 ${BILLING_CRON_UTC_HOUR} * * *`);
});

const trialing = {
  state: 'trialing',
  interval: 'month' as const,
  nextChargeAt: CHARGE.toISOString(),
  startedAt: START.toISOString(),
  day6Enabled: false,
  subKey: 'pre-1',
};

test('6 · the mandatory trial_7d is due at the notice run (not at signup); trial_1d only with the flag, at charge − 1 d', () => {
  assert.deepEqual(dueNotices(trialing, START), []);
  assert.deepEqual(dueNotices(trialing, new Date(NOTICE.getTime() - 1)), []);
  const now = dueNotices(trialing, NOTICE);
  assert.deepEqual(
    now.map((n) => [n.kind, n.mandatory, n.dueAt.toISOString()]),
    [['trial_7d', true, NOTICE.toISOString()]],
  );
  // A trial keeps the notice date it was shown at signup (reminder_due_at).
  const promised = new Date(START.getTime() + DAY).toISOString();
  assert.equal(
    dueNotices({ ...trialing, trialReminderDueAt: promised }, new Date(promised))[0]?.kind,
    'trial_7d',
  );
  // Delivered at that run: no bounce hold on the charge.
  assert.deepEqual(
    holdDecision({
      nextChargeAt: CHARGE.toISOString(),
      noticeDeliveredAt: new Date(NOTICE.getTime() + 5 * 60_000).toISOString(),
      holdUntil: null,
      now: new Date(CHARGE.getTime() - DAY),
    }),
    { action: 'none' },
  );
  assert.equal(now[0]!.periodKey, trialNoticeKey(CHARGE, 'pre-1'));
  const dayBefore = new Date(CHARGE.getTime() - DAY);
  assert.deepEqual(
    dueNotices(trialing, dayBefore).map((n) => n.kind),
    ['trial_7d'],
  );
  assert.deepEqual(
    dueNotices({ ...trialing, day6Enabled: true }, dayBefore).map((n) => n.kind),
    ['trial_7d', 'trial_1d'],
  );
  assert.deepEqual(
    dueNotices({ ...trialing, day6Enabled: true }, new Date(dayBefore.getTime() - H)).map(
      (n) => n.kind,
    ),
    ['trial_7d'],
  );
});

test('6 · a trial switched to the other Pro plan gets its own notice key', () => {
  assert.notEqual(trialNoticeKey(CHARGE, 'pre-1'), trialNoticeKey(CHARGE, 'pre-2'));
  assert.equal(trialNoticeKey(CHARGE, 'pre-1'), 'trial:2026-10-10:pre-1');
});

test('7 · holdDecision: the five cases', () => {
  const base = { nextChargeAt: CHARGE.toISOString(), holdUntil: null };
  const iso = (ms: number) => new Date(ms).toISOString();
  // (a) delivered at start + 1 h → none
  assert.deepEqual(
    holdDecision({
      ...base,
      noticeDeliveredAt: iso(START.getTime() + H),
      now: new Date(CHARGE.getTime() - DAY),
    }),
    { action: 'none' },
  );
  // (b) delivered exactly at charge − 5 d → none
  assert.deepEqual(
    holdDecision({
      ...base,
      noticeDeliveredAt: iso(CHARGE.getTime() - 5 * DAY),
      now: new Date(CHARGE.getTime() - DAY),
    }),
    { action: 'none' },
  );
  // (c) delivered at start + 3 d → hold until delivered + 5 d
  const late = START.getTime() + 3 * DAY;
  const c = holdDecision({ ...base, noticeDeliveredAt: iso(late), now: new Date(late + H) });
  assert.deepEqual(c, { action: 'hold', until: new Date(late + 5 * DAY) });
  // (d) never delivered, now = charge − 2 d → hold until now + 5 d
  const now = new Date(CHARGE.getTime() - 2 * DAY);
  assert.deepEqual(holdDecision({ ...base, noticeDeliveredAt: null, now }), {
    action: 'hold',
    until: new Date(now.getTime() + 5 * DAY),
  });
  // … and already at the deadline (day 2): hold, not wait for the last two days.
  assert.equal(
    holdDecision({ ...base, noticeDeliveredAt: null, now: new Date(CHARGE.getTime() - 5 * DAY) })
      .action,
    'hold',
  );
  assert.equal(
    holdDecision({
      ...base,
      noticeDeliveredAt: null,
      now: new Date(CHARGE.getTime() - 5 * DAY - H),
    }).action,
    'none',
  );
  // (e) after delivered + 5 d → resume
  assert.deepEqual(
    holdDecision({
      nextChargeAt: CHARGE.toISOString(),
      noticeDeliveredAt: iso(late),
      holdUntil: iso(late + 5 * DAY),
      now: new Date(late + 5 * DAY),
    }),
    { action: 'resume' },
  );
  // §16.12: re-notified on day 4 → charge on day 9.
  const day4 = START.getTime() + 4 * DAY;
  const r = holdDecision({ ...base, noticeDeliveredAt: iso(day4), now: new Date(day4 + H) });
  assert.deepEqual(r, { action: 'hold', until: new Date(START.getTime() + 9 * DAY) });
});

test('7 · the billing cron runs at least daily', () => {
  const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as {
    crons: { path: string; schedule: string }[];
  };
  const cron = vercel.crons.find((c) => c.path === '/api/cron/billing');
  assert.ok(cron);
  const [, , dom, month, dow] = cron!.schedule.split(' ');
  assert.deepEqual([dom, month, dow], ['*', '*', '*']);
});

// ── Copy and consent (8–11) ────────────────────────────────────────────────

const VARS = {
  nombre: 'Ana',
  plan: 'Pro anual',
  monto: '$9,970',
  renovacion: 'cada año ($9,970 MXN)',
  fecha_inicio: '3 de octubre de 2026',
  fecha_fin_prueba: '10 de octubre de 2026',
  fecha_cobro: '10 de octubre de 2026',
  dias: 7,
  faltan: 7,
  ultimos4: '4821',
  consent_id: '8f3c2a1e-6b7d-4f0a-9e21-2c5d7a9b1f44',
  switch_mensual: '$997',
  documentos: [
    {
      label: 'Términos de Suscripción',
      version: '2026-10-03',
      url: 'https://www.chalyb.com/suscripcion',
    },
  ],
  appUrl: 'https://www.chalyb.com',
};

test('8 · the charge notice email: "Aviso de cobro", every fact, and nothing else', () => {
  const mail = billingEmail('trial_7d', VARS);
  assert.equal(
    mail.subject,
    'Aviso de cobro: el 10 de octubre de 2026 se cobrarán $9,970 MXN si no cancelas',
  );
  for (const must of [
    '10 de octubre de 2026',
    '$9,970 MXN',
    'cada año',
    '4821',
    '/app/billing?cancelar=1',
    VARS.consent_id,
    'Hasta hoy has pagado $0.',
    'Faltan 7 días',
    'Cambiar a Pro mensual: $997 MXN al mes',
    'Documentos que aceptaste',
  ]) {
    assert.ok(mail.text.includes(must) || mail.html.includes(must), must);
  }
  for (const banned of [
    'Hacer mis primeros clips',
    '🎉',
    'bienvenid',
    'Bienvenid',
    'tips',
    'promo',
  ]) {
    assert.ok(!mail.text.includes(banned), `no welcome/marketing: ${banned}`);
  }
  const monthly = billingEmail('trial_7d', {
    ...VARS,
    plan: 'Pro mensual',
    monto: '$997',
    renovacion: 'cada mes ($997 MXN)',
    switch_mensual: undefined,
  });
  assert.ok(monthly.text.includes('cada mes'));
  assert.ok(!monthly.text.includes('Cambiar a Pro mensual'), 'the switch link is annual-only');
});

test('8 · the signup confirmation: every fact, the notice date, and it is not the notice', () => {
  const mail = billingEmail('trial_welcome', { ...VARS, fecha_recordatorio: '5 de octubre de 2026' });
  assert.ok(!mail.subject.includes('Aviso de cobro'));
  for (const must of ['10 de octubre de 2026', '$9,970 MXN', 'Hoy pagaste $0.', VARS.consent_id, 'Te enviaremos el aviso de cobro el 5 de octubre de 2026']) {
    assert.ok(mail.text.includes(must) || mail.html.includes(must), must);
  }
});

test('8 · day 6 email (flagged)', () => {
  const mail = billingEmail('trial_1d', VARS);
  assert.equal(mail.subject, 'Mañana termina tu prueba gratis');
  assert.ok(mail.text.includes('$9,970 MXN'));
});

function* files(dir: string, ext: RegExp): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (ext.test(name)) yield path;
  }
}

function strings(obj: unknown, path = ''): [string, string][] {
  if (typeof obj === 'string') return [[path, obj]];
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

test('9 · disclosure and checkbox say 7 días, the amount, se renovará automáticamente, cada mes/año', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).billing;
  assert.match(es.disclosure.ends, /\{dias\} días/);
  assert.match(es.disclosure.charge, /\{monto\} MXN/);
  assert.match(es.disclosure.charge, /se renovará automáticamente \{renovacion\}/);
  assert.match(es.vars.renovacion.month, /cada mes/);
  assert.match(es.vars.renovacion.year, /cada año/);
  assert.equal(
    es.pay.consent,
    'Acepto que, si no cancelo antes del <b>{fecha_cobro}</b>, Chalyb cobre automáticamente <b>{monto} MXN</b> {renovacion_corta} a mi tarjeta, y acepto los <terms>Términos de Suscripción</terms>.',
  );
});

test('9 · banned in trial and charge copy (messages + email templates)', () => {
  const BANNED =
    /mes gratis|\b1 mes\b|3 días|3 days|30 días|30-day|equivale|free month|1 month free/i;
  const hits: string[] = [];
  for (const lang of ['es', 'en']) {
    const m = JSON.parse(readFileSync(join(ROOT, `messages/${lang}.json`), 'utf8'));
    for (const ns of [
      'billing',
      'checkout',
      'plans',
      'landing',
      'home',
      'banner',
      'notif',
      'tools',
      'change',
      'myplan',
      'cancel',
      'meta',
    ]) {
      for (const [k, v] of strings(m[ns], ns)) if (BANNED.test(v)) hits.push(`${lang}:${k}: ${v}`);
    }
  }
  for (const file of files(join(ROOT, 'src/lib/email'), /\.ts$/)) {
    const text = readFileSync(file, 'utf8');
    if (BANNED.test(text)) hits.push(file);
  }
  assert.deepEqual(hits, []);
});

test('10 · every trial button says "Empezar mis 7 días gratis"', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));
  for (const v of [
    es.checkout.pay.cta,
    es.plans.pro.cta,
    es.landing.cta,
    es.landing.sticky,
    es.landing.plans.proCta,
    es.home.included.cta.trial,
  ]) {
    assert.equal(v, 'Empezar mis 7 días gratis');
  }
  const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8'));
  assert.equal(en.checkout.pay.cta, 'Start my 7-day free trial');
});

test('10 · checkbox unchecked by default, button disabled until it is', () => {
  const form = readFileSync(join(ROOT, 'src/components/app/billing/pay-form.tsx'), 'utf8');
  assert.match(form, /useState\(!needsConsent\)/);
  assert.match(form, /if \(!checked\) \{\s*setNudge\(true\);\s*return;/);
});

test('10 · checkout never preselects the annual charge (C9)', () => {
  assert.equal(initialTrialPlan('year', true), null);
  assert.equal(initialTrialPlan(null, true), null);
  assert.equal(initialTrialPlan('month', true), 'pro_month');
  assert.equal(initialTrialPlan('month', false), 'pro_year', 'Mensual turned off: the only option');
  const pago = readFileSync(
    join(ROOT, 'src/app/[locale]/(dashboard)/app/prueba/pago/page.tsx'),
    'utf8',
  );
  assert.match(pago, /redirect\(\{ href: '\/app\/prueba', locale \}\)/, 'a missing plan goes back to the picker');
  assert.doesNotMatch(pago, /monthlyOffered \? 'pro_month' : 'pro_year'/, 'no default plan on the payment page');
});

test('no "o paga mes a mes" line inside checkout components (Q5)', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));
  const refKeys = strings(es)
    .filter(([, v]) => /o paga mes a mes/.test(v))
    .map(([k]) => k);
  assert.deepEqual(refKeys, ['billing.price.monthlyRef']);
  for (const file of [
    'src/components/app/billing/trial-picker.tsx',
    'src/components/app/billing/pay-form.tsx',
    'src/app/[locale]/(dashboard)/app/prueba/pago/page.tsx',
    'src/app/[locale]/(dashboard)/app/billing/cambiar/page.tsx',
  ]) {
    assert.doesNotMatch(readFileSync(join(ROOT, file), 'utf8'), /monthlyRef/, file);
  }
});

test('11 · UI_VERSION bumped for the new trial wording', () => {
  // consent.ts reads request headers, so it is read as text here.
  const src = readFileSync(join(ROOT, 'src/lib/billing/consent.ts'), 'utf8');
  const version = /export const UI_VERSION = '([^']+)'/.exec(src)?.[1];
  assert.notEqual(version, 'rebuild-p2');
  assert.equal(version, 'rebuild-p5-law-2026-10-03');
});

test('11 · the consent record stores the 7-day trial, its texts, the plan and the amount', () => {
  const src = readFileSync(join(ROOT, 'src/lib/billing/start-subscription.ts'), 'utf8');
  for (const field of [
    'disclosure_text: disclosureText',
    'checkbox_text: checkboxText',
    'plan_id: input.planKey',
    'amount_mxn: price.totalCents / 100',
    'trial_end_utc',
    'ui_version: UI_VERSION',
  ]) {
    assert.ok(src.includes(field), field);
  }
});

test('T-6 · during the trial, any switch keeps the charge date (every plan has the trial)', () => {
  assert.equal(changeTiming('pro_year', 'pro_month', true), 'trial_end');
  assert.equal(changeTiming('pro_month', 'pro_year', true), 'trial_end');
  assert.equal(changeTiming('pro_month', 'vip_month', true), 'trial_end');
});

test('C6 · TRIAL_DAY29_REMINDER_ENABLED is gone', () => {
  for (const file of files(join(ROOT, 'src'), /\.(ts|tsx)$/)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /TRIAL_DAY29|day29/i, file);
  }
});

test('Quebec still blocks the trial and paid plans', () => {
  assert.equal(paidPlansBlocked({ country: 'CA', province: 'QC' }, true), true);
});
