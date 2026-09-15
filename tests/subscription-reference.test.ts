// The reference on a Mercado Pago preapproval, and what each status Mercado
// Pago reports means for the user's tier.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entitlementFor,
  isLiveStatus,
  manifestId,
  normalizePreapprovalStatus,
  parseSubscriptionReference,
  subscriptionReference,
} from '@/lib/payments/subscription-reference';

const USER = '9b2d0a1e-1111-4a2b-9c3d-000000000001';
const NOW = new Date('2026-09-15T12:00:00Z');

test('a subscription reference round-trips', () => {
  const ref = subscriptionReference(USER, 'PRO');
  assert.equal(ref, `sub|${USER}|PRO`);
  assert.deepEqual(parseSubscriptionReference(ref), { userId: USER, tier: 'PRO' });
});

test('one-off and pack references are not subscription references', () => {
  // The old tier checkout: "<userId>|<TIER>".
  assert.equal(parseSubscriptionReference(`${USER}|PRO`), null);
  // Token packs: "pack|<userId>|<packId>".
  assert.equal(parseSubscriptionReference(`pack|${USER}|tokens_500k`), null);
  assert.equal(parseSubscriptionReference(''), null);
  assert.equal(parseSubscriptionReference(null), null);
  assert.equal(parseSubscriptionReference('sub|only-two'), null);
});

test('only PRO and VIP can be subscribed to — FREE and PARTNER are refused', () => {
  assert.equal(parseSubscriptionReference(`sub|${USER}|FREE`), null);
  assert.equal(parseSubscriptionReference(`sub|${USER}|PARTNER`), null);
  assert.equal(parseSubscriptionReference(`sub|${USER}|GOLD`), null);
  assert.deepEqual(parseSubscriptionReference(`sub|${USER}|VIP`), { userId: USER, tier: 'VIP' });
});

test('Mercado Pago spells cancelled two ways; both normalise to one', () => {
  assert.equal(normalizePreapprovalStatus('cancelled'), 'cancelled');
  assert.equal(normalizePreapprovalStatus('canceled'), 'cancelled');
  assert.equal(normalizePreapprovalStatus('AUTHORIZED'), 'authorized');
  assert.equal(normalizePreapprovalStatus(' paused '), 'paused');
  assert.equal(normalizePreapprovalStatus('pending'), 'pending');
  assert.equal(normalizePreapprovalStatus(undefined), 'unknown');
  assert.equal(normalizePreapprovalStatus('something_new'), 'unknown');
});

test('pending and authorized may still charge; paused and cancelled will not', () => {
  assert.equal(isLiveStatus('pending'), true);
  assert.equal(isLiveStatus('authorized'), true);
  assert.equal(isLiveStatus('paused'), false);
  assert.equal(isLiveStatus('cancelled'), false);
  assert.equal(isLiveStatus('unknown'), false);
});

test('an authorised subscription activates the tier', () => {
  assert.deepEqual(
    entitlementFor({
      status: 'authorized',
      tier: 'VIP',
      nextPaymentDate: '2026-10-15T12:00:00Z',
      now: NOW,
    }),
    { kind: 'activate', tier: 'VIP' },
  );
});

test('a cancelled subscription keeps the plan until the next charge date', () => {
  const e = entitlementFor({
    status: 'cancelled',
    tier: 'PRO',
    nextPaymentDate: '2026-10-01T12:00:00Z',
    now: NOW,
  });
  assert.equal(e.kind, 'end');
  assert.equal(e.kind === 'end' && e.endsAt.toISOString(), '2026-10-01T12:00:00.000Z');
});

test('a paused subscription whose charge date already passed ends now — nothing was paid for', () => {
  const e = entitlementFor({
    status: 'paused',
    tier: 'PRO',
    nextPaymentDate: '2026-09-10T12:00:00Z',
    now: NOW,
  });
  assert.equal(e.kind, 'end');
  assert.equal(e.kind === 'end' && e.endsAt.toISOString(), NOW.toISOString());
});

test('no charge date on a stopped subscription also ends now', () => {
  const e = entitlementFor({ status: 'cancelled', tier: 'PRO', nextPaymentDate: null, now: NOW });
  assert.equal(e.kind === 'end' && e.endsAt.toISOString(), NOW.toISOString());
  const junk = entitlementFor({
    status: 'cancelled',
    tier: 'PRO',
    nextPaymentDate: 'not a date',
    now: NOW,
  });
  assert.equal(junk.kind === 'end' && junk.endsAt.toISOString(), NOW.toISOString());
});

test('pending and unknown statuses change nothing', () => {
  assert.deepEqual(
    entitlementFor({ status: 'pending', tier: 'PRO', nextPaymentDate: null, now: NOW }),
    {
      kind: 'none',
    },
  );
  assert.deepEqual(
    entitlementFor({ status: 'unknown', tier: 'PRO', nextPaymentDate: null, now: NOW }),
    {
      kind: 'none',
    },
  );
});

test('the signature manifest lowercases an alphanumeric id and leaves a numeric one alone', () => {
  assert.equal(manifestId('2C938084726FCA480172750000000000'), '2c938084726fca480172750000000000');
  assert.equal(manifestId(1234567890), '1234567890');
});
