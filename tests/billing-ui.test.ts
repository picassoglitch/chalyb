import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBanner } from '@/lib/billing/banner';
import { plansCta } from '@/lib/billing/plans-cta';
import type { BillingState } from '@/lib/billing/billing-state';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-01T12:00:00Z');
const at = (d: number) => new Date(NOW + d * DAY).toISOString();
const state = (over: Partial<BillingState>): BillingState => ({
  state: 'free',
  planKey: null,
  grantsTier: 'FREE',
  trialEndsAt: null,
  nextChargeAt: null,
  graceEndsAt: null,
  accessUntil: null,
  card: null,
  cancelAtPeriodEnd: false,
  pendingChange: null,
  reminderDeliveredAt: null,
  chargeHoldUntil: null,
  ...over,
});

test('banner priority: past_due > notice hold > trial tomorrow > trial > renew > ended', () => {
  assert.equal(selectBanner(state({ state: 'past_due' }), false, NOW)?.kind, 'pastDue');
  // The whole 7-day trial is inside the notice window: amber from day 0.
  const trialing = state({
    state: 'trialing',
    trialEndsAt: at(6),
    nextChargeAt: at(6),
    reminderDeliveredAt: at(-1),
  });
  assert.equal(selectBanner(trialing, false, NOW)?.kind, 'trial');
  assert.equal(selectBanner(trialing, false, NOW)?.tone, 'warn');
  // Notice not delivered by charge − 5 days → the hold banner beats it.
  assert.equal(
    selectBanner(state({ state: 'trialing', trialEndsAt: at(4), nextChargeAt: at(4) }), false, NOW)
      ?.kind,
    'noticeHold',
  );
  assert.equal(
    selectBanner(state({ state: 'trialing', trialEndsAt: at(6), nextChargeAt: at(6) }), false, NOW)
      ?.kind,
    'trial',
    'before the deadline there is still time',
  );
  assert.equal(
    selectBanner(
      state({
        state: 'pro',
        nextChargeAt: at(2),
        reminderDeliveredAt: at(-1),
        chargeHoldUntil: at(4),
      }),
      false,
      NOW,
    )?.kind,
    'noticeHold',
  );
  // TRIAL_DAY6_REMINDER: the day before.
  const lastDay = state({
    state: 'trialing',
    trialEndsAt: at(0.5),
    nextChargeAt: at(0.5),
    reminderDeliveredAt: at(-6),
  });
  assert.equal(selectBanner(lastDay, false, NOW)?.kind, 'trial');
  assert.equal(selectBanner(lastDay, false, NOW, { day6Enabled: true })?.kind, 'trialTomorrow');
  assert.equal(
    selectBanner(
      state({ state: 'pro', nextChargeAt: at(5), reminderDeliveredAt: at(-2) }),
      false,
      NOW,
    )?.kind,
    'renew',
  );
  assert.equal(selectBanner(state({ state: 'pro', nextChargeAt: at(20) }), false, NOW), null);
  assert.equal(selectBanner(state({}), true, NOW)?.kind, 'ended');
  assert.equal(selectBanner(state({}), false, NOW), null);
});

test('the pre-charge banners can’t be closed; they count as the in-app notice', () => {
  for (const s of [
    state({
      state: 'trialing',
      trialEndsAt: at(3),
      nextChargeAt: at(3),
      reminderDeliveredAt: at(-4),
    }),
    state({ state: 'pro', nextChargeAt: at(3), reminderDeliveredAt: at(-4) }),
  ]) {
    const b = selectBanner(s, false, NOW)!;
    assert.equal(b.closable, false);
    assert.equal(b.mandatoryNotice, true);
  }
  assert.equal(selectBanner(state({ state: 'past_due' }), false, NOW)!.closable, false);
});

test('Planes CTAs per state', () => {
  const anon = plansCta({
    signedIn: false,
    isAdmin: false,
    flow: true,
    trialUsed: false,
    billing: null,
    quebecBlocked: false,
  });
  assert.deepEqual(anon.pro, { href: '/sign-in?mode=signup&intent=trial', label: 'trial' });
  const off = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: false,
    trialUsed: false,
    billing: state({}),
    quebecBlocked: false,
  });
  assert.deepEqual(off.pro, { href: '/app/subscription', label: 'noTrial' });
  assert.deepEqual(off.gratis, { href: null, label: 'current' });
  const used = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: true,
    trialUsed: true,
    billing: state({}),
    quebecBlocked: false,
  });
  assert.equal(used.pro.label, 'return');
  const trialing = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: true,
    trialUsed: true,
    billing: state({ state: 'trialing', planKey: 'pro_year' }),
    quebecBlocked: false,
  });
  assert.deepEqual(trialing.pro, { href: null, label: 'trialing' });
  assert.equal(trialing.vip.label, 'up');
  const onVip = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: true,
    trialUsed: true,
    billing: state({ state: 'pro', planKey: 'vip_month' }),
    quebecBlocked: false,
  });
  assert.deepEqual(onVip.vip, { href: null, label: 'current' });
  const quebec = plansCta({
    signedIn: true,
    isAdmin: false,
    flow: true,
    trialUsed: false,
    billing: state({}),
    quebecBlocked: true,
  });
  assert.equal(quebec.pro.href, null);
});
