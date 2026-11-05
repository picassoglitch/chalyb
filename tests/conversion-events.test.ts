// Aldo 2026-11-05 "Count every first payment": the conversion fires once per first charge
// (trial or paid) and once per settled pack, through the real webhook code paths.

import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeBackend, drain, type FakeBackend } from './fakes/billing-backend';
import { planPrice, PACK_CENTS, type PlanKey } from '@/config/pricing';
import { PACK_PRICES_SETTING } from '@/config/pack-pricing';

const backend: FakeBackend = installFakeBackend();
// Imported after the fake is in place: the clients read env and fetch on first use.
const { recordAuthorizedPayment, syncSubscription } = await import('@/lib/payments/subscription-sync');
const { settleOneOffCharge } = await import('@/lib/payments/one-off-settlement');
const { reconcilePackGrants } = await import('@/lib/payments/pack-reconcile');
const { getMercadoPago } = await import('@/lib/payments/mercadopago');
await import('@vercel/analytics/server');

const USER = 'u-conv';
const PRE = 'pre-conv';
const DAY = 86_400_000;
const iso = (ms: number) => new Date(Date.now() + ms).toISOString();

// The SDK's preapproval client uses node-fetch, so it's faked on the shared instance.
let preapproval: Record<string, unknown> = {};
(getMercadoPago().preapproval as unknown as { get: () => Promise<unknown> }).get = async () =>
  structuredClone(preapproval);

function seedSubscription(planKey: PlanKey, over: Record<string, unknown> = {}) {
  backend.tables.subscriptions = [
    {
      id: 's-1',
      user_id: USER,
      tier: 'PRO',
      plan_key: planKey,
      mp_preapproval_id: PRE,
      external_reference: `sub|${USER}|PRO`,
      status: 'authorized',
      amount_cents: planPrice(planKey).totalCents,
      trial_ends_at: null,
      last_charge_at: null,
      first_charge_at: iso(-60_000),
      started_at: iso(-60_000),
      charge_hold_until: null,
      reminder_delivered_at: null,
      ...over,
    },
  ];
  seedProfile('PRO');
}

function seedProfile(tier: string) {
  backend.tables.profiles = [{ id: USER, email: 'buyer@example.com', tier, tier_ends_at: null }];
}

const priceOf = (planKey: PlanKey) => planPrice(planKey).totalCents / 100;

/** Mercado Pago's view after `charged` approved charges, the last one at `lastAt`. */
function mpState(planKey: PlanKey, charged: number, lastAt: string | null, amount = priceOf(planKey)) {
  preapproval = {
    id: PRE,
    external_reference: `sub|${USER}|PRO`,
    status: 'authorized',
    date_created: iso(-DAY),
    next_payment_date: iso(30 * DAY),
    auto_recurring: { transaction_amount: amount, currency_id: 'MXN' },
    summarized: {
      charged_quantity: charged,
      last_charged_date: lastAt,
      last_charged_amount: charged ? String(amount) : null,
    },
  };
}

function mpCharge(apId: number, paymentId: number, debitAt: string, amount: number) {
  backend.mp[`/authorized_payments/${apId}`] = {
    id: apId,
    preapproval_id: PRE,
    external_reference: `sub|${USER}|PRO`,
    transaction_amount: amount,
    currency_id: 'MXN',
    status: 'processed',
    date_created: debitAt,
    debit_date: debitAt,
    payment: { id: paymentId, status: 'approved' },
  };
}

/** A first charge of `planKey` that MP has made and will notify as `apId`. */
function charged(planKey: PlanKey, apId: number, chargedCount = 1) {
  const at = iso(-1000);
  mpCharge(apId, apId + 9000, at, priceOf(planKey));
  mpState(planKey, chargedCount, at);
  return at;
}

const rows = (table: string) => backend.tables[table] ?? [];
const conversions = () => backend.events.filter((e) => e.name === 'conversion');

