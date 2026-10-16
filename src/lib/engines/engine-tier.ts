// The tier an engine is told about (launch tokens, /tenants, server-to-server identity). It's the
// person's effective plan, the same one the hub's own screens use: the higher of the profile tier
// (admins count as VIP) and what the subscription grants, so a paid month still in payment grace
// counts even while profiles.tier says otherwise. Engines only know free | pro | vip
// (tenants.tier), so the partner tier presents as pro.
import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import { effectiveTier } from '@/lib/billing/tiers';

const RANK: Record<SubscriptionTier, number> = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 };

export type EngineTier = 'FREE' | 'PRO' | 'VIP';

/** Map an effective plan (Entitlements.plan) to what engines accept. */
export const engineTierFor = (plan: SubscriptionTier): EngineTier =>
  plan === 'PARTNER' ? 'PRO' : plan;

/** For callers without Entitlements: the same rule computeEntitlements applies. */
export function engineTierOf(input: {
  role: UserRole;
  storedTier: SubscriptionTier;
  grantsTier?: 'FREE' | 'PRO' | 'VIP' | null;
  /** A bad-faith chargeback with the measures flag on: paid features off. */
  paidSuspended?: boolean;
}): EngineTier {
  if (input.paidSuspended) return engineTierFor(effectiveTier(input.role, 'FREE'));
  const stored = effectiveTier(input.role, input.storedTier);
  const granted = input.grantsTier ?? 'FREE';
  return engineTierFor(RANK[granted] > RANK[stored] ? granted : stored);
}
