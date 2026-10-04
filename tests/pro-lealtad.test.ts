// WS-7 · Pro Lealtad (PRICING-CARDS-SPEC §15.12; Law REVISION §R.6, the 13
// checks; Términos §4 bis).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chargeFor,
  lealtadPriceCents,
  lealtadSchedule,
  planHasTrial,
  planPrice,
} from '@/config/pricing';
import {
  lealtadCalendar,
  lealtadDates,
  lealtadGate,
  lealtadTotal,
  resets,
  resumeStep,
  stepAfterCharge,
} from '@/lib/billing/lealtad';
import {
  lealtadCheckoutParagraphs,
  lealtadConsentSentence,
  stripMarkup,
  evidenceText,
  type Translate,
} from '@/lib/billing/billing-copy';
import { billingEmail } from '@/lib/email/billing-templates';
import { dueNotices, holdDecision } from '@/lib/billing/reminders';
import { planOnSale } from '@/lib/billing/api';
import {
  lealtadEnabled,
  lealtadOpenToNewCustomers,
  lealtadReturnWindowDays,
} from '@/lib/config/flags';
import { formatMXN } from '@/lib/billing/format';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DAY = 86_400_000;
const AMOUNTS = ['$1,662', '$1,495', '$1,329', '$1,163', '$997', '$831', '$664'];

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

test('1 · the schedule: linear off $1,662, floored to the peso, real % ≥ advertised', () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6].map(lealtadPriceCents),
    [166_200, 149_500, 132_900, 116_300, 99_700, 83_100, 66_400],
  );
  assert.equal(lealtadPriceCents(7), 66_400);
  assert.equal(lealtadPriceCents(40), 66_400);
  assert.notEqual(lealtadPriceCents(1), 149_600);
  assert.notEqual(lealtadPriceCents(6), 66_500);
  assert.equal(lealtadPriceCents(2), 132_900, 'not compounding (134_600)');
  for (const s of lealtadSchedule()) {
    const real = ((166_200 - s.cents) * 100) / 166_200;
    assert.ok(real >= s.pct, `step ${s.step}: ${real} ≥ ${s.pct}`);
  }
  assert.deepEqual(
    lealtadSchedule().map((s) => formatMXN(s.cents)),
    AMOUNTS,
  );
});

test('2 · totals: months 1–12 = $11,461, months 13–24 = $7,968', () => {
  assert.equal(lealtadTotal(1, 12), 1_146_100);
  assert.equal(lealtadTotal(13, 24), 796_800);
});

test('3 · checkout block and checkbox: all 7 amounts, "hoy" + $1,662, renewal, the 3 reset triggers, a date per step', () => {
  const t = translatorFor('es');
  const block = evidenceText(
    lealtadCheckoutParagraphs(t, {
      start: new Date('2026-10-03T18:00:00Z'),
      cardLast4: '4821',
      locale: 'es',
    }),
  );
  for (const a of AMOUNTS) assert.ok(block.includes(a), a);
  assert.ok(
    block.includes(
      'Hoy, 3 de octubre de 2026, se cobran $1,662 MXN a tu tarjeta terminación 4821 (mes 1 de Pro Lealtad).',
    ),
  );
  for (const d of [
    '3 de noviembre de 2026: $1,495',
    '3 de diciembre de 2026: $1,329',
    '3 de enero de 2027: $1,163',
    '3 de febrero de 2027: $997',
    '3 de marzo de 2027: $831',
    'desde 3 de abril de 2027: $664 MXN cada mes',
  ]) {
    assert.ok(block.includes(d), d);
  }
  assert.match(block, /automáticamente/);
  assert.match(
    block,
    /cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar/,
  );
  const box = stripMarkup(lealtadConsentSentence(t));
  assert.equal(
    box,
    'Acepto que Chalyb cobre hoy $1,662 MXN a mi tarjeta y después, automáticamente cada mes, $1,495, $1,329, $1,163, $997 y $831 MXN, y luego $664 MXN al mes mientras siga suscrito, hasta que cancele. Entiendo que mi precio vuelve a empezar en $1,662 si cancelo, cambio de plan o un pago queda sin cubrir 7 días después de fallar, y acepto los Términos de Suscripción.',
  );
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));
  assert.match(es.plans.lealtad.rounding, /redondeados hacia abajo/);
  assert.match(
    es.plans.lealtad.reset,
    /cancelas \(al terminar tu mes pagado\), cambias a otro plan o un pago queda sin cubrir 7 días después de fallar/,
  );
});

