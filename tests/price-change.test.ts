// WS-6 · price increase for existing subscribers (Términos §5; aceptacion-ux
// §4.1; PRICING-CARDS-SPEC §16.8; mockup 89).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calendarDaysBefore,
  calendarDaysBetween,
  increaseFor,
  newAmountAllowed,
  nextStep,
  schedule,
  targetRenewal,
} from '@/lib/billing/price-change';
import { billingEmail } from '@/lib/email/billing-templates';
import { priceIncreaseNoAnswer, priceIncreaseNoticesEnabled } from '@/lib/config/flags';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MX = 'America/Mexico_City';

test('who: grandfathered amounts below today’s price; % per subscriber, floored', () => {
  assert.deepEqual(increaseFor('pro_month', 74_900), {
    planKey: 'pro_month',
    oldCents: 74_900,
    newCents: 99_700,
    pct: 33,
  });
  assert.equal(increaseFor('pro_month', 86_884)!.pct, 14);
  assert.equal(increaseFor('vip_month', 249_900)!.pct, 52);
  assert.equal(increaseFor('vip_month', 289_884)!.pct, 31);
  assert.equal(increaseFor('pro_month', 99_700), null, 'already at today’s price');
  assert.equal(increaseFor('pro_month', 12_300), null, 'not a grandfathered amount');
  assert.equal(increaseFor('pro_month', null), null);
});

test('the notice is EXACTLY 30 calendar days before the renewal (mockup 89: 2 nov → 3 oct, reminder 26 oct)', () => {
  const s = schedule(new Date('2026-11-02T18:00:00Z'), MX);
  assert.equal(s.noticeAt.toISOString(), '2026-10-03T18:00:00.000Z');
  assert.equal(s.reminderAt.toISOString(), '2026-10-26T18:00:00.000Z');
  assert.equal(calendarDaysBetween(s.noticeAt, s.renewalAt, MX), 30);
});

test('30 days exactly at month ends, February and across DST', () => {
  const cases: [string, string, string][] = [
    // renewal, zone, expected notice (same wall-clock time, 30 calendar days earlier)
    ['2027-03-31T18:00:00Z', MX, '2027-03-01T18:00:00.000Z'],
    ['2027-03-01T18:00:00Z', MX, '2027-01-30T18:00:00.000Z'],
    ['2028-03-01T18:00:00Z', MX, '2028-01-31T18:00:00.000Z'], // leap year
    // US DST ends 1 nov 2026: 17:00 EST on 3 nov ← 17:00 EDT on 4 oct.
    ['2026-11-03T22:00:00Z', 'America/New_York', '2026-10-04T21:00:00.000Z'],
    // US DST starts 14 mar 2027: 17:00 EDT on 1 apr ← 17:00 EST on 2 mar.
    ['2027-04-01T21:00:00Z', 'America/New_York', '2027-03-02T22:00:00.000Z'],
  ];
  for (const [renewal, tz, notice] of cases) {
    const n = calendarDaysBefore(new Date(renewal), 30, tz);
    assert.equal(n.toISOString(), notice, `${renewal} ${tz}`);
    assert.equal(calendarDaysBetween(n, new Date(renewal), tz), 30, 'never 29, never 31');
  }
});

test('the target renewal is the first one at least 30 days away', () => {
  const from = new Date('2026-10-03T18:00:00Z');
  assert.equal(
    targetRenewal(new Date('2026-10-20T18:00:00Z'), 'month', from, MX).toISOString(),
    '2026-11-20T18:00:00.000Z',
  );
  assert.equal(
    targetRenewal(new Date('2026-11-02T18:00:00Z'), 'month', from, MX).toISOString(),
    '2026-11-02T18:00:00.000Z',
  );
});

const S = schedule(new Date('2026-11-02T18:00:00Z'), MX);
const at = (iso: string) => new Date(iso);
const base = {
  schedule: S,
  noticeSent: false,
  reminderSent: false,
  answer: null,
  noAnswer: 'gratis' as const,
};

test('steps: nothing before the notice date, then the notice, then the reminder at −7 only if unanswered', () => {
  assert.deepEqual(nextStep({ ...base, now: at('2026-10-03T17:59:00Z') }), { kind: 'none' });
  assert.deepEqual(nextStep({ ...base, now: at('2026-10-03T18:00:00Z') }), { kind: 'notice' });
  assert.deepEqual(nextStep({ ...base, noticeSent: true, now: at('2026-10-20T18:00:00Z') }), {
    kind: 'none',
  });
  assert.deepEqual(nextStep({ ...base, noticeSent: true, now: at('2026-10-26T18:00:00Z') }), {
    kind: 'reminder',
  });
  assert.deepEqual(
    nextStep({ ...base, noticeSent: true, reminderSent: true, now: at('2026-10-27T18:00:00Z') }),
    { kind: 'none' },
  );
  // Answered: no reminder.
  assert.notEqual(
    nextStep({ ...base, noticeSent: true, answer: 'accepted', now: at('2026-10-26T18:00:00Z') })
      .kind,
    'reminder',
  );
});

