// Who may put whom on which tier.
//
// Pure, so the rule can be tested without a session or a database, and so the
// server action that writes with the service-role client has exactly one place
// where the decision is made.

import type { SubscriptionTier } from './session';

/** Tiers this action is allowed to write at all. */
export const VALID_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'PARTNER', 'VIP'];

/** Tiers a user may put THEMSELVES on with no payment and no admin.
 *  FREE only: it is the cancel/downgrade path and costs nothing. */
export const SELF_SERVICE_TIERS: SubscriptionTier[] = ['FREE'];

export type TierDecision =
  | { allow: true }
  | { allow: false; reason: 'unknown_tier' | 'not_admin' | 'partner_is_admin_grant' | 'payment_required' };

/**
 * The gate. Everything that reaches `allow: true` is either an admin acting, or
 * a user downgrading themselves to FREE.
 *
 * A paid tier is never granted here — it comes from the Mercado Pago webhook
 * once that has verified both the signature and the amount, or from an admin.
 */
export function decideTierChange(input: {
  newTier: SubscriptionTier;
  isSelf: boolean;
  isAdmin: boolean;
}): TierDecision {
  const { newTier, isSelf, isAdmin } = input;

  if (!VALID_TIERS.includes(newTier)) return { allow: false, reason: 'unknown_tier' };
  if (isAdmin) return { allow: true };
  if (!isSelf) return { allow: false, reason: 'not_admin' };
  if (SELF_SERVICE_TIERS.includes(newTier)) return { allow: true };
  // PARTNER is a relationship, not a SKU: no checkout exists for it.
  if (newTier === 'PARTNER') return { allow: false, reason: 'partner_is_admin_grant' };
  return { allow: false, reason: 'payment_required' };
}
