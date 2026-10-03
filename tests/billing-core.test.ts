// P2 billing logic: state, dates, notices + bounce hold, plan changes,
// Quebec, consent chain, and the exact disclosure text.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveBillingState, type SubscriptionRow } from '@/lib/billing/billing-state';
import { trialDates, trialDaysLeft, addInterval } from '@/lib/billing/trial-dates';
import { dueNotices, holdDecision } from '@/lib/billing/reminders';
import { changeTiming, reactivationStart, vipUpgradeQuote, unusedCredit } from '@/lib/billing/plan-change';
import { isQuebec, paidPlansBlocked } from '@/lib/billing/quebec';
import { buildConsentEvent, verifyChain, canonicalJson, type ConsentEventInput } from '@/lib/billing/consent-core';
import { disclosureParagraphs, consentSentence, evidenceText, stripMarkup, type Translate } from '@/lib/billing/billing-copy';
import { missingLegalEntityFields } from '@/lib/billing/legal-entity';
import { assertReminderWindows, PRICING } from '@/config/pricing';

const DAY = 86_400_000;
const T0 = new Date('2026-09-30T18:00:00Z'); // noon in Mexico City

function row(over: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    status: 'authorized',
    tier: 'PRO',
    plan_key: 'pro_year',
    trial_ends_at: null,
    next_charge_at: null,
    next_payment_date: null,
    grace_ends_at: null,
    cancel_at_period_end: false,
    access_until: null,
    card_brand: 'visa',
    card_last4: '4242',
    card_exp: '12/29',
    pending_plan_key: null,
    pending_effective_at: null,
    reminder_delivered_at: null,
    ...over,
  };
}

// ── State ────────────────────────────────────────────────────────────
test('trialing, then paying', () => {
  const end = new Date(T0.getTime() + 30 * DAY).toISOString();
  const r = row({ trial_ends_at: end, next_charge_at: end });
  assert.equal(deriveBillingState(r, T0.getTime()).state, 'trialing');
  assert.equal(deriveBillingState(r, T0.getTime()).grantsTier, 'PRO');
  assert.equal(deriveBillingState(r, T0.getTime() + 31 * DAY).state, 'pro');
});

test('past_due keeps access inside grace only', () => {
  const r = row({ status: 'paused', next_charge_at: T0.toISOString(), grace_ends_at: new Date(T0.getTime() + 7 * DAY).toISOString() });
  assert.equal(deriveBillingState(r, T0.getTime() + DAY).state, 'past_due');
  assert.equal(deriveBillingState(r, T0.getTime() + DAY).grantsTier, 'PRO');
  assert.equal(deriveBillingState(r, T0.getTime() + 8 * DAY).state, 'free');
});

test('cancelled keeps access until the period (or trial) ends', () => {
  const until = new Date(T0.getTime() + 10 * DAY).toISOString();
  const r = row({ status: 'cancelled', cancel_at_period_end: true, access_until: until });
  const s = deriveBillingState(r, T0.getTime());
  assert.equal(s.state, 'cancelled_active');
  assert.equal(s.accessUntil, until);
  assert.equal(deriveBillingState(r, T0.getTime() + 11 * DAY).state, 'free');
});

test('VIP grants VIP; pending grants nothing; no row is free', () => {
  assert.equal(deriveBillingState(row({ tier: 'VIP', plan_key: 'vip_month' }), T0.getTime()).grantsTier, 'VIP');
  assert.equal(deriveBillingState(row({ status: 'pending' }), T0.getTime()).state, 'free');
  assert.equal(deriveBillingState(null, T0.getTime()).state, 'free');
});

// ── Dates ────────────────────────────────────────────────────────────
test('trial dates: 30 days, charge at the end, notice 7 days before', () => {
  const d = trialDates(T0);
  assert.equal(d.trialEndsAt.toISOString(), '2026-10-30T18:00:00.000Z');
  assert.equal(d.chargeAt.toISOString(), d.trialEndsAt.toISOString());
  assert.equal(d.reminderAt.toISOString(), '2026-10-23T18:00:00.000Z');
  assert.equal(trialDaysLeft(d.trialEndsAt, T0.getTime()), 30);
  assert.equal(addInterval(new Date('2026-01-31T00:00:00Z'), 'year').toISOString(), '2027-01-31T00:00:00.000Z');
});

