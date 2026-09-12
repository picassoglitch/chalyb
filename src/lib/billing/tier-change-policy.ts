// Who is allowed to change whose tier, and to what.
//
// Deliberately a PURE module — no 'use server', no 'server-only', no
// Supabase import — so the rule can be unit-tested directly and so the
// same decision is reachable from anywhere without dragging a DB client
// along. `tier-actions.ts` is the only thing that acts on the verdict.
//
// THE RULE
// A tier is either free (FREE) or paid (PRO / VIP), plus PARTNER which is
// a relationship rather than a SKU and is never self-assignable.
//
//   admin, anyone's row     → any tier. Admins grant comps and fix disputes.
//   self, → FREE            → allowed. Downgrading costs nobody anything.
//   self, → PRO/VIP         → REFUSED. Paid tiers are written by the
//                             Mercado Pago webhook after money actually
//                             moves, never by the action the browser calls.
//   self, → PARTNER         → REFUSED. Admin grant only.
//   not self, not admin     → REFUSED.
//
// The refusal for a paid self-upgrade is the important one: before this
// existed, the /app/subscription card called changeUserTier('VIP') and the
// server wrote it, so any signed-in user could hand themselves the top
// plan by calling the server action directly — the UI's checkout redirect
// was the only thing standing in the way.

import type { SubscriptionTier } from '@/lib/auth/session';

/** Every tier the action will even consider writing. */
export const VALID_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'PARTNER', 'VIP'];

/** Tiers that cost money and therefore may only be granted by the webhook
 *  (after a confirmed payment) or by an admin. */
export const PAID_TIERS: SubscriptionTier[] = ['PRO', 'VIP'];

export type TierChangeRefusal =
  | 'invalid_tier'
  | 'not_self_not_admin'
  | 'partner_admin_only'
  | 'payment_required';

export type TierChangeDecision =
  | { allowed: true; kind: 'admin_grant' | 'self_downgrade' }
  | { allowed: false; reason: TierChangeRefusal; error: string };

export interface TierChangeRequest {
  /** Is the actor changing their OWN row? */
  isSelf: boolean;
  /** Does the actor hold SUPER_ADMIN or ADMIN at request time (includes the
   *  SUPER_ADMIN_EMAILS env override)? */
  isAdmin: boolean;
  /** The tier being requested. */
  newTier: SubscriptionTier;
}

export function decideTierChange({
  isSelf,
  isAdmin,
  newTier,
}: TierChangeRequest): TierChangeDecision {
  if (!VALID_TIERS.includes(newTier)) {
    return { allowed: false, reason: 'invalid_tier', error: 'Ese plan no existe.' };
  }

  if (isAdmin) {
    return { allowed: true, kind: 'admin_grant' };
  }

  if (!isSelf) {
    return {
      allowed: false,
      reason: 'not_self_not_admin',
      error: 'Solo un admin puede cambiar el plan de otra persona.',
    };
  }

  // PARTNER is a relationship, not a SKU — there is no checkout for it.
  if (newTier === 'PARTNER') {
    return {
      allowed: false,
      reason: 'partner_admin_only',
      error: 'El plan Partner solo lo asigna un admin.',
    };
  }

  if (PAID_TIERS.includes(newTier)) {
    return {
      allowed: false,
      reason: 'payment_required',
      error:
        'Los planes de paga se activan cuando Mercado Pago confirma el cobro. Abre el checkout desde la tarjeta del plan.',
    };
  }

  // Only FREE is left.
  return { allowed: true, kind: 'self_downgrade' };
}
