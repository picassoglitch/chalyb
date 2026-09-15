// Where a paid-looking plan actually comes from.
//
// profiles.tier says "PRO" whether Mercado Pago charged the card or an admin
// set it from /dashboard/team for QA. The billing surfaces must not dress the
// second case up as the first: no "renovación", no "Mercado Pago", no healthy
// paid badge when the payment history is empty. This module reads the
// evidence (approved payments, a live Mercado Pago subscription) through the
// user's own client and turns it into one label every surface shares.

import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import { isAdminRole, isPartnerTier } from './tiers';

export interface EntitlementEvidence {
  approvedPayments: number;
  /** A subscriptions row in pending / authorized / paused. */
  hasBillingSubscription: boolean;
}

export type EntitlementSource =
  | 'free'
  | 'paid' // approved payment and/or a Mercado Pago subscription behind it
  | 'comped' // paid tier with no money behind it: admin-assigned / QA / cortesía
  | 'partner' // PARTNER is a relationship, never sold
  | 'admin'; // role override — the stored tier is irrelevant

/** Reads payments + subscriptions for the signed-in user. Tolerates every
 *  failure (RLS, missing table) by reporting no evidence, which is the
 *  honest default: an unprovable payment is shown as cortesía, not as paid. */
export async function getEntitlementEvidence(userId: string): Promise<EntitlementEvidence> {
  try {
    const supabase = await createClient();
    const [{ count }, { data: sub }] = await Promise.all([
      supabase
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'approved'),
      supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId)
        .in('status', ['pending', 'authorized', 'paused'])
        .limit(1)
        .maybeSingle(),
    ]);
    return { approvedPayments: count ?? 0, hasBillingSubscription: !!sub };
  } catch {
    return { approvedPayments: 0, hasBillingSubscription: false };
  }
}

export function entitlementSource(input: {
  storedTier: SubscriptionTier;
  role: UserRole;
  evidence: EntitlementEvidence;
}): EntitlementSource {
  const { storedTier, role, evidence } = input;
  if (isAdminRole(role)) return 'admin';
  if (storedTier === 'FREE') return 'free';
  if (isPartnerTier(storedTier)) return 'partner';
  if (evidence.approvedPayments > 0 || evidence.hasBillingSubscription) return 'paid';
  return 'comped';
}

/** Short suffix for plan pills: "PRO · cortesía", "PARTNER · programa". Empty
 *  when the plan is Free or honestly paid. */
export function entitlementSuffix(source: EntitlementSource): string {
  switch (source) {
    case 'comped':
      return 'cortesía';
    case 'partner':
      return 'programa';
    case 'admin':
      return 'admin';
    default:
      return '';
  }
}
