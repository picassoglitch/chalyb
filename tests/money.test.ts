// "Dinero hoy" has to mean exactly one thing everywhere it is shown. These
// tests pin the three rules that made it mean three things:
//   1. which day a payment belongs to (Mexico City's, not UTC's),
//   2. which statuses count as money we have,
//   3. what happens to currencies that are not pesos.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MANUAL_USD_MXN_RATE,
  PLATFORM_TIMEZONE,
  formatMxn,
  isSettledPaymentStatus,
  moneyDisplay,
  summariseMoney,
  toMxnCents,
  zonedDayKey,
  zonedStartOfDay,
  zonedStartOfMonth,
} from '@/lib/billing/money';

// ── Day boundaries ──────────────────────────────────────────────────────

test('the day starts at local midnight, not at UTC midnight', () => {
  // Mexico City is UTC-6 in September, so local midnight on the 18th is
  // 06:00Z. A UTC day start would have put everything from 18:00Z-24:00Z on
  // the 17th into the wrong bucket.
  const start = zonedStartOfDay(new Date('2026-09-18T15:00:00Z'), PLATFORM_TIMEZONE);
  assert.equal(start.toISOString(), '2026-09-18T06:00:00.000Z');
});

test('a payment late in the local evening still belongs to that local day', () => {
  // 2026-09-18 23:30 in Mexico City = 2026-09-19 05:30Z. UTC says the 19th;
  // the business says the 18th, and the business is what the operator counts.
  const at = new Date('2026-09-19T05:30:00Z');
  assert.equal(zonedDayKey(at, PLATFORM_TIMEZONE), '2026-09-18');
  assert.ok(at >= zonedStartOfDay(at, PLATFORM_TIMEZONE));
  assert.equal(zonedStartOfDay(at, PLATFORM_TIMEZONE).toISOString(), '2026-09-18T06:00:00.000Z');
});

test('an instant exactly at local midnight belongs to the day it opens', () => {
  const at = new Date('2026-09-18T06:00:00Z');
  assert.equal(zonedStartOfDay(at, PLATFORM_TIMEZONE).getTime(), at.getTime());
  assert.equal(zonedDayKey(at, PLATFORM_TIMEZONE), '2026-09-18');
});

test('one second before local midnight is still the previous day', () => {
  const at = new Date('2026-09-18T05:59:59Z');
  assert.equal(zonedDayKey(at, PLATFORM_TIMEZONE), '2026-09-17');
});

test('the month starts at local midnight on the 1st', () => {
  const start = zonedStartOfMonth(new Date('2026-09-18T15:00:00Z'), PLATFORM_TIMEZONE);
  assert.equal(start.toISOString(), '2026-09-01T06:00:00.000Z');
});

test('a UTC timezone gives plain UTC boundaries', () => {
  assert.equal(
    zonedStartOfDay(new Date('2026-09-18T15:00:00Z'), 'UTC').toISOString(),
    '2026-09-18T00:00:00.000Z',
  );
});

test('day boundaries survive a DST transition', () => {
  // Europe/Madrid goes UTC+2 → UTC+1 on 2026-10-25. The day that contains
  // the change still starts at its own local midnight (00:00 local = 22:00Z
  // the previous day, while the +2 offset is still in force).
  const start = zonedStartOfDay(new Date('2026-10-25T12:00:00Z'), 'Europe/Madrid');
  assert.equal(start.toISOString(), '2026-10-24T22:00:00.000Z');
  // And the day after the change starts an hour "later" in UTC terms.
  const next = zonedStartOfDay(new Date('2026-10-26T12:00:00Z'), 'Europe/Madrid');
  assert.equal(next.toISOString(), '2026-10-25T23:00:00.000Z');
});

// ── What counts as money ────────────────────────────────────────────────

test('approved counts, and so do the aliases Mercado Pago actually sends', () => {
  assert.ok(isSettledPaymentStatus('approved'));
  // Payments API on some integrations.
  assert.ok(isSettledPaymentStatus('accredited'));
  // An authorized payment whose nested payment.status was absent — the shape
  // that made a real monthly charge read as "not approved" everywhere.
  assert.ok(isSettledPaymentStatus('processed'));
  assert.ok(isSettledPaymentStatus('  APPROVED '));
});

test('anything not settled is not money', () => {
  for (const status of [
    'pending',
    'in_process',
    'rejected',
    'cancelled',
    'refunded',
    'charged_back',
    'scheduled',
    'unknown',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isSettledPaymentStatus(status), false, `${String(status)} must not count`);
  }
});

// ── Summing ─────────────────────────────────────────────────────────────

test('only settled rows are summed, and currencies are kept apart', () => {
  const summary = summariseMoney([
    { amount_cents: 1000, currency: 'MXN', status: 'approved' },
    { amount_cents: 74900, currency: 'MXN', status: 'processed' },
    { amount_cents: 99999, currency: 'MXN', status: 'pending' },
    { amount_cents: 50000, currency: 'MXN', status: 'refunded' },
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.totalMxnCents, 75900);
  assert.deepEqual(summary.byCurrency, [{ currency: 'MXN', amountCents: 75900, count: 2 }]);
  assert.equal(summary.usedManualFx, false);
});

test('a USD row is converted at the manual rate and the summary says so', () => {
  const summary = summariseMoney([
    { amount_cents: 1000, currency: 'MXN', status: 'approved' },
    { amount_cents: 1000, currency: 'USD', status: 'approved' },
  ]);
  assert.equal(summary.usedManualFx, true);
  assert.equal(summary.totalMxnCents, 1000 + 1000 * MANUAL_USD_MXN_RATE);
  assert.equal(summary.byCurrency.length, 2);
  // The per-currency figures are the un-converted truth.
  const usd = summary.byCurrency.find((c) => c.currency === 'USD');
  assert.equal(usd?.amountCents, 1000);
});

test('an empty ledger is zero AND flagged as having no data', () => {
  const summary = summariseMoney([]);
  assert.equal(summary.count, 0);
  assert.equal(summary.totalMxnCents, 0);
  // moneyDisplay is what stops a surface rendering "+12% vs ayer" beside it.
  assert.deepEqual(moneyDisplay(summary), { value: '$0.00', hasData: false });
});

test('a populated summary is marked as having data', () => {
  const summary = summariseMoney([{ amount_cents: 1000, currency: 'MXN', status: 'approved' }]);
  assert.deepEqual(moneyDisplay(summary), { value: '$10.00', hasData: true });
});

test('a missing currency is treated as pesos, not as a conversion', () => {
  const summary = summariseMoney([{ amount_cents: 500, currency: null, status: 'approved' }]);
  assert.equal(summary.usedManualFx, false);
  assert.equal(summary.totalMxnCents, 500);
});

test('toMxnCents leaves pesos alone and converts everything else', () => {
  assert.equal(toMxnCents(1000, 'MXN'), 1000);
  assert.equal(toMxnCents(1000, 'mxn'), 1000);
  assert.equal(toMxnCents(1000, 'USD'), 1000 * MANUAL_USD_MXN_RATE);
  assert.equal(toMxnCents(1000, null), 1000);
});

test('formatMxn always shows two decimals', () => {
  assert.equal(formatMxn(0), '$0.00');
  assert.equal(formatMxn(1000), '$10.00');
  assert.equal(formatMxn(249900), '$2,499.00');
});
