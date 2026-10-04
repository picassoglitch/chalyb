// Fixes from the pre-ship billing review of PR #41 (one block per finding).

import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveBillingState, unpaidCharge, type SubscriptionRow } from '@/lib/billing/billing-state';

const DAY = 24 * 60 * 60 * 1000;

function row(over: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    status: 'authorized',
    tier: 'PRO',
    plan_key: 'pro_month',
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

// ── #1 · VIP anual renews yearly ─────────────────────────────────────
test('#1 a vip_year charge is due a year later, not a month', () => {
  const last = '2026-10-10T00:00:00.000Z';
  const r = row({ tier: 'VIP', plan_key: 'vip_year', last_charge_at: last });
  assert.equal(unpaidCharge(r)?.dueAt, '2027-10-10T00:00:00.000Z');
  assert.equal(deriveBillingState(r, Date.parse('2026-12-10T00:00:00Z')).state, 'pro');
  assert.equal(deriveBillingState(r, Date.parse('2026-12-10T00:00:00Z')).grantsTier, 'VIP');
});

// ── #2 · Pro Lealtad's pre-charge notice is a mandatory notice ───────
test('#2 the delivery of every mandatory notice email (incl. lealtad_7d) is recorded', async () => {
  const { MANDATORY_NOTICE_KINDS } = await import('@/lib/email/resend-webhook');
  const { noticeEmailKind } = await import('@/lib/billing/reminders');
  assert.equal(noticeEmailKind('renew_7d', 'pro_lealtad'), 'lealtad_7d');
  assert.equal(noticeEmailKind('renew_7d', 'pro_month'), 'renew_7d');
  assert.equal(noticeEmailKind('trial_7d', 'vip_year'), 'trial_7d');
  for (const kind of ['trial_7d', 'renew_7d', 'lealtad_7d']) assert.ok(MANDATORY_NOTICE_KINDS.has(kind), kind);
  for (const kind of ['trial_1d', 'renew_30d', 'annual_summary']) assert.ok(!MANDATORY_NOTICE_KINDS.has(kind), kind);
});

// ── #3 · The subscription price gate runs before our copy is written ─
test('#3 an authorised preapproval at an unpriced amount is stored non-granting', async () => {
  const { gatePreapproval } = await import('@/lib/payments/webhook-verify');
  const { planPrice, lealtadPriceCents } = await import('@/config/pricing');
  const base = { status: 'authorized', tier: 'VIP' as const, currency: 'MXN' };
  // $100 for VIP: refused, stored as amount_mismatch.
  const bad = gatePreapproval({ ...base, planKey: 'vip_month', amountMajor: 100 });
  assert.equal(bad.refused, true);
  assert.equal(bad.storedStatus, 'amount_mismatch');
  // Right amount: stored as Mercado Pago says.
  const ok = gatePreapproval({ ...base, planKey: 'vip_year', amountMajor: planPrice('vip_year').totalCents / 100 });
  assert.deepEqual(ok, { storedStatus: 'authorized', refused: false });
  // Wrong currency: refused.
  assert.equal(gatePreapproval({ ...base, planKey: 'vip_year', amountMajor: planPrice('vip_year').totalCents / 100, currency: 'USD' }).refused, true);
  // Pro Lealtad: any step of its schedule.
  assert.equal(gatePreapproval({ ...base, tier: 'PRO', planKey: 'pro_lealtad', amountMajor: lealtadPriceCents(3) / 100 }).refused, false);
  // Not authorised: nothing to gate.
  assert.deepEqual(gatePreapproval({ ...base, status: 'paused', planKey: 'vip_month', amountMajor: 100 }), { storedStatus: 'paused', refused: false });

  // The stored row grants nothing, even with a grace window open.
  const r = row({ status: 'amount_mismatch', tier: 'VIP', plan_key: 'vip_month', grace_ends_at: '2099-01-01T00:00:00Z', next_charge_at: '2000-01-01T00:00:00Z' });
  assert.equal(deriveBillingState(r, Date.now()).grantsTier, 'FREE');
  assert.equal(deriveBillingState({ ...r, grace_ends_at: null }, Date.now()).grantsTier, 'FREE');

  // And the sync decides the gate before the upsert, writing its status.
  const { readFileSync } = await import('node:fs');
  const sync = readFileSync(new URL('../src/lib/payments/subscription-sync.ts', import.meta.url), 'utf8');
  const gateAt = sync.indexOf('const gate = gatePreapproval(');
  const upsertAt = sync.indexOf("from('subscriptions').upsert(");
  assert.ok(gateAt > 0 && gateAt < upsertAt, 'gate before upsert');
  assert.match(sync.slice(upsertAt, upsertAt + 400), /status: gate\.storedStatus/);
});

// ── #4 · One refund, once ────────────────────────────────────────────
function fakeLedger(amountCents: number, refundedCents = 0) {
  const state = { amountCents, refundedCents };
  return {
    state,
    ledger: {
      async read() {
        // Yield, so two claims interleave their read and their swap.
        await new Promise((r) => setTimeout(r, 0));
        return { ...state };
      },
      async swap(_id: string, from: number, to: number) {
        await new Promise((r) => setTimeout(r, 0));
        if (state.refundedCents !== from) return false;
        state.refundedCents = to;
        return true;
      },
    },
  };
}

test('#4 two concurrent refunds of one charge reserve it once', async () => {
  const { claimRefund } = await import('@/lib/billing/disputes');
  const { state, ledger } = fakeLedger(16_700);
  const [a, b] = await Promise.all([claimRefund(ledger, 'p1', 16_700), claimRefund(ledger, 'p1', 16_700)]);
  const kinds = [a.kind, b.kind].sort();
  assert.deepEqual(kinds, ['claimed', 'nothing_left']);
  assert.equal(state.refundedCents, 16_700);
});

test('#4 partial refunds never exceed the charge; a refused one is released', async () => {
  const { claimRefund, releaseRefund } = await import('@/lib/billing/disputes');
  const { state, ledger } = fakeLedger(10_000, 7_000);
  const [a, b] = await Promise.all([claimRefund(ledger, 'p', 2_000), claimRefund(ledger, 'p', 2_000)]);
  assert.deepEqual([a, b].map((c) => (c.kind === 'claimed' ? c.cents : 0)).sort(), [1_000, 2_000]);
  assert.equal(state.refundedCents, 10_000);
  assert.equal(await releaseRefund(ledger, 'p', 2_000), true);
  assert.equal(state.refundedCents, 8_000);
});

test('#4 the idempotency key is deterministic per claim', async () => {
  const { refundIdempotencyKey } = await import('@/lib/billing/disputes');
  const k = { paymentId: '123', reason: 'legal_7_2_d', cents: 16_700, offset: 0 };
  assert.equal(refundIdempotencyKey(k), 'refund:123:legal_7_2_d:16700:0');
  assert.equal(refundIdempotencyKey(k), refundIdempotencyKey({ ...k }));
  assert.notEqual(refundIdempotencyKey(k), refundIdempotencyKey({ ...k, offset: 16_700 }));
});

test('#4 issueRefund claims before calling MP, on an isolated client with the key', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/lib/billing/disputes-server.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('export async function issueRefund'));
  const claimAt = body.indexOf('claimRefund(ledger');
  const mpAt = body.indexOf('refund.create(');
  assert.ok(claimAt > 0 && claimAt < mpAt, 'claim before the MP call');
  assert.match(body, /getMercadoPagoIsolated\(\)\.refund\.create\(\{[\s\S]*?idempotencyKey: refundIdempotencyKey/);
  assert.match(body, /releaseRefund\(ledger/);
  // No keyed call anywhere goes through the shared, cached client.
  for (const f of ['src/lib/payments/token-checkout-actions.ts', 'src/lib/billing/disputes-server.ts']) {
    const code = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /getMercadoPago\(\)[\s\S]{0,400}requestOptions/, f);
  }
});

// ── #5 · Replays: legacy plans granted once; stale signatures refused ─
test('#5 a legacy plan payment grants the tier only on its first move to approved', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/lib/payments/one-off-settlement.ts', import.meta.url), 'utf8');
  const prevAt = src.indexOf("const previousStatus =");
  const upsertAt = src.indexOf("from('payments').upsert(");
  assert.ok(prevAt > 0 && prevAt < upsertAt, 'previous status read before the row is written');
  const legacy = src.slice(src.indexOf('LEGACY TIER PURCHASE'));
  const guardAt = legacy.indexOf("if (status === 'approved' && previousStatus === 'approved')");
  const flipAt = legacy.indexOf('.update({ tier, tier_ends_at: null })');
  assert.ok(guardAt > 0 && guardAt < flipAt, 'replay guard before the tier flip');
  // A failed flip un-approves the row so MP's retry still grants.
  assert.match(legacy, /tierErr[\s\S]*?update\(\{ status: previousStatus \?\? 'pending' \}\)/);
});

