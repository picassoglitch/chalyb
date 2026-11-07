// Aldo 2026-11-07 "make a real solution not just patching": Stripe as the gateway, through the
// real SDK against stripe-mock, real webhook signatures, and the billing code's own writers.

import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { installFakeBackend, drain, type FakeBackend } from './fakes/billing-backend';
import { startStripeProxy, stripeMockUp, type StripeProxy } from './fakes/stripe-proxy';
import { PACK_CENTS, planPrice } from '@/config/pricing';
import { PACK_PRICES_SETTING } from '@/config/pack-pricing';
import {
  isStripePaymentId,
  isStripeSubscriptionId,
  missingStripeConfig,
  paymentsProvider,
  stripeConfigProblems,
  stripeDeclineReason,
  stripeLookupKey,
  stripeStatusToPreapproval,
} from '@/lib/payments/stripe-config';
import { snapshotFromStripe } from '@/lib/payments/stripe-mapping';

const backend: FakeBackend = installFakeBackend();
process.env.STRIPE_SECRET_KEY = 'sk_test_123';
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.PAYMENTS_PROVIDER = 'stripe';

const up = await stripeMockUp();
if (!up && process.env.CI) throw new Error('stripe-mock is not reachable (STRIPE_MOCK_URL)');
const skip = up ? false : 'stripe-mock not running: docker run -p 12111:12111 stripe/stripe-mock';

const { setStripeClientForTests, stripePriceFor, ensureStripeCustomer } = await import(
  '@/lib/payments/stripe'
);
const { createStripeSubscription, confirmStripeStart, confirmOrReadBack, readConfirmationToken } = await import(
  '@/lib/billing/stripe-start'
);
const { finalizeStripeStart } = await import('@/lib/billing/start-subscription');
const { cancelPreapproval } = await import('@/lib/payments/subscription-sync');
const { holdCharges } = await import('@/lib/payments/gateway');
const { POST: webhook } = await import('@/app/api/stripe/webhook/route');
await import('@vercel/analytics/server');

const USER = '11111111-2222-3333-4444-555555555555';
const REF = `sub|${USER}|PRO`;
const PRO = planPrice('pro_month').totalCents;
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86_400;

let stripe: StripeProxy;
before(async () => {
  if (!up) return;
  stripe = await startStripeProxy();
  setStripeClientForTests(stripe.client);
});
after(async () => {
  setStripeClientForTests(null);
  await stripe?.close();
});
beforeEach(() => {
  backend.reset();
  stripe?.reset();
  backend.tables.profiles = [{ id: USER, email: 'buyer@example.com', tier: 'FREE', tier_ends_at: null }];
});

const rows = (t: string) => backend.tables[t] ?? [];

/** stripe-mock's subscription, made into one of ours. */
function subscription(id: string, over: Record<string, unknown> = {}) {
  return (body: Record<string, unknown>): Record<string, unknown> => {
    const items = body.items as { data: Record<string, unknown>[] };
    const item = items.data[0]!;
    item.price = { ...(item.price as object), unit_amount: PRO, currency: 'mxn', product: 'chalyb_pro' };
    item.current_period_end = now() + 30 * DAY;
    return {
      ...body,
      id,
      status: 'active',
      created: now() - DAY,
      currency: 'mxn',
      default_payment_method: 'pm_card',
      pause_collection: null,
      pending_setup_intent: null,
      trial_end: null,
      // What Stripe reports as the last paid charge: our sync backfills from it.
      latest_invoice: {
        id: 'in_last',
        status: 'paid',
        amount_paid: PRO,
        created: now() - DAY,
        status_transitions: { paid_at: now() - DAY },
      },
      metadata: { external_reference: REF, user_id: USER, plan_key: 'pro_month' },
      ...over,
    };
  };
}

