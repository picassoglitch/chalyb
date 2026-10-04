// Reading a user's billing from our copy of Mercado Pago's state.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { deriveBillingState, type BillingState, type SubscriptionRow } from './billing-state';
import { restrictionState, type RestrictionRow, type RestrictionState } from './disputes';
import { trialUsedFrom } from './trial-eligibility';
import { chargebackMeasuresEnabled } from '@/lib/config/flags';

const COLUMNS =
  'id, status, tier, plan_key, started_at, trial_ends_at, next_charge_at, next_payment_date, grace_ends_at, access_until, card_brand, card_last4, card_exp, cancel_at_period_end, pending_plan_key, pending_effective_at, reminder_delivered_at, charge_hold_until, mp_preapproval_id, amount_cents, last_charge_at, first_charge_at, created_at';

export interface BillingSnapshot {
  /** The subscription that grants the most right now (or the latest). */
  primary: BillingState;
  primaryRow: (SubscriptionRow & Record<string, unknown>) | null;
  /** Highest tier any subscription grants right now. */
  grantsTier: 'FREE' | 'PRO' | 'VIP';
  /** Whether this account already used its free trial, or may not have
   *  one (prepayment_required after a bad-faith chargeback, WS-8). */
  trialUsed: boolean;
  /** Measures after a bad-faith chargeback (none while they're off). */
  restriction: RestrictionState;
}

/** Active measures for a user (WS-8). FAILS OPEN: an error, or the table not
 *  being there yet, means no measure. Never restrict on a read failure. */
export async function accountRestrictions(userId: string): Promise<RestrictionState> {
  // Measures exist only while CHARGEBACK_MEASURES_ENABLED is on (WS-8):
  // turning it off lifts their effect at once, whatever rows remain.
  if (!chargebackMeasuresEnabled()) return restrictionState([]);
  try {
    const { data, error } = await createAdminClient()
      .from('account_restrictions')
      .select('kind, set_at, lifted_at')
      .eq('user_id', userId)
      .is('lifted_at', null);
    if (error) throw new Error(error.message);
    return restrictionState((data ?? []) as RestrictionRow[]);
  } catch (err) {
    console.warn('[billing] restrictions unreadable; none applied', err);
    return restrictionState([]);
  }
}

const RANK = { FREE: 0, PRO: 1, VIP: 2 } as const;

export async function loadBilling(userId: string, nowMs = Date.now()): Promise<BillingSnapshot> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: profile }, restriction, { data: charged }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('profiles').select('pro_trial_started_at').eq('id', userId).maybeSingle(),
    accountRestrictions(userId),
    // Any plan ever charged (a subscription charge or a legacy one-off
    // plan): a returning customer gets no trial.
    admin
      .from('payments')
      .select('id')
      .eq('user_id', userId)
      .in('kind', ['subscription', 'plan'])
      .in('status', ['approved', 'refunded', 'charged_back', 'in_mediation'])
      .limit(1),
  ]);
  const list = (rows ?? []) as unknown as (SubscriptionRow & Record<string, unknown>)[];
  let best: { state: BillingState; row: (typeof list)[number] } | null = null;
  for (const row of list) {
    const state = deriveBillingState(row, nowMs);
    // Prefer what grants more; at equal grant, the live (non-cancelled) one.
    if (
      !best ||
      RANK[state.grantsTier] > RANK[best.state.grantsTier] ||
      (RANK[state.grantsTier] === RANK[best.state.grantsTier] &&
        best.state.state === 'cancelled_active' &&
        state.state !== 'cancelled_active' &&
        state.state !== 'free')
    ) {
      best = { state, row };
    }
  }
  const primary = best?.state ?? deriveBillingState(null, nowMs);
  return {
    primary,
    primaryRow: best && best.state.state !== 'free' ? best.row : (list[0] ?? null),
    grantsTier: primary.grantsTier,
    trialUsed: trialUsedFrom({
      trialStartedAt: profile?.pro_trial_started_at as string | null | undefined,
      prepaymentRequired: restriction.prepaymentRequired,
      chargedBefore:
        (charged?.length ?? 0) > 0 || list.some((r) => !!(r.last_charge_at as string | null)),
    }),
    restriction,
  };
}
