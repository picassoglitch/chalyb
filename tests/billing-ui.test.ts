import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBanner } from '@/lib/billing/banner';
import { plansCta, signupNext } from '@/lib/billing/plans-cta';
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

test('Planes CTAs per state (K-2, spec §4.3)', () => {
  const base = { isAdmin: false, annualOffered: true, vipYearOffered: false, quebecBlocked: false };
  const anon = plansCta({ ...base, signedIn: false, flow: true, trialUsed: false, billing: null });
  assert.deepEqual(anon.pro, {
    hrefYear: '/sign-in?mode=signup&intent=trial&interval=year',
    hrefMonth: '/sign-in?mode=signup&intent=trial&interval=month',
    label: 'trial',
  });
  assert.deepEqual(anon.vip, {
    hrefYear: null,
    hrefMonth: '/sign-in?mode=signup&plan=vip&interval=month',
    label: 'choose',
  });
  // Flow off: monthly only, the legacy checkout, no trial (mockup 85, PC-B1/B4).
  const off = plansCta({
    ...base,
    annualOffered: false,
    signedIn: true,
    flow: false,
    trialUsed: false,
    billing: state({}),
  });
  assert.deepEqual(off.pro, { hrefYear: null, hrefMonth: '/app/subscription', label: 'paid' });
  assert.deepEqual(off.gratis, { href: null, label: 'current' });
  // Signed in, trial available: the picker learns the interval (C9).
  const free = plansCta({
    ...base,
    signedIn: true,
    flow: true,
    trialUsed: false,
    billing: state({}),
  });
  assert.equal(free.pro.hrefYear, '/app/prueba?interval=year');
  assert.equal(free.pro.hrefMonth, '/app/prueba?interval=month');
  // Trial used: straight to the paid checkout, "Elegir Pro anual|mensual" (PC-B5).
  const used = plansCta({
    ...base,
    signedIn: true,
    flow: true,
    trialUsed: true,
    billing: state({}),
  });
  assert.deepEqual(used.pro, {
    hrefYear: '/app/prueba/pago?plan=pro_year',
    hrefMonth: '/app/prueba/pago?plan=pro_month',
    label: 'paid',
  });
  const trialing = plansCta({
    ...base,
    signedIn: true,
    flow: true,
    trialUsed: true,
    billing: state({ state: 'trialing', planKey: 'pro_year' }),
  });
  assert.deepEqual(trialing.pro, { hrefYear: null, hrefMonth: null, label: 'trialing' });
  assert.equal(trialing.vip.label, 'up');
  const onVip = plansCta({
    ...base,
    signedIn: true,
    flow: true,
    trialUsed: true,
    billing: state({ state: 'pro', planKey: 'vip_month' }),
  });
  assert.deepEqual(onVip.vip, { hrefYear: null, hrefMonth: null, label: 'current' });
  const quebec = plansCta({
    ...base,
    quebecBlocked: true,
    signedIn: true,
    flow: true,
    trialUsed: false,
    billing: state({}),
  });
  assert.equal(quebec.pro.hrefYear, null);
  assert.equal(quebec.pro.hrefMonth, null);
  // VIP anual only once it is offered (WS-5).
  const vipYear = plansCta({
    ...base,
    vipYearOffered: true,
    signedIn: true,
    flow: true,
    trialUsed: false,
    billing: state({}),
  });
  assert.equal(vipYear.vip.hrefYear, '/app/billing/cambiar?plan=vip_year');
});

test('sign-up keeps the card’s interval (K-2)', () => {
  assert.equal(
    signupNext({ intent: 'trial', interval: 'month', flow: true }),
    '/app/prueba?interval=month',
  );
  assert.equal(signupNext({ intent: 'trial', flow: true }), '/app/prueba');
  assert.equal(signupNext({ intent: 'trial', interval: 'year', flow: false }), null);
  assert.equal(
    signupNext({ plan: 'pro', interval: 'year', flow: true }),
    '/app/prueba/pago?plan=pro_year',
  );
  assert.equal(signupNext({ plan: 'pro', flow: false }), '/app/billing');
  assert.equal(
    signupNext({ plan: 'vip', interval: 'month', flow: true }),
    '/app/billing/cambiar?plan=vip_month',
  );
  assert.equal(signupNext({ plan: 'free', flow: true }), '/app');
});
