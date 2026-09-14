// When paid access starts and, more importantly, when it ends.
//
// Cancelling a paid plan does not take the plan away on the spot: the user
// already paid for the month, so they keep it until that month is up. This
// file holds the arithmetic and the decision, pure and without a database, so
// both are readable on their own and covered by tests.

import type { SubscriptionTier } from '@/lib/auth/session';

/** One billing period. Prices are quoted per month and Mercado Pago charges a
 *  month at a time, so a paid period is 30 days from the approved payment. */
export const PAID_PERIOD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tiers that cost money, and therefore buy a period. PARTNER is granted, not
 *  bought, so cancelling it has no period to run out. */
export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'PRO' || tier === 'VIP';
}

/** End of the period bought by a payment made at `paidAt`. */
export function periodEndFrom(paidAt: Date | string | null | undefined): Date | null {
  if (!paidAt) return null;
  const start = paidAt instanceof Date ? paidAt : new Date(paidAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + PAID_PERIOD_DAYS * DAY_MS);
}

/** Has a scheduled end already passed? A null end never lapses. */
export function hasLapsed(tierEndsAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!tierEndsAt) return false;
  const end = tierEndsAt instanceof Date ? tierEndsAt : new Date(tierEndsAt);
  if (Number.isNaN(end.getTime())) return false;
  return end.getTime() <= now.getTime();
}

/**
 * The tier a stored row actually entitles someone to right now.
 *
 * This is the enforcement point for a cancelled plan: once tier_ends_at is in
 * the past the row still says PRO, and this says FREE. Read on every session
 * load, so a lapse takes effect without anything having to run on a schedule.
 */
export function tierAfterExpiry(
  storedTier: SubscriptionTier,
  tierEndsAt: Date | string | null | undefined,
  now: Date = new Date(),
): SubscriptionTier {
  if (!isPaidTier(storedTier)) return storedTier;
  return hasLapsed(tierEndsAt, now) ? 'FREE' : storedTier;
}

export type CancellationOutcome =
  /** Keep the plan until `endsAt`, then it lapses to FREE. */
  | { kind: 'scheduled'; endsAt: Date }
  /** Nothing was paid for that is still running — drop to FREE now. */
  | { kind: 'immediate' };

/**
 * What happens when someone cancels.
 *
 * `lastApprovedPaymentAt` is the most recent approved payment for this user.
 * No payment on file means nothing was bought (an admin grant, a comp
 * account), so there is no paid period to honour and the change is immediate.
 * A period that has already elapsed is the same case.
 */
export function cancellationOutcome(input: {
  currentTier: SubscriptionTier;
  lastApprovedPaymentAt: Date | string | null | undefined;
  now?: Date;
}): CancellationOutcome {
  const now = input.now ?? new Date();
  if (!isPaidTier(input.currentTier)) return { kind: 'immediate' };

  const endsAt = periodEndFrom(input.lastApprovedPaymentAt);
  if (!endsAt || endsAt.getTime() <= now.getTime()) return { kind: 'immediate' };

  return { kind: 'scheduled', endsAt };
}