test('3 · the dates: a missing day falls on the month’s last day, then back to the original', () => {
  const d = lealtadDates(new Date('2027-01-31T18:00:00Z'), 4).map((x) =>
    x.toISOString().slice(0, 10),
  );
  assert.deepEqual(d, ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
  assert.equal(lealtadCalendar(new Date('2026-10-03T18:00:00Z')).length, 7);
});

test('3 · the confirmation email: the calendar, the reset rule, cancel, consent id', () => {
  const mail = billingEmail('lealtad_started', {
    nombre: 'María',
    plan: 'Pro Lealtad',
    monto: '$1,662',
    reinicio: '$1,662',
    fecha_hoy: '3 de octubre de 2026',
    ultimos4: '4821',
    calendario: AMOUNTS.slice(1).map((m, i) => ({
      fecha: `fecha ${i + 2}`,
      monto: m,
      desde: i === 5,
    })),
    consent_id: 'c-1',
    version_sus: '2026-10-03',
    appUrl: 'https://www.chalyb.com',
  });
  assert.equal(mail.subject, 'Tu Pro Lealtad empezó: tu calendario de cobros');
  for (const a of AMOUNTS) assert.ok(mail.text.includes(a), a);
  assert.ok(mail.text.includes('hoy, 3 de octubre de 2026, cobramos $1,662 MXN'));
  assert.ok(
    mail.text.includes(
      'si cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar',
    ),
  );
  assert.ok(mail.text.includes('c-1'));
});

function* files(dir: string, ext: RegExp): Generator<string> {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path, ext);
    else if (ext.test(name)) yield path;
  }
}

test('3 · banned: "gratis" (except "Sin prueba gratis"), "Precio regular", "Sin descuento", "Revisión legal pendiente", "descuento" without "mes 1"', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8'));
  const texts = [
    ...Object.values(es.plans.lealtad as Record<string, string>),
    ...Object.values((es.billing.lealtad as Record<string, unknown>) ?? {}).flatMap((v) =>
      typeof v === 'string' ? [v] : Object.values(v as Record<string, string>),
    ),
  ];
  for (const s of texts) {
    // "Gratis" the plan's name is fine; "gratis" (free) only in "Sin prueba gratis".
    assert.doesNotMatch(s.replace('Sin prueba gratis', ''), /gratis/, s);
    assert.doesNotMatch(s, /Precio regular|Sin descuento|Revisión legal pendiente/, s);
    // Law's own rounding line (§15.12.2, verbatim) says "el descuento real":
    // kept as written and raised in the PR (rule 3).
    if (/descuento/.test(s) && s !== es.plans.lealtad.rounding) assert.match(s, /mes 1/, s);
  }
  for (const f of files(join(ROOT, 'src/components/app/billing'), /lealtad/)) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /Precio regular|Sin descuento/, f);
  }
});

test('4 · the consent record lealtad_started stores the dated schedule, the checkbox and UI_VERSION', () => {
  const src = readFileSync(join(ROOT, 'src/lib/billing/start-subscription.ts'), 'utf8');
  assert.match(src, /'lealtad_started'/);
  assert.match(src, /lealtadConsentSentence\(t\)/);
  assert.match(src, /schedule: lealtadCalendar\(lealtadStart\)/);
  assert.match(src, /ui_version: UI_VERSION/);
});

test('5 · no trial on Pro Lealtad', () => {
  assert.equal(planHasTrial('pro_lealtad'), false);
  assert.equal(planPrice('pro_lealtad').totalCents, 166_200);
});

test('6 · a mandatory notice 7 days before EVERY charge, with that step’s amount (month 7+ too)', () => {
  const charge = new Date('2027-05-03T18:00:00Z');
  const due = dueNotices(
    {
      state: 'pro',
      interval: 'month',
      nextChargeAt: charge.toISOString(),
      startedAt: '2026-10-03T18:00:00Z',
      day6Enabled: false,
    },
    new Date(charge.getTime() - 7 * DAY),
  );
  assert.deepEqual(
    due.map((n) => [n.kind, n.mandatory]),
    [['renew_7d', true]],
  );
  const cron = readFileSync(join(ROOT, 'src/app/api/cron/billing/route.ts'), 'utf8');
  assert.match(cron, /noticeEmailKind\(notice\.kind, planKey\)/);
  const late = billingEmail('lealtad_7d', {
    nombre: 'María',
    plan: 'Pro Lealtad',
    monto: '$664',
    mes: 8,
    pct: 60,
    monto_anterior: '$664',
    piso: '$664',
    reinicio: '$1,662',
    fecha_cobro: '3 de mayo de 2027',
    appUrl: 'https://www.chalyb.com',
  });
  assert.equal(late.subject, 'El 3 de mayo de 2027 se cobran $664 MXN de tu Pro Lealtad (mes 8)');
  assert.ok(late.text.includes('Ya estás en tu precio más bajo: $664 MXN al mes mientras sigas.'));
  assert.ok(late.text.includes('vuelve a empezar en $1,662'));
});

test('7 · a hold never changes loyalty_step', () => {
  const r = holdDecision({
    nextChargeAt: new Date(Date.now() + 2 * DAY).toISOString(),
    noticeDeliveredAt: null,
    holdUntil: null,
    now: new Date(),
  });
  assert.equal(r.action, 'hold');
  const cron = readFileSync(join(ROOT, 'src/app/api/cron/billing/route.ts'), 'utf8');
  const hold = cron.slice(cron.indexOf('// 2. Bounce hold.'), cron.indexOf('// 3.'));
  assert.doesNotMatch(hold, /loyalty_step/);
});

