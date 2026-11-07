// QA 2026-11-06 — Pro/VIP set by the owner (no subscription) showed as Gratis in
// Mi plan and Planes while Mi cuenta showed the plan. Real pure code path, no mocks.

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEntitlements, type EntitlementInput } from '@/lib/billing/entitlement-core';
import { deriveBillingState, type SubscriptionRow } from '@/lib/billing/billing-state';
import { assignedPlan, miPlanMode } from '@/lib/billing/assigned-plan';
import { plansCta } from '@/lib/billing/plans-cta';
import { planLabelKey } from '@/lib/billing/plan-label';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const DAY = 86_400_000;

function entitlements(overrides: Partial<EntitlementInput>) {
  return computeEntitlements({
    userId: 'u1',
    role: 'CLIENT',
    storedTier: 'FREE',
    selectedEngineId: null,
    clipsTrialStartedAt: null,
    bonusCredits: 0,
    credits: null,
    engines: [],
    nowMs: NOW,
    flags: { freeIncludesClips: true, proIncludesAllTools: true },
    ...overrides,
  });
}

// What Mi plan and Planes compute from the same inputs Mi cuenta reads.
function surfaces(e: ReturnType<typeof entitlements>, billing = e.billing) {
  const assigned = assignedPlan({ isAdmin: e.isAdmin, plan: e.plan, billing });
  const cta = plansCta({
    signedIn: true,
    isAdmin: e.isAdmin,
    flow: true,
    annualOffered: true,
    vipYearOffered: true,
    trialUsed: false,
    billing,
    quebecBlocked: false,
    assigned,
  });
  return { assigned, mode: miPlanMode({ isAdmin: e.isAdmin, billing, assigned }), cta };
}

const NO_SUBSCRIPTION = deriveBillingState(null, NOW);

const PAYING_ROW: SubscriptionRow = {
  status: 'authorized',
  tier: 'PRO',
  plan_key: 'pro_month',
  trial_ends_at: null,
  next_charge_at: new Date(NOW + 10 * DAY).toISOString(),
  next_payment_date: new Date(NOW + 10 * DAY).toISOString(),
  grace_ends_at: null,
  cancel_at_period_end: false,
  card_brand: 'visa',
  card_last4: '4242',
  card_exp: '12/30',
  pending_plan_key: null,
  pending_effective_at: null,
  reminder_delivered_at: null,
  last_charge_at: new Date(NOW - 20 * DAY).toISOString(),
};

test('owner-assigned Pro, no subscription: Mi plan and Planes show Pro, no trial', () => {
  const e = entitlements({ storedTier: 'PRO', billing: NO_SUBSCRIPTION });
  assert.equal(planLabelKey(e.plan), 'pro'); // Mi cuenta
  const { assigned, mode, cta } = surfaces(e);
  assert.equal(assigned, 'PRO');
  assert.equal(mode, 'assigned'); // was the Gratis layout
  assert.deepEqual(cta.pro, { hrefYear: null, hrefMonth: null, label: 'current' });
  // No VIP trial and no checkout over a plan with no subscription.
  assert.deepEqual(cta.vip, { hrefYear: null, hrefMonth: null, label: 'up' });
  assert.deepEqual(cta.gratis, { href: '/app/billing', label: 'manage' });
});

test('owner-assigned VIP, no subscription: VIP is current, nothing sold', () => {
  const e = entitlements({ storedTier: 'VIP', billing: NO_SUBSCRIPTION });
  assert.equal(planLabelKey(e.plan), 'vip');
  const { assigned, mode, cta } = surfaces(e);
  assert.equal(assigned, 'VIP');
  assert.equal(mode, 'assigned');
  assert.deepEqual(cta.vip, { hrefYear: null, hrefMonth: null, label: 'current' });
  assert.equal(cta.pro.hrefYear, null);
  assert.equal(cta.pro.hrefMonth, null);
  assert.notEqual(cta.pro.label, 'trial');
});

test('PARTNER with no subscription reads as Pro', () => {
  const e = entitlements({ storedTier: 'PARTNER', billing: NO_SUBSCRIPTION });
  assert.equal(surfaces(e).assigned, 'PRO');
});

test('a real Free user is unchanged: Gratis layout, trial offered', () => {
  const e = entitlements({ storedTier: 'FREE', billing: NO_SUBSCRIPTION });
  const { assigned, mode, cta } = surfaces(e);
  assert.equal(assigned, null);
  assert.equal(mode, 'free');
  assert.equal(cta.pro.label, 'trial');
  assert.equal(cta.vip.label, 'trial');
  assert.deepEqual(cta.gratis, { href: null, label: 'current' });
});

test('a paying subscriber keeps the subscription view', () => {
  const billing = deriveBillingState(PAYING_ROW, NOW);
  assert.equal(billing.state, 'pro');
  const e = entitlements({ storedTier: 'PRO', billing });
  const { assigned, mode, cta } = surfaces(e);
  assert.equal(assigned, null);
  assert.equal(mode, 'subscription');
  assert.equal(cta.pro.label, 'current');
  assert.equal(cta.vip.label, 'up');
  assert.equal(cta.vip.hrefMonth, '/app/billing/cambiar?plan=vip_month');
});

test('admins keep their own view', () => {
  const e = entitlements({ role: 'ADMIN', storedTier: 'FREE', billing: NO_SUBSCRIPTION });
  const { assigned, mode } = surfaces(e);
  assert.equal(assigned, null);
  assert.equal(mode, 'admin');
});

test('a failed billing read is never shown as an assigned plan', () => {
  // getEntitlements falls back to the stored tier; that must not read "sin cobro".
  const e = entitlements({ storedTier: 'PRO', billing: null });
  const { assigned, mode } = surfaces(e, null);
  assert.equal(assigned, null);
  assert.equal(mode, 'free');
});

test('chargeback-suspended Pro: getEntitlements forces FREE, so not assigned', () => {
  // entitlement.ts passes storedTier FREE and billing null while paidSuspended.
  const e = entitlements({ storedTier: 'FREE', billing: null });
  assert.equal(planLabelKey(e.plan), 'gratis');
  assert.equal(assignedPlan({ isAdmin: false, plan: e.plan, billing: NO_SUBSCRIPTION }), null);
  assert.equal(miPlanMode({ isAdmin: false, billing: NO_SUBSCRIPTION, assigned: null }), 'free');
});

test('no assigned input: plansCta is unchanged for a Free user', () => {
  const base = {
    signedIn: true,
    isAdmin: false,
    flow: true,
    annualOffered: true,
    vipYearOffered: true,
    trialUsed: false,
    billing: NO_SUBSCRIPTION,
    quebecBlocked: false,
  };
  assert.deepEqual(plansCta(base), plansCta({ ...base, assigned: null }));
});
