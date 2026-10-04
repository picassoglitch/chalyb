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