beforeEach(() => {
  backend.reset();
  preapproval = {};
});

afterEach(() => {
  assert.deepEqual(backend.unsupported, [], 'every query the code made was understood by the fake');
});

test('1a a direct paid start (no trial) fires one conversion on its first charge', async () => {
  seedSubscription('pro_month');
  const at = charged('pro_month', 101);

  const res = await recordAuthorizedPayment('101');
  await drain();

  assert.equal(res.ok, true);
  assert.deepEqual(conversions(), [
    {
      name: 'conversion',
      props: {
        plan: 'mensual',
        kind: 'subscription_first',
        amount_mxn: priceOf('pro_month'),
        interval: 'month',
        trial: false,
        plan_key: 'pro_month',
        returning: false,
      },
    },
  ]);
  assert.equal(rows('subscriptions')[0]?.last_charge_at, new Date(at).toISOString());
});

test('1b a first charge the re-sync builds the row for (checkout row failed) counts once', async () => {
  seedProfile('FREE');
  charged('pro_month', 111);

  const res = await syncSubscription(PRE, { rowFailed: { planKey: 'pro_month' } });
  await recordAuthorizedPayment('111');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(conversions().length, 1);
  assert.equal(conversions()[0]?.props.plan_key, 'pro_month');
  assert.ok(rows('subscriptions')[0]?.last_charge_at);
});

test('2a a trial that converts still fires one conversion, marked as a trial', async () => {
  seedSubscription('pro_year', { trial_ends_at: iso(-2000) });
  charged('pro_year', 102);

  await recordAuthorizedPayment('102');
  await drain();

  const got = conversions();
  assert.equal(got.length, 1);
  assert.equal(got[0]?.props.plan, 'anual');
  assert.equal(got[0]?.props.interval, 'year');
  assert.equal(got[0]?.props.trial, true);
  assert.equal(got[0]?.props.kind, 'subscription_first');
  assert.equal(got[0]?.props.amount_mxn, priceOf('pro_year'));
});

test('2b a trial charge found by the re-sync first is marked as a trial too', async () => {
  seedSubscription('pro_year', { trial_ends_at: iso(-2000) });
  charged('pro_year', 112);

  await syncSubscription(PRE);
  await recordAuthorizedPayment('112');
  await drain();

  assert.equal(conversions().length, 1);
  assert.equal(conversions()[0]?.props.trial, true);
  assert.equal(conversions()[0]?.props.amount_mxn, priceOf('pro_year'));
});

test('3a a renewal (second charge) fires nothing', async () => {
  seedSubscription('pro_month', { last_charge_at: iso(-30 * DAY) });
  charged('pro_month', 103, 2);

  const res = await recordAuthorizedPayment('103');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(conversions().length, 0);
});

test('3b a renewal the re-sync finds first fires nothing', async () => {
  seedSubscription('pro_month', { last_charge_at: iso(-30 * DAY) });
  charged('pro_month', 113, 2);

  await syncSubscription(PRE);
  await recordAuthorizedPayment('113');
  await drain();

  assert.ok(Date.parse(String(rows('subscriptions')[0]?.last_charge_at)) > Date.now() - DAY);
  assert.equal(conversions().length, 0);
});

test('4a a replayed notification of the same charge does not fire twice', async () => {
  seedSubscription('pro_month');
  charged('pro_month', 104);

  await recordAuthorizedPayment('104');
  await recordAuthorizedPayment('104');
  await Promise.all([recordAuthorizedPayment('104'), recordAuthorizedPayment('104')]);
  await drain();

  assert.equal(conversions().length, 1);
});

test('4b two first-time deliveries racing each other count the charge once', async () => {
  seedSubscription('pro_month');
  charged('pro_month', 114);

  await Promise.all([recordAuthorizedPayment('114'), recordAuthorizedPayment('114')]);
  await drain();

  assert.equal(conversions().length, 1);
});

