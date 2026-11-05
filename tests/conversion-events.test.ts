// Aldo 2026-11-05 "Count every first payment": the conversion fires once per first charge
// (trial or paid) and once per settled pack, through the real webhook code paths.

import test, { beforeEach } from 'node:test';
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
  backend.tables.profiles = [{ id: USER, email: 'buyer@example.com', tier: 'PRO', tier_ends_at: null }];
}

/** Mercado Pago's view after `charged` approved charges, the last one at `lastAt`. */
function mpState(planKey: PlanKey, charged: number, lastAt: string | null) {
  const amount = planPrice(planKey).totalCents / 100;
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

function mpCharge(apId: number, paymentId: number, planKey: PlanKey, debitAt: string) {
  backend.mp[`/authorized_payments/${apId}`] = {
    id: apId,
    preapproval_id: PRE,
    external_reference: `sub|${USER}|PRO`,
    transaction_amount: planPrice(planKey).totalCents / 100,
    currency_id: 'MXN',
    status: 'processed',
    date_created: debitAt,
    debit_date: debitAt,
    payment: { id: paymentId, status: 'approved' },
  };
}

const rows = (table: string) => backend.tables[table] ?? [];
const conversions = () => backend.events.filter((e) => e.name === 'conversion');

beforeEach(() => {
  backend.reset();
  preapproval = {};
});

test('1 a direct paid start (no trial) fires one conversion on its first charge', async () => {
  seedSubscription('pro_month');
  const at = iso(-1000);
  mpCharge(101, 9101, 'pro_month', at);
  mpState('pro_month', 1, at);

  const res = await recordAuthorizedPayment('101');
  await drain();

  assert.equal(res.ok, true);
  assert.deepEqual(conversions(), [
    {
      name: 'conversion',
      props: {
        plan: 'mensual',
        plan_key: 'pro_month',
        interval: 'month',
        amount_mxn: planPrice('pro_month').totalCents / 100,
        kind: 'subscription_first',
        trial: false,
        returning: false,
      },
    },
  ]);
  assert.equal(rows('subscriptions')[0]?.last_charge_at, new Date(at).toISOString());
});

test('2 a trial that converts still fires one conversion, marked as a trial', async () => {
  seedSubscription('pro_year', { trial_ends_at: iso(-2000) });
  const at = iso(-1000);
  mpCharge(102, 9102, 'pro_year', at);
  mpState('pro_year', 1, at);

  await recordAuthorizedPayment('102');
  await drain();

  const got = conversions();
  assert.equal(got.length, 1);
  assert.equal(got[0]?.props.plan, 'anual');
  assert.equal(got[0]?.props.interval, 'year');
  assert.equal(got[0]?.props.trial, true);
  assert.equal(got[0]?.props.kind, 'subscription_first');
  assert.equal(got[0]?.props.amount_mxn, planPrice('pro_year').totalCents / 100);
});

test('3 a renewal (second charge) fires nothing', async () => {
  seedSubscription('pro_month', { last_charge_at: iso(-30 * DAY) });
  const at = iso(-1000);
  mpCharge(103, 9103, 'pro_month', at);
  mpState('pro_month', 2, at);

  const res = await recordAuthorizedPayment('103');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(conversions().length, 0);
});

test('4 a replayed notification of the same charge does not fire twice', async () => {
  seedSubscription('pro_month');
  const at = iso(-1000);
  mpCharge(104, 9104, 'pro_month', at);
  mpState('pro_month', 1, at);

  await recordAuthorizedPayment('104');
  await recordAuthorizedPayment('104');
  // Two deliveries racing each other, as MP retries can.
  await Promise.all([recordAuthorizedPayment('104'), recordAuthorizedPayment('104')]);
  await drain();

  assert.equal(conversions().length, 1);
});

test('4 two first-time deliveries racing each other count the charge once', async () => {
  seedSubscription('pro_month');
  const at = iso(-1000);
  mpCharge(114, 9114, 'pro_month', at);
  mpState('pro_month', 1, at);

  await Promise.all([recordAuthorizedPayment('114'), recordAuthorizedPayment('114')]);
  await drain();

  assert.equal(conversions().length, 1);
});

test('4 the preapproval re-sync (webhook or cron) counts a missed first charge once', async () => {
  seedSubscription('pro_month');
  const at = iso(-1000);
  mpState('pro_month', 1, at);
  mpCharge(124, 9124, 'pro_month', at);

  // The re-sync sees MP's charge before its notification arrives.
  await syncSubscription(PRE);
  await syncSubscription(PRE);
  await recordAuthorizedPayment('124');
  await drain();

  const got = conversions();
  assert.equal(got.length, 1);
  assert.equal(got[0]?.props.kind, 'subscription_first');
  assert.equal(got[0]?.props.amount_mxn, planPrice('pro_month').totalCents / 100);
});

test('4 a plan change from a charged subscription is flagged returning', async () => {
  seedSubscription('pro_month');
  rows('subscriptions').push({
    id: 's-0',
    user_id: USER,
    mp_preapproval_id: 'pre-old',
    status: 'cancelled',
    last_charge_at: iso(-40 * DAY),
  });
  const at = iso(-1000);
  mpCharge(134, 9134, 'pro_month', at);
  mpState('pro_month', 1, at);

  await recordAuthorizedPayment('134');
  await drain();

  assert.equal(conversions().length, 1);
  assert.equal(conversions()[0]?.props.returning, true);
});

function packCharge(mpId: string, cents: number) {
  return {
    source: 'payment' as const,
    mpPaymentId: mpId,
    mpReference: mpId,
    status: 'approved' as const,
    amountMajor: cents / 100,
    paidAmountMajor: cents / 100,
    currency: 'MXN',
    externalReference: `pack_${USER}_tokens_100k`,
  };
}

function seedPackStore() {
  backend.tables.profiles = [{ id: USER, email: 'buyer@example.com', tier: 'FREE' }];
  backend.tables.app_settings = [
    { key: PACK_PRICES_SETTING, value: { ivaMode: 'included', ivaRatePercent: 16, prices: PACK_CENTS } },
  ];
}

test('5 a settled credit pack fires one conversion; a replay does not', async () => {
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
        plan_key: 'tokens_100k',
        interval: 'once',
        amount_mxn: cents / 100,
        kind: 'pack',
        trial: false,
      },
    },
  ]);
  assert.equal(rows('token_pack_purchases').length, 1);
});

test('5 a pack the daily reconcile grants fires once; one the webhook granted does not', async () => {
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
  assert.equal(conversions()[0]?.props.kind, 'pack');
});

test('6 a failing analytics call never fails or rolls back the charge', async () => {
  seedSubscription('pro_month');
  const at = iso(-1000);
  mpCharge(106, 9106, 'pro_month', at);
  mpState('pro_month', 1, at);
  backend.analyticsThrows = true;
  // The "returning" lookup fails too: the conversion path must swallow both.
  backend.failNext.push({ method: 'GET', table: 'subscriptions', filter: 'neq' });

  const res = await recordAuthorizedPayment('106');
  await drain();

  assert.equal(res.ok, true);
  assert.equal(rows('subscriptions')[0]?.last_charge_at, new Date(at).toISOString());
  const ledger = rows('payments').find((p) => p.mp_payment_id === '9106');
  assert.equal(ledger?.status, 'approved');
  assert.equal(conversions().length, 0);

  // A pack too: the grant stands.
  seedPackStore();
  const settled = await settleOneOffCharge(packCharge('7006', PACK_CENTS.tokens_100k), {});
  await drain();
  assert.equal(settled.httpStatus, 200);
  assert.equal(rows('token_pack_purchases').length, 1);
});
