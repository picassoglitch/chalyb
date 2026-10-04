// The billing side of entitlements (rebuild P2-1): one subscription row →
// one customer state. Pure; the dates are UTC instants.
//
//   free              no paid plan
//   trialing          in the 7-day trial (full Pro)
//   pro               paying, renewing (Pro or VIP — `plan` says which)
//   past_due          a charge failed; full access until graceEndsAt
//   cancelled_active  cancelled, but paid (or trial) access runs to accessUntil

import { planPrice, PRICING, type PlanKey } from '@/config/pricing';
import { addInterval } from './trial-dates';

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
  /** When a charge of this subscription last went through (null: never). */
  last_charge_at?: string | null;
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

/** Our copy of a preapproval Mercado Pago authorised at an amount we never
 *  priced (the price gate, subscription-sync): visible, grants nothing. */
export const AMOUNT_MISMATCH_STATUS = 'amount_mismatch';

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const DAY = 24 * 60 * 60 * 1000;

export interface UnpaidCharge {
  /** When the charge was due: the trial end or the end of the paid period,
   *  pushed back only by a bounce hold. */
  dueAt: string;
  /** When Pro stops if no charge has landed by then. */
  deadline: string;
}

/**
 * The charge this subscription is waiting on, judged from OUR record of the
 * last charge that went through — never from Mercado Pago's
 * next_payment_date, which it moves forward while it retries a failed card.
 *
 *   7-day trial, never charged   due at the trial end, no grace
 *                                (PRICING.trial.firstChargeGraceDays)
 *   renewal                      due one period after the last charge,
 *                                PRICING.graceDays of grace
 *
 * The due date only moves for a bounce hold (no charge until 5 days after an
 * effective notice). Null when nothing is owed yet that we can date: a paid
 * start or plan change that hasn't charged for the first time.
 */
export function unpaidCharge(
  row: Pick<
    SubscriptionRow,
    | 'tier'
    | 'plan_key'
    | 'trial_ends_at'
    | 'last_charge_at'
    | 'charge_hold_until'
    | 'reminder_delivered_at'
  >,
  p = PRICING,
): UnpaidCharge | null {
  let scheduled: number;
  let graceDays: number;
  if (row.last_charge_at) {
    const planKey = row.plan_key ?? (row.tier === 'VIP' ? 'vip_month' : 'pro_month');
    const interval = planPrice(planKey).interval;
    scheduled = addInterval(new Date(row.last_charge_at), interval).getTime();
    graceDays = p.graceDays;
  } else if (row.trial_ends_at) {
    scheduled = ms(row.trial_ends_at);
    graceDays = p.trial.firstChargeGraceDays;
  } else {
    return null;
  }
  const dueAt = Math.max(
    scheduled,
    ms(row.charge_hold_until) || 0,
    ms(row.reminder_delivered_at) + 5 * DAY || 0,
  );
  if (Number.isNaN(dueAt)) return null;
  return {
    dueAt: new Date(dueAt).toISOString(),
    deadline: new Date(dueAt + graceDays * DAY).toISOString(),
  };
}

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
  // Refused by the price gate: nothing, whatever else the row says.
  if (status === AMOUNT_MISMATCH_STATUS) return { ...FREE, trialEndsAt: row.trial_ends_at };
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

  // A charge is overdue past its deadline (the trial's annual charge, or a
  // renewal): no Pro, whatever state Mercado Pago still reports.
  const unpaid = unpaidCharge(row);
  if (unpaid && nowMs >= ms(unpaid.deadline)) {
    return { ...FREE, trialEndsAt: row.trial_ends_at };
  }

  // A failed charge: full access inside the grace window, then nothing.
  const overdue = !!unpaid && nowMs >= ms(unpaid.dueAt);
  if (status === 'paused' || (row.grace_ends_at && (overdue || nowMs >= ms(nextChargeAt)))) {
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
