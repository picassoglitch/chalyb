// How a plan is NAMED to the customer (not what it allows — that is
// getEntitlements). One mapping for the user card, Inicio and Mi cuenta.

import type { SubscriptionTier } from '@/lib/auth/session';

/** nav.plan.* / account.plan.name.* key. P2 adds prueba / pro_anual. */
export type PlanLabelKey = 'gratis' | 'prueba' | 'pro' | 'pro_anual' | 'vip';

export function planLabelKey(plan: SubscriptionTier): PlanLabelKey {
  if (plan === 'VIP') return 'vip';
  if (plan === 'PRO' || plan === 'PARTNER') return 'pro';
  return 'gratis';
}

/** Brand name of a paid plan, for "Todo incluido en tu plan {plan}". */
export function paidPlanName(plan: SubscriptionTier): 'Pro' | 'VIP' {
  return planLabelKey(plan) === 'vip' ? 'VIP' : 'Pro';
}
