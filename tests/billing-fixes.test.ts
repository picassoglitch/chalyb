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
  assert.match(body, /const idempotencyKey = refundIdempotencyKey\(/);
  assert.match(body, /const mp = getMercadoPagoIsolated\(\);[\s\S]*?mp\.refund\.create\(\{[\s\S]*?requestOptions: \{ idempotencyKey \}/);
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

// ── #6 · Notices show what will actually be charged ──────────────────
test('#6 the next charge amount: grandfathered price, Lealtad step, else the plan price', async () => {
  const { nextChargeCents, lealtadPriceCents, planPrice } = await import('@/config/pricing');
  assert.equal(nextChargeCents({ plan_key: 'pro_month', amount_cents: 74_900 }), 74_900);
  assert.equal(nextChargeCents({ plan_key: 'pro_month', amount_cents: null }), planPrice('pro_month').totalCents);
  assert.equal(nextChargeCents({ plan_key: 'vip_year', amount_cents: 0 }), planPrice('vip_year').totalCents);
  // Lealtad: always its step, whatever the preapproval still says.
  assert.equal(nextChargeCents({ plan_key: 'pro_lealtad', loyalty_step: 4, amount_cents: 166_200 }), lealtadPriceCents(4));

  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const cron = read('src/app/api/cron/billing/route.ts');
  // Both the email and the in-app copy of a notice.
  assert.equal(cron.match(/monto: formatMXN\(nextChargeCents\(\{ \.\.\.row, plan_key: planKey \}\)\)/g)?.length, 2);
  assert.doesNotMatch(cron, /monto: formatMXN\(price\.totalCents\)/);
  assert.match(read('src/components/app/billing/billing-banner.tsx'), /nextChargeCents\(\{/);
  assert.match(read('src/components/app/billing/mi-plan-view.tsx'), /nextChargeCents\(\{/);
});

// ── #7 · Trial: first-time customers only, one per card, fail closed ──
test('#7 a card we cannot fingerprint gets no trial; a card used elsewhere neither', async () => {
  const { trialCardCheck } = await import('@/lib/billing/trial-eligibility');
  const base = { userId: 'u1', seenUserId: null };
  assert.deepEqual(trialCardCheck({ ...base, mode: 'trial', fingerprint: null }), { ok: false, code: 'CARD_UNVERIFIED' });
  assert.deepEqual(trialCardCheck({ ...base, mode: 'trial', fingerprint: 'h', seenUserId: 'u2' }), { ok: false, code: 'CARD_TRIAL_USED' });
  assert.deepEqual(trialCardCheck({ ...base, mode: 'trial', fingerprint: 'h', seenUserId: 'u1' }), { ok: true });
  assert.deepEqual(trialCardCheck({ ...base, mode: 'trial', fingerprint: 'h' }), { ok: true });
  // Paid starts and changes don't need the fingerprint.
  assert.deepEqual(trialCardCheck({ ...base, mode: 'paid', fingerprint: null }), { ok: true });
  assert.deepEqual(trialCardCheck({ ...base, mode: 'change', fingerprint: null }), { ok: true });
});

test('#7 a returning customer (any charged plan) has used the trial', async () => {
  const { trialUsedFrom } = await import('@/lib/billing/trial-eligibility');
  const none = { trialStartedAt: null, prepaymentRequired: false, chargedBefore: false };
  assert.equal(trialUsedFrom(none), false);
  assert.equal(trialUsedFrom({ ...none, chargedBefore: true }), true);
  assert.equal(trialUsedFrom({ ...none, trialStartedAt: '2026-01-01T00:00:00Z' }), true);
  assert.equal(trialUsedFrom({ ...none, prepaymentRequired: true }), true);

  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const store = read('src/lib/billing/subscription-store.ts');
  assert.match(store, /trialUsed: trialUsedFrom\(\{[\s\S]*?chargedBefore:/);
  const start = read('src/lib/billing/start-subscription.ts');
  // Every card is fingerprinted at start, not only trial cards.
  assert.match(start, /\n  if \(fp\)\n    await admin\n      \.from\('payment_method_fingerprints'\)/);
  // Fail closed: the check runs on a null fingerprint too.
  assert.match(start, /trialCardCheck\(\{ mode, fingerprint: fp, seenUserId: undefined, userId \}\)/);
  assert.match(read('src/lib/billing/api.ts'), /case 'CARD_UNVERIFIED':/);
  assert.match(read('src/components/app/billing/pay-form.tsx'), /t\('cardUnverified'\)/);
});

// ── #9 · A never-charged paid start or change has a deadline ─────────
test('#9 a paid start whose first charge never lands ends after graceDays', async () => {
  const { PRICING } = await import('@/config/pricing');
  const first = '2026-10-04T12:00:00.000Z';
  const r = row({ plan_key: 'pro_month', first_charge_at: first, next_charge_at: '2026-10-09T12:00:00.000Z' });
  const deadline = new Date(Date.parse(first) + PRICING.graceDays * DAY).toISOString();
  assert.deepEqual(unpaidCharge(r), { dueAt: first, deadline });
  // MP still 'authorized' (retrying), next_payment_date moved: no Pro after the deadline.
  assert.equal(deriveBillingState(r, Date.parse(deadline) - 1).grantsTier, 'PRO');
  assert.equal(deriveBillingState(r, Date.parse(deadline)).state, 'free');
  // The charge landed: renewal rules take over.
  assert.equal(deriveBillingState({ ...r, last_charge_at: '2026-10-05T00:00:00.000Z' }, Date.parse(deadline) + DAY).state, 'pro');
  // A plan change starting later: due on its change date.
  const later = row({ plan_key: 'pro_month', first_charge_at: '2026-11-01T00:00:00.000Z' });
  assert.equal(unpaidCharge(later)?.dueAt, '2026-11-01T00:00:00.000Z');
  // Rows from before 0057 (no first_charge_at) keep today's behaviour.
  assert.equal(unpaidCharge(row({ plan_key: 'pro_month' })), null);

  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  assert.match(read('src/lib/billing/start-subscription.ts'), /first_charge_at: dates\.chargeAt\.toISOString\(\)/);
  assert.match(read('supabase/migrations/0057_subscription_first_charge.sql'), /add column if not exists first_charge_at timestamptz/);
  for (const f of ['src/lib/billing/subscription-store.ts', 'src/app/api/cron/billing/route.ts', 'src/lib/payments/subscription-sync.ts'])
    assert.match(read(f), /first_charge_at/, f);
});

// ── #10 · Orders API payments: refunds, disputes, unreadable responses ─
test('#10 Orders payments refund through their order; disputes find them by reference_id', async () => {
  const { isOrderPaymentId, ledgerStatus, orderStatusToChargeStatus } = await import('@/lib/payments/order-charge');
  assert.equal(isOrderPaymentId('PAY01JEVQM899NWDRXXGXZG1XE5R7'), true);
  assert.equal(isOrderPaymentId('123456789'), false);
  // An unmapped status never overwrites a known one.
  assert.equal(ledgerStatus('unknown', 'approved'), 'approved');
  assert.equal(ledgerStatus('unknown', null), 'unknown');
  assert.equal(ledgerStatus('refunded', 'approved'), 'refunded');
  assert.equal(orderStatusToChargeStatus('charged_back'), 'charged_back');
  assert.equal(orderStatusToChargeStatus('in_mediation'), 'in_mediation');

  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const disputes = read('src/lib/billing/disputes-server.ts');
  const refund = disputes.slice(disputes.indexOf('export async function issueRefund'));
  assert.match(refund, /isOrderPaymentId\(input\.mpPaymentId\)[\s\S]*?mp\.order\.refund\(\{[\s\S]*?transactions: \[\{ id: input\.mpPaymentId, amount: \(cents \/ 100\)\.toFixed\(2\) \}\][\s\S]*?idempotencyKey/);
  const cb = disputes.slice(disputes.indexOf('export async function onChargebackOpened'));
  assert.match(cb, /raw->transactions->payments->0->>reference_id/);
  // A dispute we can't place is a person's job, not a silent ok.
  assert.match(cb, /if \(!found\?\.user_id\) \{[\s\S]*?notify\(\{[\s\S]*?severity: 'critical'/);
  assert.match(read('src/lib/payments/one-off-settlement.ts'), /status: ledgerStatus\(status, previousStatus\)/);
});

test('#10 a refused charge is auto-refunded only when MP said what was paid and in what currency', async () => {
  const { autoRefundMismatch, checkCharge, expectedChargeForPack } = await import('@/lib/payments/webhook-verify');
  const expected = expectedChargeForPack('tokens_100k')!;
  const paid = (amountMajor: number | null, currency: string | null) => ({ amountMajor, currency });
  const refuse = (p: ReturnType<typeof paid>) => autoRefundMismatch(checkCharge(expected, p), p);
  assert.equal(refuse(paid(1, 'MXN')), true); // wrong amount: refunded
  assert.equal(refuse(paid(expected.amountCents / 100, 'USD')), true); // wrong currency, stated: refunded
  assert.equal(refuse(paid(expected.amountCents / 100, null)), false); // currency missing: never on a guess
  assert.equal(refuse(paid(null, 'MXN')), false);
  assert.equal(refuse(paid(expected.amountCents / 100, 'MXN')), false); // matches: nothing to refund
  const { readFileSync } = await import('node:fs');
  const settle = readFileSync(new URL('../src/lib/payments/one-off-settlement.ts', import.meta.url), 'utf8');
  assert.match(settle, /autoRefundMismatch\(check, paid\)/);
  // A failed automatic refund is raised, not swallowed.
  assert.match(settle, /if \(!refunded\.ok\) \{[\s\S]*?severity: 'critical'/);
});

// ── #11 · Dispute triage judges the disputed charge, on its own subscription ─
test('#11 an older grandfathered charge is not an overcharge after a newer price', async () => {
  const { chargeWasPriced } = await import('@/lib/payments/webhook-verify');
  const { planPrice, lealtadPriceCents } = await import('@/config/pricing');
  // Disputed $749 charge on a pro_month sub that now pays $997: priced right.
  assert.equal(chargeWasPriced({ chargedCents: 74_900, planKey: 'pro_month', tier: 'PRO' }), true);
  assert.equal(chargeWasPriced({ chargedCents: planPrice('pro_month').totalCents, planKey: 'pro_month', tier: 'PRO' }), true);
  // An amount the plan never charged: an overcharge (Términos §7.2(d)).
  assert.equal(chargeWasPriced({ chargedCents: 120_000, planKey: 'pro_month', tier: 'PRO' }), false);
  // Yearly plans were only ever sold at their price.
  assert.equal(chargeWasPriced({ chargedCents: 74_900, planKey: 'vip_year', tier: 'VIP' }), false);
  // Pro Lealtad: the step that charge paid for.
  assert.equal(chargeWasPriced({ chargedCents: lealtadPriceCents(2), planKey: 'pro_lealtad', tier: 'PRO', loyaltyStep: 2 }), true);
  assert.equal(chargeWasPriced({ chargedCents: lealtadPriceCents(0), planKey: 'pro_lealtad', tier: 'PRO', loyaltyStep: 2 }), false);

  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const disputes = read('src/lib/billing/disputes-server.ts');
  assert.match(disputes, /amountMismatch: priced === false/);
  assert.doesNotMatch(disputes, /expected !== cb\.amount_cents/);
});

test('#11 the payment topic never replaces (or nulls) a charge\'s subscription link', async () => {
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../src/app/api/mp/webhook/route.ts', import.meta.url), 'utf8');
  const branch = route.slice(route.indexOf('const subRef = parseSubscriptionReference(charge.externalReference);'));
  assert.doesNotMatch(branch, /mp_preapproval_id: \(sub\?\.mp_preapproval_id as string \| undefined\) \?\? null/);
  assert.match(branch, /\.\.\.\(knownPreapproval \|\| !guessedPreapproval \? \{\} : \{ mp_preapproval_id: guessedPreapproval \}\)/);
  assert.match(branch, /status: ledgerStatus\(charge\.status/);
});

// ── LOW · Chargeback measures have no effect while the flag is off ────
test('LOW restrictions are ignored while CHARGEBACK_MEASURES_ENABLED is off', async () => {
  const { readFileSync } = await import('node:fs');
  const store = readFileSync(new URL('../src/lib/billing/subscription-store.ts', import.meta.url), 'utf8');
  const fn = store.slice(store.indexOf('export async function accountRestrictions'));
  const flagAt = fn.indexOf('if (!chargebackMeasuresEnabled()) return restrictionState([]);');
  const readAt = fn.indexOf(".from('account_restrictions')");
  assert.ok(flagAt > 0 && flagAt < readAt, 'flag checked before any row is read');
  // Every reader goes through accountRestrictions (via loadBilling).
  assert.match(store, /accountRestrictions\(userId\),/);
});

// ── LOW · Generating the evidence package is a POST ──────────────────
test('LOW the evidence package is generated by POST only', async () => {
  const { readFileSync } = await import('node:fs');
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const route = read('src/app/api/admin/disputes/[id]/evidence/route.ts');
  assert.match(route, /export async function POST\(/);
  assert.doesNotMatch(route, /export async function GET\(/);
  const panel = read('src/components/dashboard/admin/disputes-panel.tsx');
  assert.match(panel, /<form method="post" action=\{`\/api\/admin\/disputes\/\$\{open\.id\}\/evidence`\}>/);
  assert.doesNotMatch(panel, /href=\{`\/api\/admin\/disputes\/\$\{open\.id\}\/evidence`\}/);
});
