// Reading a user's billing from our copy of Mercado Pago's state.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { deriveBillingState, type BillingState, type SubscriptionRow } from './billing-state';

const COLUMNS =
  'id, status, tier, plan_key, started_at, trial_ends_at, next_charge_at, next_payment_date, grace_ends_at, access_until, card_brand, card_last4, card_exp, cancel_at_period_end, pending_plan_key, pending_effective_at, reminder_delivered_at, charge_hold_until, mp_preapproval_id, amount_cents, last_charge_at, created_at';

export interface BillingSnapshot {
  /** The subscription that grants the most right now (or the latest). */
  primary: BillingState;
  primaryRow: (SubscriptionRow & Record<string, unknown>) | null;
  /** Highest tier any subscription grants right now. */
  grantsTier: 'FREE' | 'PRO' | 'VIP';
  /** Whether this account already used its free Pro month. */
  trialUsed: boolean;
}

const RANK = { FREE: 0, PRO: 1, VIP: 2 } as const;

export async function loadBilling(userId: string, nowMs = Date.now()): Promise<BillingSnapshot> {
  const admin = createAdminClient();
  const [{ data: rows }, { data: profile }] = await Promise.all([
    admin
      .from('subscriptions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin.from('profiles').select('pro_trial_started_at').eq('id', userId).maybeSingle(),
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
    trialUsed: !!profile?.pro_trial_started_at,
  };
}
