// WS-5 · VIP anual and paid checkout split from the trial (PRICING-CARDS-SPEC
// §12.3–§12.6, Law Q4, Términos §4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { annualMath, grandfatheredFor, planHasTrial, planPrice, PRICING } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { checkCharge } from '@/lib/payments/webhook-verify';
import { dueNotices } from '@/lib/billing/reminders';
import { changeTiming, upgradeQuote } from '@/lib/billing/plan-change';
import {
  paidConsentSentence,
  paidParagraphs,
  stripMarkup,
  type Translate,
} from '@/lib/billing/billing-copy';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import { planOnSale } from '@/lib/billing/api';
import { plansCta } from '@/lib/billing/plans-cta';
import { jsonLdData } from '@/lib/seo/json-ld';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DAY = 86_400_000;

function translatorFor(locale: 'es' | 'en'): Translate {
  const m = JSON.parse(readFileSync(join(ROOT, `messages/${locale}.json`), 'utf8')).billing;
  return (key, values = {}) => {
    const raw = key
      .split('.')
      .reduce(
        (o: Record<string, unknown>, k) => o[k] as Record<string, unknown>,
        m,
      ) as unknown as string;
    return raw.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
  };
}

test('vip_year: $36,325 a year, no trial, saves $9,263 · 20%', () => {
  delete process.env.PRICES_INCLUDE_IVA;
  const p = planPrice('vip_year');
  assert.deepEqual(p, { key: 'vip_year', tier: 'VIP', interval: 'year', totalCents: 3_632_500 });
  assert.equal(formatMXN(p.totalCents), '$36,325');
  assert.deepEqual(annualMath('vip'), { yearVsMonthlyCents: 4_558_800, yearSavingsCents: 926_300 });
  assert.equal(planHasTrial('vip_year'), false);
  assert.equal(PLAN_NAMES.vip_year, 'VIP anual');
});

test('price gate: vip_year accepts exactly its total, never a VIP monthly (grandfathered) amount', () => {
  const expected = {
    amountCents: planPrice('vip_year').totalCents,
    alsoAcceptCents: grandfatheredFor('vip_year'),
    currency: 'MXN',
    label: 'plan vip_year',
  };
  assert.ok(checkCharge(expected, { amountMajor: 36_325, currency: 'MXN' }).ok);
  for (const old of [2499, 2898.84, 3799]) {
    assert.equal(
      checkCharge(expected, { amountMajor: old, currency: 'MXN' }).ok,
      false,
      String(old),
    );
  }
});

test('reminders: vip_year gets the 30-day and the mandatory 7-day renewal notices', () => {
  const charge = new Date('2027-10-03T15:00:00Z');
  const sub = {
    state: 'pro',
    interval: planPrice('vip_year').interval,
    nextChargeAt: charge.toISOString(),
    startedAt: '2026-10-03T15:00:00Z',
    day6Enabled: false,
  };
  const due = dueNotices(sub, new Date(charge.getTime() - 7 * DAY));
  assert.deepEqual(
    due.map((n) => [n.kind, n.mandatory]),
    [
      ['renew_30d', false],
      ['renew_7d', true],
    ],
  );
  assert.deepEqual([...PRICING.reminders.yearDaysBefore], [30, 7]);
});

test('plan changes: VIP → VIP anual today with credit, VIP anual → VIP at year end, Pro → VIP anual today', () => {
  assert.equal(changeTiming('vip_month', 'vip_year', false), 'now');
  assert.equal(changeTiming('vip_year', 'vip_month', false), 'period_end');
  assert.equal(changeTiming('pro_year', 'vip_year', false), 'now');
  const q = upgradeQuote({
    to: 'vip_year',
    trialing: false,
    lastChargeCents: 379_900,
    periodStart: new Date('2026-10-01T00:00:00Z'),
    periodEnd: new Date('2026-10-31T00:00:00Z'),
    now: new Date('2026-10-16T00:00:00Z'),
  });
  // Charged at the NEW plan's price (fix of plan-change.ts:60), credit for half the month.
  assert.deepEqual(q, { chargeTodayCents: 3_632_500, refundCents: 189_950, thenCents: 3_632_500 });
});