function seedRow(id: string, over: Record<string, unknown> = {}) {
  (backend.tables.subscriptions ??= []).push({
    id: `s-${id}`,
    user_id: USER,
    tier: 'PRO',
    plan_key: 'pro_month',
    mp_preapproval_id: id,
    external_reference: REF,
    status: 'pending',
    amount_cents: PRO,
    started_at: new Date().toISOString(),
    first_charge_at: new Date().toISOString(),
    trial_ends_at: null,
    last_charge_at: null,
    charge_hold_until: null,
    reminder_delivered_at: null,
    consent_id: 'consent-1',
    card_last4: '4242',
    ...over,
  });
}

async function deliver(type: string, object: Record<string, unknown>, secret = 'whsec_test_secret') {
  const payload = JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    type,
    data: { object },
    api_version: '2026-09-30.endive',
    created: now(),
  });
  const header = stripe.client.webhooks.generateTestHeaderString({ payload, secret });
  const res = await webhook(
    new Request('https://www.chalyb.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': header, 'content-type': 'application/json' },
      body: payload,
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// ── Pure rules ─────────────────────────────────────────────────────────────

test('provider stays Mercado Pago unless PAYMENTS_PROVIDER says stripe', () => {
  assert.equal(paymentsProvider({}), 'mercadopago');
  assert.equal(paymentsProvider({ PAYMENTS_PROVIDER: 'Stripe ' }), 'stripe');
  assert.equal(paymentsProvider({ PAYMENTS_PROVIDER: 'paypal' }), 'mercadopago');
});

test('Stripe config: all three keys required, mixed or swapped keys named', () => {
  assert.deepEqual(missingStripeConfig({}), [
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
  ]);
  const ok = { STRIPE_SECRET_KEY: 'sk_live_a1', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_b2', STRIPE_WEBHOOK_SECRET: 'whsec_c' };
  assert.deepEqual(stripeConfigProblems(ok), []);
  assert.equal(stripeConfigProblems({ ...ok, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_b2' }).length, 1);
  assert.equal(stripeConfigProblems({ ...ok, STRIPE_SECRET_KEY: 'pk_live_x' }).length, 1);
  assert.equal(
    stripeConfigProblems({ ...ok, STRIPE_SECRET_KEY: 'sk_test_a', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_b', VERCEL_ENV: 'production' }).length,
    1,
  );
});

test('ids tell the gateway; statuses map to the preapproval vocabulary', () => {
  assert.ok(isStripeSubscriptionId('sub_1') && !isStripeSubscriptionId('2c938084a1b2'));
  assert.ok(isStripePaymentId('pi_1') && !isStripePaymentId('12345'));
  assert.equal(stripeStatusToPreapproval('incomplete'), 'pending');
  assert.equal(stripeStatusToPreapproval('past_due'), 'authorized');
  assert.equal(stripeStatusToPreapproval('active', true), 'paused');
  assert.equal(stripeStatusToPreapproval('unpaid'), 'paused');
  assert.equal(stripeStatusToPreapproval('incomplete_expired'), 'cancelled');
  assert.equal(stripeDeclineReason('fraudulent'), 'risk');
  assert.equal(stripeDeclineReason('insufficient_funds'), 'funds');
  assert.equal(stripeDeclineReason('expired_card'), 'card_data');
  assert.equal(stripeDeclineReason('generic_decline'), 'bank');
  assert.equal(stripeLookupKey('pro_month', 'month', PRO), `chalyb_pro_month_month_${PRO}_mxn`);
});

test('a trial without its card yet grants nothing; its expiry ends nothing', () => {
  const s = snapshotFromStripe({
    id: 'sub_t',
    status: 'trialing',
    trial_end: now() + 7 * DAY,
    default_payment_method: null,
    items: { data: [{ current_period_end: now() + 7 * DAY, price: { unit_amount: PRO, currency: 'mxn' } }] },
    metadata: { external_reference: REF },
    latest_invoice: null,
    created: now(),
  } as never);
  assert.equal(s.status, 'pending');
  assert.equal(s.neverActivated, true);
});

// ── Catalog and customer, real SDK → stripe-mock ───────────────────────────

test('the plan price is looked up by lookup_key, created once in MXN with IVA inside', { skip }, async () => {
  stripe.on('GET', /^\/v1\/prices$/, (b) => ({ ...b, data: [] }));
  const first = await stripePriceFor('pro_month');
  const again = await stripePriceFor('pro_month');
  assert.equal(first.id, again.id);
  const created = stripe.calls('POST', /^\/v1\/prices$/);
  assert.equal(created.length, 1, 'cached after the first create');
  assert.equal(created[0]!.form.unit_amount, String(PRO));
  assert.equal(created[0]!.form.currency, 'mxn');
  assert.equal(created[0]!.form.tax_behavior, 'inclusive');
  assert.equal(created[0]!.form.lookup_key, stripeLookupKey('pro_month', 'month', PRO));
  assert.equal(created[0]!.form['recurring[interval]'], 'month');
});

test('one Stripe customer per user, kept in stripe_customers', { skip }, async () => {
  const id = await ensureStripeCustomer({ id: USER, email: 'buyer@example.com' });
  const again = await ensureStripeCustomer({ id: USER, email: 'buyer@example.com' });
  assert.equal(id, again);
  assert.equal(stripe.calls('POST', /^\/v1\/customers$/).length, 1);
  assert.equal(stripe.calls('POST', /^\/v1\/customers$/)[0]!.idempotencyKey, `chalyb-customer-${USER}`);
  assert.deepEqual(rows('stripe_customers').map((r) => r.user_id), [USER]);
});

// ── Starting a subscription ────────────────────────────────────────────────

test('a subscription is created incomplete, card-only, with our reference and trial end', { skip }, async () => {
  const chargeAt = now() + 7 * DAY;
  await createStripeSubscription({
    user: { id: USER, email: 'buyer@example.com', name: null },
    planKey: 'pro_month',
    reference: REF,
    firstChargeAt: chargeAt,
    confirmationToken: 'ctoken_1',
    meta: { m: 'trial', ts: 0, sm: 0, fp: 'h', ss: '' },
  });
  const [call] = stripe.calls('POST', /^\/v1\/subscriptions$/);
  assert.ok(call && call.status === 200, 'stripe-mock accepted the params');
  assert.equal(call.form.payment_behavior, 'default_incomplete');
  assert.equal(call.form['payment_settings[save_default_payment_method]'], 'on_subscription');
  assert.equal(call.form['payment_settings[payment_method_types][0]'], 'card');
  assert.equal(call.form.trial_end, String(chargeAt));
  assert.equal(call.form['metadata[external_reference]'], REF);
  assert.equal(call.idempotencyKey, `chalyb-sub-${USER}-ctoken_1`);
});

test('the card is read from the ConfirmationToken; its fingerprint is hashed', { skip }, async () => {
  stripe.on('GET', /^\/v1\/confirmation_tokens\//, (b) => ({
    ...b,
    payment_method_preview: { type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2031, fingerprint: 'FP1' } },
  }));
  const card = await readConfirmationToken('ctoken_1');
  assert.deepEqual(card, {
    brand: 'visa',
    last4: '4242',
    expMonth: 4,
    expYear: 2031,
    fingerprint: createHash('sha256').update('stripe|FP1').digest('hex'),
  });
});

test('first payment: succeeded, 3DS wanted, or declined with its reason', { skip }, async () => {
  const sub = {
    id: 'sub_p',
    status: 'incomplete',
    pending_setup_intent: null,
    latest_invoice: { payments: { data: [] }, confirmation_secret: { client_secret: 'pi_abc_secret_xyz' } },
  } as never;
  for (const [pi, want] of [
    [{ status: 'succeeded' }, { kind: 'succeeded' }],
    [{ status: 'requires_action', client_secret: 'pi_abc_secret_xyz' }, { kind: 'action', clientSecret: 'pi_abc_secret_xyz' }],
    [{ status: 'requires_payment_method', last_payment_error: { decline_code: 'insufficient_funds' } }, { kind: 'declined', decline: 'funds' }],
  ] as const) {
    stripe.reset();
    stripe.on('POST', /^\/v1\/payment_intents\/pi_abc\/confirm$/, (b) => ({ ...b, ...pi }));
    assert.deepEqual(await confirmStripeStart(sub, 'ctoken_1'), want);
    assert.equal(stripe.calls('POST', /confirm$/)[0]!.form.confirmation_token, 'ctoken_1');
  }
});

test('a trial confirms its card setup and makes that card the subscription’s', { skip }, async () => {
  stripe.on('POST', /^\/v1\/setup_intents\/seti_1\/confirm$/, (b) => ({ ...b, status: 'succeeded', payment_method: 'pm_9' }));
  const out = await confirmStripeStart(
    { id: 'sub_t', status: 'trialing', pending_setup_intent: { id: 'seti_1' } } as never,
    'ctoken_1',
  );
  assert.deepEqual(out, { kind: 'succeeded' });
  assert.equal(stripe.calls('POST', /^\/v1\/subscriptions\/sub_t$/)[0]!.form.default_payment_method, 'pm_9');
});

// ── Webhook: signature, then the same writers as Mercado Pago ──────────────

test('webhook: a bad signature is 400 and writes nothing', { skip }, async () => {
  const res = await deliver('customer.subscription.updated', { id: 'sub_x' }, 'whsec_wrong');
  assert.equal(res.status, 400);
  assert.equal(rows('subscriptions').length, 0);
});

test('webhook: no secret configured is 500 so Stripe retries', { skip }, async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  try {
    const res = await deliver('customer.subscription.updated', { id: 'sub_x' });
    assert.equal(res.status, 500);
  } finally {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  }
});

test('webhook: an active subscription grants its tier, row marked stripe', { skip }, async () => {
  seedRow('sub_a');
  stripe.on('GET', /^\/v1\/subscriptions\/sub_a$/, subscription('sub_a'));
  const res = await deliver('customer.subscription.updated', { id: 'sub_a' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const row = rows('subscriptions')[0]!;
  assert.equal(row.status, 'authorized');
  assert.equal(row.provider, 'stripe');
  assert.equal(row.amount_cents, PRO);
  assert.equal(rows('profiles')[0]!.tier, 'PRO');
  assert.equal(rows('profiles')[0]!.tier_ends_at, null);
});

test('webhook: a price that is not the plan’s grants nothing', { skip }, async () => {
  seedRow('sub_m');
  stripe.on('GET', /^\/v1\/subscriptions\/sub_m$/, (b) => {
    const s = subscription('sub_m')(b);
    (s.items as { data: { price: { unit_amount: number } }[] }).data[0]!.price.unit_amount = 100;
    return s;
  });
  const res = await deliver('customer.subscription.updated', { id: 'sub_m' });
  assert.equal(res.status, 200);
  assert.equal(rows('subscriptions')[0]!.status, 'amount_mismatch');
  assert.equal(rows('profiles')[0]!.tier, 'FREE');
});

function invoice(id: string, sub: string, pi: string, paid: boolean) {
  return (b: Record<string, unknown>) => ({
    ...b,
    id,
    status: paid ? 'paid' : 'open',
    amount_paid: paid ? PRO : 0,
    amount_due: PRO,
    currency: 'mxn',
    created: now(),
    attempt_count: 1,
    next_payment_attempt: paid ? null : now() + 3 * DAY,
    status_transitions: { ...(b.status_transitions as object), paid_at: paid ? now() : null },
    parent: { type: 'subscription_details', quote_details: null, subscription_details: { subscription: sub, metadata: { external_reference: REF } } },
    payments: { object: 'list', data: [{ payment: { type: 'payment_intent', payment_intent: pi } }] },
  });
}

test('webhook: invoice.paid lands once in payments under its PaymentIntent, IVA split', { skip }, async () => {
  seedRow('sub_w', { status: 'authorized' });
  stripe.on('GET', /^\/v1\/invoices\/in_1$/, invoice('in_1', 'sub_w', 'pi_w1', true));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_w$/, subscription('sub_w'));
  const first = await deliver('invoice.paid', { id: 'in_1' });
  const replay = await deliver('invoice.paid', { id: 'in_1' });
  await drain();
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(replay.status, 200);
  const pays = rows('payments');
  assert.equal(pays.length, 1);
  assert.equal(pays[0]!.mp_payment_id, 'pi_w1');
  assert.equal(pays[0]!.provider, 'stripe');
  assert.equal(pays[0]!.status, 'approved');
  assert.equal(pays[0]!.amount_cents, PRO);
  assert.equal(pays[0]!.iva_cents, PRO - Math.round((PRO * 100) / 116));
  assert.ok(rows('subscriptions')[0]!.last_charge_at, 'the charge is recorded on the subscription');
});

test('webhook: a failed renewal is recorded and opens the grace window', { skip }, async () => {
  seedRow('sub_f', { status: 'authorized', last_charge_at: new Date(Date.now() - 31 * DAY * 1000).toISOString() });
  backend.tables.profiles![0]!.tier = 'PRO';
  stripe.on('GET', /^\/v1\/invoices\/in_2$/, invoice('in_2', 'sub_f', 'pi_f1', false));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_f$/, subscription('sub_f', { status: 'past_due' }));
  // The pastDue notice after these writes needs Next's i18n runtime (getTranslations), absent
  // under node:test, so the answer isn't asserted here; the writes before it are.
  await deliver('invoice.payment_failed', { id: 'in_2' });
  assert.equal(rows('payments')[0]!.status, 'rejected');
  assert.equal(rows('payments')[0]!.mp_payment_id, 'pi_f1');
  const grace = rows('subscriptions')[0]!.grace_ends_at as string;
  assert.ok(grace && Date.parse(grace) > Date.now());
});

test('webhook: an unpaid checkout that expired never cuts access paid elsewhere', { skip }, async () => {
  const until = new Date(Date.now() + 10 * DAY * 1000).toISOString();
  backend.tables.profiles![0]!.tier = 'PRO';
  backend.tables.profiles![0]!.tier_ends_at = until;
  seedRow('sub_e');
  stripe.on('GET', /^\/v1\/subscriptions\/sub_e$/, subscription('sub_e', { status: 'incomplete_expired', default_payment_method: null }));
  const res = await deliver('customer.subscription.updated', { id: 'sub_e' });
  assert.equal(res.status, 200);
  assert.equal(rows('subscriptions')[0]!.status, 'cancelled');
  assert.equal(rows('profiles')[0]!.tier_ends_at, until);
});

test('webhook: a pack PaymentIntent grants its credits once', { skip }, async () => {
  backend.tables.app_settings = [
    { key: PACK_PRICES_SETTING, value: { ivaMode: 'included', ivaRatePercent: 16, prices: PACK_CENTS } },
  ];
  stripe.on('GET', /^\/v1\/payment_intents\/pi_pack$/, (b) => ({
    ...b,
    id: 'pi_pack',
    status: 'succeeded',
    amount: PACK_CENTS.tokens_100k,
    amount_received: PACK_CENTS.tokens_100k,
    currency: 'mxn',
    latest_charge: null,
    metadata: { external_reference: `pack_${USER}_tokens_100k`, user_id: USER, pack_id: 'tokens_100k' },
  }));
  const a = await deliver('payment_intent.succeeded', { id: 'pi_pack' });
  const b = await deliver('payment_intent.succeeded', { id: 'pi_pack' });
  await drain();
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200);
  assert.equal(rows('token_pack_purchases').length, 1);
  assert.equal(rows('payments')[0]!.kind, 'pack');
});

test('webhook: a subscription charge’s PaymentIntent is left to the invoice events', { skip }, async () => {
  stripe.on('GET', /^\/v1\/payment_intents\/pi_sub$/, (b) => ({ ...b, id: 'pi_sub', metadata: {} }));
  const res = await deliver('payment_intent.succeeded', { id: 'pi_sub' });
  assert.equal(res.status, 200);
  assert.equal(rows('payments').length, 0);
});

// ── Cancel, hold, finalize ─────────────────────────────────────────────────

test('cancel goes to Stripe for a sub_ id, and not twice for an ended one', { skip }, async () => {
  stripe.on('GET', /^\/v1\/subscriptions\/sub_c$/, subscription('sub_c'));
  await cancelPreapproval('sub_c');
  assert.equal(stripe.calls('DELETE', /^\/v1\/subscriptions\/sub_c$/).length, 1);
  stripe.reset();
  stripe.on('GET', /^\/v1\/subscriptions\/sub_c$/, subscription('sub_c', { status: 'canceled' }));
  await cancelPreapproval('sub_c');
  assert.equal(stripe.calls('DELETE', /^\/v1\/subscriptions\/sub_c$/).length, 0);
});

test('a notice hold moves the Stripe billing date and is confirmed by Stripe', { skip }, async () => {
  const until = new Date(Date.now() + 6 * DAY * 1000);
  const target = Math.ceil(until.getTime() / 1000);
  stripe.on('POST', /^\/v1\/subscriptions\/sub_h$/, (b) => ({ ...b, trial_end: target }));
  assert.equal(await holdCharges('sub_h', until), true);
  assert.equal(stripe.calls('POST', /sub_h$/)[0]!.form.trial_end, String(target));
  assert.equal(stripe.calls('POST', /sub_h$/)[0]!.form.proration_behavior, 'none');
});

test('finalize after 3DS runs once: a second call refunds nothing', { skip }, async () => {
  seedRow('sub_fin', { status: 'pending' });
  backend.tables.profiles![0]!.tier = 'PRO';
  const meta = { m: 'change', ts: 0, sm: 0, fp: '', ss: '', rp: 'pi_old', rc: 5000 };
  stripe.on('GET', /^\/v1\/subscriptions\/sub_fin$/, subscription('sub_fin', {
    metadata: { external_reference: REF, user_id: USER, plan_key: 'pro_month', chalyb_start: JSON.stringify(meta) },
  }));
  const session = { user: { id: USER, email: 'buyer@example.com', user_metadata: {} }, role: 'USER' } as never;
  const first = await finalizeStripeStart(session, 'sub_fin');
  const second = await finalizeStripeStart(session, 'sub_fin');
  await drain();
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(second.ok, true);
  const refunds = stripe.calls('POST', /^\/v1\/refunds$/);
  assert.equal(refunds.length, 1, 'one refund across both calls');
  assert.equal(refunds[0]!.form.payment_intent, 'pi_old');
  assert.equal(refunds[0]!.form.amount, '5000');
  assert.equal(refunds[0]!.idempotencyKey, 'proration-sub_fin');
  assert.ok(rows('subscriptions')[0]!.start_finalized_at);
  assert.equal(rows('subscriptions')[0]!.status, 'authorized');
});

test('finalize refuses someone else’s subscription', { skip }, async () => {
  seedRow('sub_other', { user_id: 'someone-else' });
  const session = { user: { id: USER, email: 'buyer@example.com', user_metadata: {} }, role: 'USER' } as never;
  const out = await finalizeStripeStart(session, 'sub_other');
  assert.deepEqual(out, { ok: false, code: 'NOT_FOUND' });
  assert.equal(stripe.seen.length, 0);
});

// ── Review round 1 ─────────────────────────────────────────────────────────

test('a confirm that errors after charging is read back, never cancelled', { skip }, async () => {
  stripe.on('POST', /^\/v1\/payment_intents\/pi_t\/confirm$/, () => ({ __status: 500, error: { type: 'api_error', message: 'upstream timeout' } }));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_t500$/, subscription('sub_t500'));
  const sub = {
    id: 'sub_t500',
    status: 'incomplete',
    pending_setup_intent: null,
    latest_invoice: { payments: { data: [] }, confirmation_secret: { client_secret: 'pi_t_secret_1' } },
  } as never;
  assert.deepEqual(await confirmOrReadBack(sub, 'ctoken_1'), { kind: 'succeeded' });
  assert.equal(stripe.calls('DELETE', /sub_t500/).length, 0);
});

test('a confirm error with Stripe still unreadable answers unknown (null)', { skip }, async () => {
  stripe.on('POST', /^\/v1\/payment_intents\/pi_u\/confirm$/, () => ({ __status: 500, error: { type: 'api_error', message: 'upstream timeout' } }));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_u$/, () => ({ __status: 503, error: { type: 'api_error', message: 'unavailable' } }));
  const sub = {
    id: 'sub_u',
    status: 'incomplete',
    pending_setup_intent: null,
    latest_invoice: { payments: { data: [] }, confirmation_secret: { client_secret: 'pi_u_secret_1' } },
  } as never;
  assert.equal(await confirmOrReadBack(sub, 'ctoken_1'), null);
});