test('8–11 · what resets (and ends) the schedule, and what never does', () => {
  for (const c of [
    'cancel_effective',
    'plan_change',
    'unpaid_after_grace',
    'bad_faith_unpaid_after_notice',
  ] as const) {
    assert.equal(resets(c), true, c);
  }
  for (const c of [
    'cancel_undone',
    'paid_within_grace',
    'refund',
    'chargeback_opened',
    'chargeback_resolved',
    'card_change',
    'chalyb_or_mp_cause',
    'hold',
  ] as const) {
    assert.equal(resets(c), false, c);
  }
  assert.equal(stepAfterCharge(0), 1);
  assert.equal(stepAfterCharge(6), 6);
});

test('8 · no code path raises transaction_amount on a running preapproval', () => {
  const src = readFileSync(join(ROOT, 'src/lib/billing/lealtad-server.ts'), 'utf8');
  assert.match(
    src,
    /if \(current !== null && current !== undefined && cents > current\) \{[\s\S]*?return false;/,
  );
  // A comeback is a new subscription at the start of the schedule.
  assert.equal(
    resumeStep({ windowDays: 0, lastCancelledEndedAt: new Date(), lastStep: 4, now: new Date() }),
    0,
  );
});

test('12 · the amount gate', () => {
  const now = new Date('2027-01-03T18:00:00Z');
  assert.deepEqual(lealtadGate({ chargedCents: 116_300, step: 3, advancedAt: null, now }), {
    action: 'accept',
  });
  // Step − 1 only within 48 h of an advance.
  assert.deepEqual(
    lealtadGate({ chargedCents: 132_900, step: 3, advancedAt: new Date(now.getTime() - DAY), now }),
    {
      action: 'accept',
    },
  );
  assert.deepEqual(
    lealtadGate({
      chargedCents: 132_900,
      step: 3,
      advancedAt: new Date(now.getTime() - 3 * DAY),
      now,
    }),
    {
      action: 'refund_difference',
      refundCents: 16_600,
    },
  );
  // Above the base: refund the difference; the step is unaffected.
  assert.equal(
    lealtadGate({ chargedCents: 200_000, step: 3, advancedAt: null, now }).action,
    'refund_difference',
  );
  // Below: accept and alert.
  assert.deepEqual(lealtadGate({ chargedCents: 99_700, step: 3, advancedAt: null, now }), {
    action: 'accept_alert',
  });
});

test('12 · each charge counts once (a replayed webhook changes nothing)', () => {
  const src = readFileSync(join(ROOT, 'src/lib/billing/lealtad-server.ts'), 'utf8');
  // Claimed with a conditional update before anything else happens.
  assert.match(src, /\.update\(\{ loyalty_step: step \}\)[\s\S]*?\.is\('loyalty_step', null\)[\s\S]*?if \(!claimed\?\.length\) return; \/\/ already counted/);
});

test('13 · flags: off by default; withdrawn for new customers keeps existing schedules', () => {
  delete process.env.LEALTAD_ENABLED;
  delete process.env.LEALTAD_OPEN_TO_NEW_CUSTOMERS;
  delete process.env.LEALTAD_RETURN_WINDOW_DAYS;
  assert.equal(lealtadEnabled(), false);
  assert.equal(lealtadOpenToNewCustomers(), true);
  assert.equal(lealtadReturnWindowDays(), 0);
  assert.equal(planOnSale('pro_lealtad', true, false), false);
  assert.equal(planOnSale('pro_lealtad', true, true), true);
  // An existing subscription keeps charging its step whatever the flags say.
  assert.equal(chargeFor({ plan_key: 'pro_lealtad', loyalty_step: 4 }), 99_700);
  const sync = readFileSync(join(ROOT, 'src/lib/payments/subscription-sync.ts'), 'utf8');
  assert.doesNotMatch(
    sync,
    /lealtadEnabled\(\)/,
    'charges are processed even when the flag is off',
  );
});

test('optional return window (O-15): resumes the step only inside it', () => {
  const ended = new Date('2027-01-01T00:00:00Z');
  assert.equal(
    resumeStep({
      windowDays: 30,
      lastCancelledEndedAt: ended,
      lastStep: 4,
      now: new Date(ended.getTime() + 10 * DAY),
    }),
    4,
  );
  assert.equal(
    resumeStep({
      windowDays: 30,
      lastCancelledEndedAt: ended,
      lastStep: 4,
      now: new Date(ended.getTime() + 31 * DAY),
    }),
    0,
  );
});

test('migration 0052 adds the loyalty columns', () => {
  const sql = readFileSync(join(ROOT, 'supabase/migrations/0052_pro_lealtad.sql'), 'utf8');
  assert.match(sql, /loyalty_step smallint not null default 0/);
  assert.match(sql, /check \(loyalty_step between 0 and 6\)/);
  assert.match(sql, /payments[\s\S]*loyalty_step smallint/);
});