test('#5 a validly signed but stale notification is refused', async () => {
  const { createHmac } = await import('node:crypto');
  const { checkMpSignature, signatureManifest, signatureTsMs, MP_SIGNATURE_MAX_SKEW_MS } = await import('@/lib/payments/webhook-verify');
  const secret = 's3cret';
  const now = Date.parse('2026-10-04T12:00:00Z');
  const sign = (ts: string) => {
    const v1 = createHmac('sha256', secret).update(signatureManifest({ dataId: '123', requestId: 'r', ts })).digest('hex');
    return { secret, paymentId: '123', requestId: 'r', signatureHeader: `ts=${ts},v1=${v1}`, nowMs: now };
  };
  assert.deepEqual(checkMpSignature(sign(String(now))), { ok: true });
  assert.deepEqual(checkMpSignature(sign(String(Math.floor(now / 1000)))), { ok: true }); // seconds
  assert.deepEqual(checkMpSignature(sign(String(now - MP_SIGNATURE_MAX_SKEW_MS - 1))), { ok: false, reason: 'stale' });
  assert.deepEqual(checkMpSignature(sign(String(now + MP_SIGNATURE_MAX_SKEW_MS + 1))), { ok: false, reason: 'stale' });
  assert.equal(signatureTsMs('1733520000'), 1_733_520_000_000);
  assert.equal(signatureTsMs('1733520000123'), 1_733_520_000_123);
  assert.equal(signatureTsMs('abc'), null);
  // The route checks freshness.
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../src/app/api/mp/webhook/route.ts', import.meta.url), 'utf8');
  assert.match(route, /checkMpSignature\(\{[\s\S]*?nowMs: Date\.now\(\)/);
});