test('no answer by the day before: option (a) ends at period end, option (b) keeps the old amount', () => {
  const late = at('2026-11-01T18:00:00Z');
  assert.deepEqual(nextStep({ ...base, noticeSent: true, reminderSent: true, now: late }), {
    kind: 'end_at_period',
  });
  assert.deepEqual(
    nextStep({ ...base, noAnswer: 'keep_old', noticeSent: true, reminderSent: true, now: late }),
    { kind: 'keep_old' },
  );
  assert.deepEqual(
    nextStep({ ...base, answer: 'declined', noticeSent: true, now: at('2026-10-10T18:00:00Z') }),
    {
      kind: 'end_at_period',
    },
  );
});

test('no charge at the new amount without an acceptance on record', () => {
  assert.equal(newAmountAllowed(null), false);
  assert.equal(newAmountAllowed('declined'), false);
  assert.equal(newAmountAllowed('accepted'), true);
  assert.deepEqual(
    nextStep({ ...base, answer: 'accepted', noticeSent: true, now: at('2026-10-10T18:00:00Z') }),
    {
      kind: 'apply_new',
    },
  );
  // Accepted without a verified MP PUT: an admin item, never the new amount.
  const src = readFileSync(join(ROOT, 'src/lib/billing/price-change-server.ts'), 'utf8');
  assert.match(src, /if \(!mpPreapprovalAmountPutVerified\(\)\) \{[\s\S]*?notify\(/);
});

test('flags: off by default, option (a) by default', () => {
  delete process.env.PRICE_INCREASE_NOTICES_ENABLED;
  delete process.env.PRICE_INCREASE_NO_ANSWER;
  assert.equal(priceIncreaseNoticesEnabled(), false);
  assert.equal(priceIncreaseNoAnswer(), 'gratis');
  process.env.PRICE_INCREASE_NO_ANSWER = 'keep_old';
  assert.equal(priceIncreaseNoAnswer(), 'keep_old');
  delete process.env.PRICE_INCREASE_NO_ANSWER;
});

test('the email, verbatim (aceptacion-ux §4.1)', () => {
  const v = {
    nombre: 'María',
    plan: 'Pro',
    monto: '$997',
    precio_anterior: '$749',
    precio_nuevo: '$997',
    porcentaje: 33,
    periodo: 'mes',
    fecha_aplicacion: '2 de noviembre de 2026',
    fecha_fin_periodo: '2 de noviembre de 2026',
    appUrl: 'https://www.chalyb.com',
  };
  const mail = billingEmail('price_change', v);
  assert.equal(
    mail.subject,
    'Tu plan Pro cambia de precio: acepta o decide antes del 2 de noviembre de 2026',
  );
  assert.ok(
    mail.text.includes(
      'El precio de Pro sube de $749 MXN a $997 MXN al mes (IVA incluido), un aumento de 33%.',
    ),
  );
  assert.ok(mail.text.includes('Solo se te cobrará el nuevo precio si lo aceptas.'));
  assert.ok(mail.text.includes('tu plan no se renovará al nuevo precio'));
  assert.ok(mail.text.includes('Cancelar sin costo'));
  const keep = billingEmail('price_change', { ...v, keep_old: true });
  assert.ok(keep.text.includes('seguirás pagando $749 MXN'));
});

test('the modal, verbatim (mockup 89)', () => {
  const es = JSON.parse(readFileSync(join(ROOT, 'messages/es.json'), 'utf8')).priceChange;
  assert.equal(es.title, 'Cambia el precio de tu plan {plan}');
  assert.equal(
    es.line1,
    'Hoy pagas {anterior} MXN al {periodo}. A partir del {fecha}: <b>{nuevo} MXN al {periodo}</b>, IVA incluido.',
  );
  assert.equal(
    es.line2Gratis,
    'Solo se te cobrará si lo aceptas. Si no, conservas {plan} hasta el {fecha} y después pasas a Gratis, sin cobro.',
  );
  assert.equal(es.accept, 'Acepto el nuevo precio');
  assert.equal(es.decline, 'No, gracias');
  assert.equal(es.cancel, 'Cancelar mi plan');
});

test('cancelling is never blocked: the modal links to the ordinary cancel', () => {
  const modal = readFileSync(
    join(ROOT, 'src/components/app/billing/price-change-modal.tsx'),
    'utf8',
  );
  assert.match(modal, /\/app\/billing\?cancelar=1/);
});