test('4c the re-sync (webhook or cron) counts a charge whose notification is late, once', async () => {
  seedSubscription('pro_month');
  charged('pro_month', 124);

  await syncSubscription(PRE);
  await syncSubscription(PRE);
  await recordAuthorizedPayment('124');
  await drain();

  const got = conversions();
  assert.equal(got.length, 1);
  assert.equal(got[0]?.props.kind, 'subscription_first');
  assert.equal(got[0]?.props.amount_mxn, priceOf('pro_month'));
});

test('4d the re-sync racing the notification counts the charge once', async () => {
  seedSubscription('pro_month');
  charged('pro_month', 144);

  await Promise.all([syncSubscription(PRE), recordAuthorizedPayment('144'), syncSubscription(PRE)]);
  await drain();

  assert.equal(conversions().length, 1);
});

test('4e a failed claim on the notification asks MP to retry, and the retry counts once', async () => {
  seedSubscription('pro_month');
  const at = charged('pro_month', 154);
  backend.failNext.push({ method: 'PATCH', table: 'subscriptions', filter: 'last_charge_at=is.null' });

  const first = await recordAuthorizedPayment('154');
  assert.deepEqual(first, { ok: false, retry: true });
  const retried = await recordAuthorizedPayment('154');
  await drain();

  assert.equal(retried.ok, true);
  assert.equal(rows('subscriptions')[0]?.last_charge_at, new Date(at).toISOString());
  assert.equal(conversions().length, 1);
});

test('4f a failed claim on the re-sync asks for a retry instead of leaving the charge unrecorded', async () => {
  seedSubscription('pro_month');
  const at = charged('pro_month', 164);
  backend.failNext.push({ method: 'PATCH', table: 'subscriptions', filter: 'last_charge_at=is.null' });

  const first = await syncSubscription(PRE);
  assert.deepEqual(first, { ok: false, reason: 'db', retry: true });
  const again = await syncSubscription(PRE);
  await drain();

  assert.equal(again.ok, true);
  assert.equal(rows('subscriptions')[0]?.last_charge_at, at);
  assert.equal(conversions().length, 1);
});

test('4g a plan change from a charged subscription is flagged returning', async () => {
  seedSubscription('pro_month');
  rows('subscriptions').push(
    { id: 's-0', user_id: USER, mp_preapproval_id: 'pre-old', status: 'cancelled', last_charge_at: iso(-40 * DAY) },
    // Never charged: not a previous purchase.
    { id: 's-t', user_id: USER, mp_preapproval_id: 'pre-trial', status: 'cancelled', last_charge_at: null },
  );
  charged('pro_month', 134);

  await recordAuthorizedPayment('134');
  await drain();

  assert.equal(conversions().length, 1);
  assert.equal(conversions()[0]?.props.returning, true);
});

test('4h a preapproval refused for its amount is never a conversion, whichever path lands first', async () => {
  for (const order of ['sync-first', 'notification-first'] as const) {
    backend.reset();
    seedSubscription('pro_month', { status: order === 'notification-first' ? 'amount_mismatch' : 'pending' });
    const at = iso(-1000);
    mpCharge(174, 9174, at, 1);
    mpState('pro_month', 1, at, 1);

    if (order === 'sync-first') await syncSubscription(PRE);
    await recordAuthorizedPayment('174');
    await drain();

    assert.equal(conversions().length, 0, order);
  }
});

function packCharge(mpId: string, cents: number, status: 'approved' | 'pending' | 'rejected' = 'approved') {
  return {
    source: 'payment' as const,
    mpPaymentId: mpId,
    mpReference: mpId,
    status,
    amountMajor: cents / 100,
    paidAmountMajor: cents / 100,
    currency: 'MXN',
    externalReference: `pack_${USER}_tokens_100k`,
  };
}

