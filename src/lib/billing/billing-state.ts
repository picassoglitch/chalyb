// The billing side of entitlements (rebuild P2-1): one subscription row →
// one customer state. Pure; the dates are UTC instants.
//
//   free              no paid plan
//   trialing          in the free month (full Pro)
//   pro               paying, renewing (Pro or VIP — `plan` says which)
//   past_due          a charge failed; full access until graceEndsAt
//   cancelled_active  cancelled, but paid (or trial) access runs to accessUntil

import type { PlanKey } from '@/config/pricing';

export type BillingStateName = 'free' | 'trialing' | 'pro' | 'past_due' | 'cancelled_active';

export interface SubscriptionRow {
  status: string; // pending | authorized | paused | cancelled
  tier: 'PRO' | 'VIP' | string;
  plan_key: PlanKey | null;
  trial_ends_at: string | null;
  next_charge_at: string | null;
  next_payment_date: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean | null;
  access_until?: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp: string | null;
  pending_plan_key: PlanKey | null;
  pending_effective_at: string | null;
  reminder_delivered_at: string | null;
  /** Bounce hold (no charge until then); the preapproval is paused on
   *  purpose, which is not the customer's failure. */
  charge_hold_until?: string | null;
}

export interface BillingState {
  state: BillingStateName;
  planKey: PlanKey | null;
  /** The tier the state grants right now (FREE when nothing does). */
  grantsTier: 'FREE' | 'PRO' | 'VIP';
  trialEndsAt: string | null;
  nextChargeAt: string | null;
  graceEndsAt: string | null;
  /** End of paid/trial access for a cancelled plan. */
  accessUntil: string | null;
  card: { brand: string | null; last4: string | null; exp: string | null } | null;
  cancelAtPeriodEnd: boolean;
  pendingChange: { planKey: PlanKey; effectiveAt: string } | null;
  reminderDeliveredAt: string | null;
  /** The bounce hold: no charge before this (Términos §2.7 bis). */
  chargeHoldUntil: string | null;
}

const FREE: BillingState = {
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
};

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);

export function deriveBillingState(row: SubscriptionRow | null, nowMs: number): BillingState {
  if (!row) return FREE;
  const tier = row.tier === 'VIP' ? 'VIP' : 'PRO';
  const nextChargeAt = row.next_charge_at ?? row.next_payment_date;
  const base: BillingState = {
    ...FREE,
    planKey: row.plan_key ?? (tier === 'VIP' ? 'vip_month' : 'pro_month'),
    trialEndsAt: row.trial_ends_at,
    nextChargeAt,
    graceEndsAt: row.grace_ends_at,
    card: row.card_last4
      ? { brand: row.card_brand, last4: row.card_last4, exp: row.card_exp }
      : null,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    pendingChange:
      row.pending_plan_key && row.pending_effective_at
        ? { planKey: row.pending_plan_key, effectiveAt: row.pending_effective_at }
        : null,
    reminderDeliveredAt: row.reminder_delivered_at,
    chargeHoldUntil: row.charge_hold_until ?? null,
  };

  const status = row.status.toLowerCase();
  const inTrial = !Number.isNaN(ms(row.trial_ends_at)) && nowMs < ms(row.trial_ends_at);

  // Cancelled (by the user or by us): access runs to the end of what was
  // already granted — the trial end, or the paid period — then nothing.
  if (status === 'cancelled' || row.cancel_at_period_end) {
    const until = row.access_until ?? (inTrial ? row.trial_ends_at : nextChargeAt);
    if (until && nowMs < ms(until)) {
      return {
        ...base,
        state: 'cancelled_active',
        grantsTier: tier,
        accessUntil: until,
        cancelAtPeriodEnd: true,
      };
    }
    return { ...FREE, trialEndsAt: row.trial_ends_at };
  }

  // Held by us (the pre-charge notice bounced): the plan carries on, the
  // charge waits.
  if (status === 'paused' && row.charge_hold_until) {
    return { ...base, state: inTrial ? 'trialing' : 'pro', grantsTier: tier };
  }

  // A failed charge: full access inside the grace window, then nothing.
  if (status === 'paused' || (row.grace_ends_at && nowMs >= ms(nextChargeAt))) {
    if (row.grace_ends_at && nowMs < ms(row.grace_ends_at)) {
      return { ...base, state: 'past_due', grantsTier: tier };
    }
    return { ...FREE, trialEndsAt: row.trial_ends_at };
  }

  if (status === 'authorized') {
    return { ...base, state: inTrial ? 'trialing' : 'pro', grantsTier: tier };
  }
  return FREE; // pending: nothing granted until Mercado Pago authorizes
}