test('webhook: a new start’s first invoice failing never touches the plan the buyer has', { skip }, async () => {
  backend.tables.profiles![0]!.tier = 'PRO';
  seedRow('sub_new');
  stripe.on('GET', /^\/v1\/invoices\/in_new$/, (b) => ({
    ...invoice('in_new', 'sub_new', 'pi_new', false)(b),
    billing_reason: 'subscription_create',
  }));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_new$/, subscription('sub_new', { status: 'incomplete', latest_invoice: null }));
  const res = await deliver('invoice.payment_failed', { id: 'in_new' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(rows('profiles')[0]!.tier_ends_at, null);
  assert.equal(rows('subscriptions')[0]!.grace_ends_at ?? null, null);
  assert.equal(rows('payments').length, 0);
});

test('webhook: a paid 3DS start the page never finalized is finished once by the webhook', { skip }, async () => {
  seedRow('sub_wh');
  const meta = { m: 'change', ts: 0, sm: 0, fp: 'fp-hash', ss: '', rp: 'pi_prev', rc: 3000 };
  stripe.on('GET', /^\/v1\/subscriptions\/sub_wh$/, subscription('sub_wh', {
    metadata: { external_reference: REF, user_id: USER, plan_key: 'pro_month', chalyb_start: JSON.stringify(meta) },
  }));
  const a = await deliver('customer.subscription.updated', { id: 'sub_wh' });
  const b = await deliver('customer.subscription.updated', { id: 'sub_wh' });
  await drain();
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200);
  assert.ok(rows('subscriptions')[0]!.start_finalized_at);
  assert.equal(stripe.calls('POST', /^\/v1\/refunds$/).length, 1);
  assert.deepEqual(rows('payment_method_fingerprints').map((r) => r.hash), ['fp-hash']);
});