test('notice windows are never shorter than 5 days', () => {
  assert.doesNotThrow(() => assertReminderWindows());
  assert.throws(() => assertReminderWindows({ ...PRICING, reminders: { monthDaysBefore: 3, yearDaysBefore: [30, 7] } }));
});

// ── Notices ──────────────────────────────────────────────────────────
const charge = new Date(T0.getTime() + 30 * DAY).toISOString();
const at = (days: number) => new Date(Date.parse(charge) - days * DAY);

test('trial: day-23 notice only from 7 days before', () => {
  const sub = { state: 'trialing', interval: 'year' as const, nextChargeAt: charge, startedAt: T0.toISOString(), day29Enabled: false };
  assert.deepEqual(dueNotices(sub, at(8)), []);
  const due = dueNotices(sub, at(7));
  assert.deepEqual(due.map((n) => [n.kind, n.periodKey, n.mandatory]), [['trial_7d', 'trial:2026-10-30', true]]);
  assert.equal(dueNotices({ ...sub, day29Enabled: true }, at(0.5)).length, 2);
});

test('monthly renewal: 7 days before EVERY charge', () => {
  const sub = { state: 'pro', interval: 'month' as const, nextChargeAt: charge, startedAt: T0.toISOString(), day29Enabled: false };
  assert.deepEqual(dueNotices(sub, at(7)).map((n) => n.kind), ['renew_7d']);
  assert.deepEqual(dueNotices(sub, at(8)), []);
});

test('annual renewal: 30 and 7 days before', () => {
  const sub = { state: 'pro', interval: 'year' as const, nextChargeAt: charge, startedAt: T0.toISOString(), day29Enabled: false };
  assert.deepEqual(dueNotices(sub, at(30)).map((n) => n.kind), ['renew_30d']);
  assert.deepEqual(dueNotices(sub, at(7)).map((n) => n.kind), ['renew_30d', 'renew_7d']);
});

test('the same charge always produces the same period keys (cron idempotency)', () => {
  const sub = { state: 'pro', interval: 'year' as const, nextChargeAt: charge, startedAt: T0.toISOString(), day29Enabled: false };
  assert.deepEqual(dueNotices(sub, at(6)).map((n) => n.periodKey), dueNotices(sub, at(2)).map((n) => n.periodKey));
});

test('monthly plans get one yearly summary on the anniversary', () => {
  const sub = { state: 'pro', interval: 'month' as const, nextChargeAt: new Date(T0.getTime() + 400 * DAY).toISOString(), startedAt: T0.toISOString(), day29Enabled: false };
  const later = new Date(T0.getTime() + 366 * DAY);
  assert.deepEqual(dueNotices(sub, later).map((n) => [n.kind, n.periodKey]), [['annual_summary', 'summary:2027']]);
});

// ── Bounce hold ──────────────────────────────────────────────────────
test('delivered on time → no hold', () => {
  assert.deepEqual(holdDecision({ nextChargeAt: charge, noticeDeliveredAt: at(7).toISOString(), holdUntil: null, now: at(0.5) }), { action: 'none' });
});

test('bounced → hold until 5 days after an effective notice → resume', () => {
  const now = at(0.5);
  const hold = holdDecision({ nextChargeAt: charge, noticeDeliveredAt: null, holdUntil: null, now });
  assert.equal(hold.action, 'hold');
  // Still undelivered at the end of the hold: keep holding.
  const until = (hold as { until: Date }).until.toISOString();
  assert.deepEqual(holdDecision({ nextChargeAt: charge, noticeDeliveredAt: null, holdUntil: until, now: new Date(Date.parse(until) + DAY) }), { action: 'none' });
  // Delivered through the alternate channel; 5 days later charging resumes.
  const delivered = new Date(Date.parse(until) + DAY);
  // The hold moves to 5 days after that delivery…
  assert.deepEqual(holdDecision({ nextChargeAt: charge, noticeDeliveredAt: delivered.toISOString(), holdUntil: until, now: new Date(delivered.getTime() + DAY) }), {
    action: 'hold',
    until: new Date(delivered.getTime() + 5 * DAY),
  });
  // …and stays put until then.
  assert.deepEqual(holdDecision({ nextChargeAt: charge, noticeDeliveredAt: delivered.toISOString(), holdUntil: new Date(delivered.getTime() + 5 * DAY).toISOString(), now: new Date(delivered.getTime() + 4 * DAY) }), { action: 'none' });
  assert.deepEqual(holdDecision({ nextChargeAt: charge, noticeDeliveredAt: delivered.toISOString(), holdUntil: until, now: new Date(delivered.getTime() + 5 * DAY) }), { action: 'resume' });
});

