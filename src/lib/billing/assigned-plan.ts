// QA 2026-11-06 — a plan the owner assigned (no subscription) must read the same
// in Mi plan and Planes as in Mi cuenta, not as Gratis. Pure.

import type { SubscriptionTier } from '@/lib/auth/session';
import type { BillingState } from './billing-state';

export type AssignedPlan = 'PRO' | 'VIP';

export function assignedPlan(input: {
  isAdmin: boolean;
  /** The effective plan, as getEntitlements answers it. */
  plan: SubscriptionTier;
  /** The subscription state; null = unknown (the read failed). */
  billing: BillingState | null;
}): AssignedPlan | null {
  // A failed billing read is not "no subscription": never show a payer "sin cobro".
  if (input.isAdmin || !input.billing) return null;
  if (input.billing.state !== 'free') return null;
  if (input.plan === 'FREE') return null;
  return input.plan === 'VIP' ? 'VIP' : 'PRO';
}

/** Which layout Mi plan renders. */
export type MiPlanMode = 'admin' | 'free' | 'assigned' | 'subscription';

export function miPlanMode(input: {
  isAdmin: boolean;
  billing: BillingState | null;
  assigned: AssignedPlan | null;
}): MiPlanMode {
  if (input.isAdmin) return 'admin';
  if (input.assigned) return 'assigned';
  if (!input.billing || input.billing.state === 'free') return 'free';
  return 'subscription';
}