test('Law Q4: the VIP anual checkout block and checkbox, verbatim', () => {
  const t = translatorFor('es');
  const input = {
    planKey: 'vip_year' as const,
    renewalAt: new Date('2027-10-03T18:00:00Z'),
    cardLast4: '4821',
    locale: 'es',
  };
  assert.equal(
    stripMarkup(paidParagraphs(t, input).join('\n')),
    'Hoy se cobran $36,325 MXN (IVA incluido) por 1 año de VIP a tu tarjeta terminación 4821. Se renovará automáticamente el 3 de octubre de 2027 y cada año después por $36,325 MXN hasta que canceles. Te avisaremos 30 y 7 días antes. Cancela en 1 clic desde Mi cuenta → Mi plan; conservas VIP hasta el final del año pagado.',
  );
  assert.equal(
    stripMarkup(paidConsentSentence(t, input)),
    'Acepto el cobro de $36,325 MXN hoy y su renovación automática cada año, y acepto los Términos de Suscripción.',
  );
  // Pro anual bought without a trial: the same structure, its own amount.
  assert.equal(
    stripMarkup(paidConsentSentence(t, { ...input, planKey: 'pro_year' })),
    'Acepto el cobro de $9,970 MXN hoy y su renovación automática cada año, y acepto los Términos de Suscripción.',
  );
});

test('the consent record stores the paid text and plan_id vip_year', () => {
  const src = readFileSync(join(ROOT, 'src/lib/billing/start-subscription.ts'), 'utf8');
  assert.match(src, /paidParagraphs\(t, paidInput\)/);
  assert.match(src, /paidConsentSentence\(t, paidInput\)/);
  assert.match(src, /'subscription_started'/);
  assert.match(src, /plan_id: input\.planKey/);
  assert.match(src, /frequency: price\.interval === 'year' \? 12 : 1/);
});

test('VIP anual only when on sale; nothing annual without paid checkout', () => {
  assert.equal(planOnSale('vip_year', true), true);
  assert.equal(planOnSale('vip_year', false), false);
  assert.equal(planOnSale('vip_month', false), true);
  const off = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: false,
    annualOffered: false,
    vipYearOffered: false,
    trialUsed: false,
    billing: null,
    quebecBlocked: false,
  });
  assert.equal(off.pro.hrefYear, null);
  assert.equal(off.vip.hrefYear, null);
  // Paid checkout on, the trial off (spec §12.3 step 3): annual sold without a trial.
  const paidOnly = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: false,
    annualOffered: true,
    vipYearOffered: true,
    trialUsed: false,
    billing: null,
    quebecBlocked: false,
  });
  assert.deepEqual(paidOnly.pro, {
    hrefYear: '/app/prueba/pago?plan=pro_year',
    hrefMonth: '/app/prueba/pago?plan=pro_month',
    label: 'paid',
  });
  assert.equal(paidOnly.vip.hrefYear, '/app/billing/cambiar?plan=vip_year');
});

test('JSON-LD offers VIP anual only when it is on sale', () => {
  const names = (v: boolean) =>
    (
      jsonLdData('https://www.chalyb.com', v)['@graph'][1] as {
        offers: { name: string; price: string }[];
      }
    ).offers;
  assert.equal(names(false).length, 3);
  assert.deepEqual(names(true).at(-1), {
    ...names(true).at(-1),
    name: 'Chalyb VIP · Anual',
    price: '36325.00',
  });
});

test('migration 0046 adds vip_year (and pro_lealtad) to both plan-key CHECKs', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/0046_plan_keys_vip_year.sql'), 'utf8');
  assert.equal((sql.match(/'vip_year', 'pro_lealtad'/g) ?? []).length, 2);
});

test('no plan-name ternaries left that would call VIP anual something else', () => {
  for (const f of ['src/lib/billing/billing-actions.ts', 'src/lib/admin/people-actions.ts']) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /=== 'vip_month' \?|=== 'pro_year' \?/, f);
  }
});