test('a notice delivered too late (< 5 days before) still holds', () => {
  const d = holdDecision({ nextChargeAt: charge, noticeDeliveredAt: at(3).toISOString(), holdUntil: null, now: at(0.5) });
  assert.equal(d.action, 'hold');
  assert.equal((d as { until: Date }).until.toISOString(), new Date(at(3).getTime() + 5 * DAY).toISOString());
});

// ── Plan changes ─────────────────────────────────────────────────────
test('change timing', () => {
  assert.equal(changeTiming('pro_month', 'vip_month', false), 'now');
  assert.equal(changeTiming('pro_month', 'pro_year', false), 'period_end');
  assert.equal(changeTiming('vip_month', 'pro_month', false), 'period_end');
  // The free month is Anual-only: an Anual trial can't turn into Mensual.
  assert.equal(changeTiming('pro_year', 'pro_month', true), 'trial_annual_only');
  assert.equal(changeTiming('pro_month', 'pro_year', true), 'trial_end');
  assert.equal(changeTiming('pro_year', 'vip_month', true), 'now');
});

test('VIP upgrade: full VIP today, refund of the unused days', () => {
  const start = new Date('2026-10-01T00:00:00Z');
  const end = new Date('2026-10-31T00:00:00Z');
  assert.equal(unusedCredit({ lastChargeCents: 99_700, periodStart: start, periodEnd: end, now: new Date('2026-10-16T00:00:00Z') }), 49_850);
  assert.deepEqual(vipUpgradeQuote({ trialing: false, lastChargeCents: 99_700, periodStart: start, periodEnd: end, now: new Date('2026-10-16T00:00:00Z') }), {
    chargeTodayCents: 379_900,
    refundCents: 49_850,
    thenMonthlyCents: 379_900,
  });
  assert.equal(vipUpgradeQuote({ trialing: true, lastChargeCents: null, periodStart: null, periodEnd: null, now: start }).refundCents, 0);
});

// ── Quebec ───────────────────────────────────────────────────────────
test('Quebec detection and block', () => {
  assert.equal(isQuebec({ country: 'CA', province: 'QC' }), true);
  assert.equal(isQuebec({ country: 'CA', province: 'Québec' }), true);
  assert.equal(isQuebec({ declared: 'qc' }), true);
  assert.equal(isQuebec({ country: 'CA', province: 'ON' }), false);
  assert.equal(isQuebec({ country: 'MX', province: 'Querétaro' }), false);
  assert.equal(paidPlansBlocked({ country: 'CA', province: 'QC' }, true), true);
  assert.equal(paidPlansBlocked({ country: 'CA', province: 'QC' }, false), false);
});

// ── Consent chain ────────────────────────────────────────────────────
const input: ConsentEventInput = {
  event_type: 'trial_started',
  user_id: 'u1',
  account_email: 'Ana@Example.com',
  documents: [{ doc: 'suscripcion', version: '1.0', url: 'https://www.chalyb.com/suscripcion/v1-0', sha256: 'abc' }],
  client_timezone: 'America/Mexico_City',
  ip_address: '201.141.0.1',
  user_agent: 'Mozilla/5.0',
  locale: 'es-MX',
  surface: 'web_checkout_trial',
  ui_version: 'p2',
  disclosure_text: 'Hoy pagas $0.',
  checkbox_text: 'Acepto…',
  checkbox_checked: true,
  button_label: 'Empezar mi mes gratis',
  plan_id: 'pro_year',
  amount_mxn: 8688.4,
  currency: 'MXN',
  tax_included: true,
  billing_interval: 'year',
  trial_end_utc: null,
  charge_date_utc: null,
  reminder_date_utc: null,
  payment_method: { processor: 'mercadopago', last4: '4242' },
  marketing_opt_in: false,
};

