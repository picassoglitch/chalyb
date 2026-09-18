// Cancellation keeps the plan until the paid period ends, and the lapse is
// what actually takes it away.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAID_PERIOD_DAYS,
  cancellationOutcome,
  hasLapsed,
  periodEndFrom,
  tierAfterExpiry,
} from '@/lib/billing/subscription-period';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-14T12:00:00Z');
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY);

test('a period runs 30 days from the payment', () => {
  const end = periodEndFrom('2026-09-01T00:00:00Z');
  assert.ok(end);
  assert.equal(
    end.toISOString(),
    new Date(Date.parse('2026-09-01T00:00:00Z') + PAID_PERIOD_DAYS * DAY).toISOString(),
  );
});

test('cancelling mid-period keeps the plan to the end of it', () => {
  // Paid on the 1st, cancels on the 14th: 17 days left, all of them theirs.
  const outcome = cancellationOutcome({
    currentTier: 'PRO',
    lastApprovedPaymentAt: '2026-09-01T12:00:00Z',
    now: NOW,
  });
  assert.equal(outcome.kind, 'scheduled');
  assert.equal(
    outcome.kind === 'scheduled' && outcome.endsAt.toISOString(),
    '2026-10-01T12:00:00.000Z',
  );
});

test('a period that already elapsed cancels immediately', () => {
  const outcome = cancellationOutcome({
    currentTier: 'PRO',
    lastApprovedPaymentAt: '2026-06-01T00:00:00Z',
    now: NOW,
  });
  assert.equal(outcome.kind, 'immediate');
});

test('a tier nobody paid for cancels immediately', () => {
  // Admin grant or comp account: no payment, so no period to honour.
  assert.equal(
    cancellationOutcome({ currentTier: 'VIP', lastApprovedPaymentAt: null, now: NOW }).kind,
    'immediate',
  );
  // PARTNER is granted, never bought.
  assert.equal(
    cancellationOutcome({
      currentTier: 'PARTNER',
      lastApprovedPaymentAt: '2026-09-13T00:00:00Z',
      now: NOW,
    }).kind,
    'immediate',
  );
});

test('the plan keeps working right up to the end date, then stops', () => {
  assert.equal(tierAfterExpiry('PRO', daysFromNow(1), NOW), 'PRO');
  assert.equal(tierAfterExpiry('PRO', daysFromNow(-1), NOW), 'FREE');
  // Exactly at the boundary the period is over.
  assert.equal(tierAfterExpiry('PRO', NOW, NOW), 'FREE');
});

test('no scheduled end never lapses', () => {
  assert.equal(hasLapsed(null, NOW), false);
  assert.equal(tierAfterExpiry('VIP', null, NOW), 'VIP');
  // Rows that predate the column read as null, so nobody loses access when
  // the migration lands.
  assert.equal(tierAfterExpiry('PRO', undefined, NOW), 'PRO');
});

test('FREE and PARTNER are unaffected by an end date', () => {
  assert.equal(tierAfterExpiry('FREE', daysFromNow(-5), NOW), 'FREE');
  assert.equal(tierAfterExpiry('PARTNER', daysFromNow(-5), NOW), 'PARTNER');
});

test('a garbage date is not treated as an expiry', () => {
  assert.equal(hasLapsed('not-a-date', NOW), false);
  assert.equal(periodEndFrom('not-a-date'), null);
});