// Codex P1 (2026-11-07): a failure event delivered after the retry paid is stale.
test('webhook: a late failure event for an invoice that has since been paid changes nothing', { skip }, async () => {
  seedRow('sub_late', { status: 'authorized' });
  backend.tables.profiles![0]!.tier = 'PRO';
  stripe.on('GET', /^\/v1\/invoices\/in_late$/, invoice('in_late', 'sub_late', 'pi_late', true));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_late$/, subscription('sub_late'));
  const paid = await deliver('invoice.paid', { id: 'in_late' });
  const late = await deliver('invoice.payment_failed', { id: 'in_late' });
  const lateAction = await deliver('invoice.payment_action_required', { id: 'in_late' });
  await drain();
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(late.status, 200, JSON.stringify(late.body));
  assert.equal(lateAction.status, 200);
  const pays = rows('payments');
  assert.equal(pays.length, 1);
  assert.equal(pays[0]!.status, 'approved');
  assert.equal(rows('subscriptions')[0]!.grace_ends_at ?? null, null);
  assert.equal(rows('profiles')[0]!.tier, 'PRO');
  assert.equal(rows('profiles')[0]!.tier_ends_at, null);
});

test('webhook: a late paid event for an invoice that is still open writes no charge', { skip }, async () => {
  seedRow('sub_open', { status: 'authorized' });
  stripe.on('GET', /^\/v1\/invoices\/in_open$/, invoice('in_open', 'sub_open', 'pi_open', false));
  stripe.on('GET', /^\/v1\/subscriptions\/sub_open$/, subscription('sub_open'));
  const res = await deliver('invoice.paid', { id: 'in_open' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(rows('payments').length, 0);
});