test('consent events chain and any edit breaks the chain', () => {
  const a = buildConsentEvent(input, null, T0, '00000000-0000-0000-0000-00000000000a');
  const b = buildConsentEvent({ ...input, event_type: 'charge_notice_sent' }, a.event_hash, T0, '00000000-0000-0000-0000-00000000000b');
  assert.equal(verifyChain([a, b]), -1);
  assert.equal(a.account_email_hash?.length, 64);
  assert.equal(a.disclosure_sha256?.length, 64);
  assert.ok(!JSON.stringify(a).includes('Ana@Example.com'), 'the email is hashed, never stored');
  assert.equal(verifyChain([{ ...a, amount_mxn: 1 }, b]), 0);
  assert.equal(verifyChain([a]), -1);
  assert.equal(verifyChain([b]), 0, 'a chain must start at null');
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), '{"a":[2,{"c":2,"d":1}],"b":1}');
});

// ── Exact disclosure text (aceptacion-ux §3.2/§3.3) ─────────────────
function translatorFor(locale: 'es' | 'en'): Translate {
  const m = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).billing;
  return (key, values = {}) => {
    const raw = key.split('.').reduce((o: Record<string, unknown>, k) => o[k] as Record<string, unknown>, m) as unknown as string;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
  };
}

test('annual disclosure, rendered exactly (IVA-inclusive totals)', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  const t = translatorFor('es');
  const dates = trialDates(new Date('2026-09-30T18:00:00Z'));
  const text = evidenceText(disclosureParagraphs(t, { planKey: 'pro_year', dates, cardLast4: '4821', locale: 'es' }));
  assert.equal(
    text,
    [
      'Hoy pagas $0. Tu mes gratis termina el 30 de octubre de 2026.',
      'Si no cancelas antes, el 30 de octubre de 2026 se cobrarán $9,970 MXN por 1 año de Pro a tu tarjeta terminación 4821, y se renovará automáticamente cada año ($9,970 MXN) hasta que canceles.',
      'Te avisaremos por correo el 23 de octubre de 2026 (7 días antes).',
      'Cancela en 1 clic desde Mi cuenta → Mi plan, sin llamadas. Si cancelas, sigues con Pro hasta el 30 de octubre de 2026 y no se te cobra nada.',
    ].join('\n'),
  );
  assert.equal(
    stripMarkup(consentSentence(t, { planKey: 'pro_month', dates, cardLast4: null, locale: 'es' })),
    'Acepto que, si no cancelo antes del 30 de octubre de 2026, Chalyb cobre automáticamente $997 MXN y cada mes después a mi tarjeta, y acepto los Términos de Suscripción.',
  );
});

test('seller identity: every field is required before the trial can open', () => {
  for (const k of Object.keys(process.env)) if (k.startsWith('LEGAL_ENTITY_')) delete process.env[k];
  assert.equal(missingLegalEntityFields().length, 7);
});

test('reactivating after cancelling a free month: only Anual keeps the rest of it', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const accessUntil = '2026-10-30T12:00:00Z';
  // Cancelled trial → Mensual or VIP: charged today, no leftover free days.
  assert.equal(reactivationStart({ to: 'pro_month', accessUntil, unpaidTrial: true, now }), null);
  assert.equal(reactivationStart({ to: 'vip_month', accessUntil, unpaidTrial: true, now }), null);
  // Cancelled trial → Anual: the free month continues.
  assert.equal(reactivationStart({ to: 'pro_year', accessUntil, unpaidTrial: true, now })?.toISOString(), '2026-10-30T12:00:00.000Z');
  // Paid access left over is always kept.
  assert.equal(reactivationStart({ to: 'pro_month', accessUntil, unpaidTrial: false, now })?.toISOString(), '2026-10-30T12:00:00.000Z');
  // Access already over: today.
  assert.equal(reactivationStart({ to: 'pro_year', accessUntil: '2026-10-01T00:00:00Z', unpaidTrial: true, now }), null);
});
