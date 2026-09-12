// Resolving a stored subscription into the tier that actually applies now.
//
// Pure module — no Supabase, no server-only — so the date arithmetic is
// unit-testable and callable from both the session layer and the UI.
//
// A cancellation here is "cancel at period end": the user keeps what they
// paid for until tier_period_end, and only then drops to FREE. There is no
// cron job applying that downgrade. Instead every read resolves it, and
// the session layer persists the result the first time it notices. The
// upside over a scheduler is that nothing can downgrade a paying customer
// because a job ran at the wrong moment — the only thing that ever sets
// tier_cancel_at is the user explicitly cancelling.

import type { SubscriptionTier } from '@/lib/auth/session';

export interface SubscriptionSnapshot {
  /** profiles.tier as stored. */
  storedTier: SubscriptionTier;
  /** profiles.tier_period_end (ISO) or null. */
  periodEnd: string | null;
  /** profiles.tier_cancel_at (ISO) or null. */
  cancelAt: string | null;
}

export interface ResolvedSubscription {
  /** The tier that applies right now. FREE once a cancellation has elapsed. */
  tier: SubscriptionTier;
  /** A cancellation that has been requested but has NOT taken effect yet.
   *  Null when there is none, or when it already elapsed (see `elapsed`). */
  pendingCancelAt: string | null;
  /** End of the paid period, passed through for display. */
  periodEnd: string | null;
  /** True when a cancellation was pending and its date has now passed —
   *  the caller should write tier=FREE back and clear the dates. */
  elapsed: boolean;
}

function parse(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function resolveSubscription(
  snapshot: SubscriptionSnapshot,
  now: Date = new Date(),
): ResolvedSubscription {
  const { storedTier, periodEnd, cancelAt } = snapshot;
  const cancelMs = parse(cancelAt);

  if (cancelMs === null) {
    return { tier: storedTier, pendingCancelAt: null, periodEnd, elapsed: false };
  }

  if (cancelMs > now.getTime()) {
    // Still inside the paid period — they keep the plan they bought.
    return { tier: storedTier, pendingCancelAt: cancelAt, periodEnd, elapsed: false };
  }

  // The period ran out. FREE from here, and the caller should persist it.
  // `elapsed` stays true even if the stored tier is already FREE so a
  // half-applied state (tier written, dates not cleared) still gets tidied.
  return { tier: 'FREE', pendingCancelAt: null, periodEnd, elapsed: true };
}

/** When a cancellation requested now would take effect: the end of the paid
 *  period if we know it and it is still in the future, otherwise immediately.
 *  Returned as an ISO string so it can go straight into the DB. */
export function cancellationEffectiveAt(periodEnd: string | null, now: Date = new Date()): string {
  const endMs = parse(periodEnd);
  if (endMs !== null && endMs > now.getTime()) return new Date(endMs).toISOString();
  return now.toISOString();
}

/** One paid period from `start`. Mercado Pago Preferences here are one-off
 *  charges rather than a preapproval subscription, so a payment buys exactly
 *  one month. Month arithmetic clamps: paying on Jan 31 ends Feb 28/29. */
export function addOneMonth(start: Date): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const day = start.getUTCDate();

  const daysInTargetMonth = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(
    Date.UTC(
      year,
      month + 1,
      clampedDay,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
}