function seedPackStore() {
  seedProfile('FREE');
  backend.tables.app_settings = [
    { key: PACK_PRICES_SETTING, value: { ivaMode: 'included', ivaRatePercent: 16, prices: PACK_CENTS } },
  ];
}

test('5a a settled credit pack fires one conversion; a replay does not', async () => {
  seedPackStore();
  const cents = PACK_CENTS.tokens_100k;
  const first = await settleOneOffCharge(packCharge('7001', cents), {});
  const replay = await settleOneOffCharge(packCharge('7001', cents), {});
  await drain();

  assert.equal(first.httpStatus, 200);
  assert.equal(replay.httpStatus, 200);
  assert.deepEqual(conversions(), [
    {
      name: 'conversion',
      props: {
        plan: 'pack',
        kind: 'pack',
        amount_mxn: cents / 100,
        interval: 'once',
        trial: false,
        plan_key: 'tokens_100k',
      },
    },
  ]);
  assert.equal(rows('token_pack_purchases').length, 1);
});

test('5b a pending, rejected or underpaid pack fires nothing', async () => {
  seedPackStore();
  const cents = PACK_CENTS.tokens_100k;
  await settleOneOffCharge(packCharge('7011', cents, 'pending'), {});
  await settleOneOffCharge(packCharge('7012', cents, 'rejected'), {});
  await settleOneOffCharge(packCharge('7013', cents - 100), {});
  await drain();

  assert.equal(conversions().length, 0);
  assert.equal(rows('token_pack_purchases').length, 0);
});

test('5c a pack the daily reconcile grants fires once; one the webhook granted does not', async () => {
  seedPackStore();
  const cents = PACK_CENTS.tokens_100k;
  const old = new Date(Date.now() - 60 * 60_000).toISOString();
  const row = (id: string) => ({
    mp_payment_id: id,
    user_id: USER,
    kind: 'pack',
    pack_id: 'tokens_100k',
    status: 'approved',
    amount_cents: cents,
    currency: 'MXN',
    refunded_cents: 0,
    created_at: old,
  });
  backend.tables.payments = [row('7002'), row('7003')];
  backend.tables.token_pack_purchases = [{ id: 'tpp-x', mp_payment_id: '7003' }];

  const first = await reconcilePackGrants(new Date());
  const again = await reconcilePackGrants(new Date());
  await drain();

  assert.deepEqual(first, { granted: 1, failed: 0 });
  assert.deepEqual(again, { granted: 0, failed: 0 });
  assert.equal(conversions().length, 1);
  assert.equal(conversions()[0]?.props.plan_key, 'tokens_100k');
  assert.equal(conversions()[0]?.props.amount_mxn, cents / 100);
});

test('6a an analytics endpoint that throws never fails or rolls back the charge', async () => {
  seedSubscription('pro_month');
  const at = charged('pro_month', 106);
  backend.analyticsThrows = true;

  const res = await recordAuthorizedPayment('106');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(backend.analyticsAttempts, 1, 'the conversion was attempted');
  assert.equal(rows('subscriptions')[0]?.last_charge_at, new Date(at).toISOString());
  assert.equal(rows('payments').find((p) => p.mp_payment_id === '9106')?.status, 'approved');

  seedPackStore();
  const settled = await settleOneOffCharge(packCharge('7006', PACK_CENTS.tokens_100k), {});
  await drain();
  assert.equal(settled.httpStatus, 200);
  assert.equal(backend.analyticsAttempts, 2);
  assert.equal(rows('token_pack_purchases').length, 1);
});

test('6b a failed "returning" lookup still sends the conversion, without the flag', async () => {
  seedSubscription('pro_month');
  charged('pro_month', 116);
  backend.failNext.push({ method: 'GET', table: 'subscriptions', filter: 'neq' });

  const res = await recordAuthorizedPayment('116');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(conversions().length, 1);
  assert.equal('returning' in (conversions()[0]?.props ?? {}), false);
});
