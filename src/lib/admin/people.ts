// Personas (P5-2): who each person is to the business, from their
// subscription row. Pure.

import type { SubscriptionFact } from './kpis';

export type PersonStatus = 'active' | 'trial' | 'past_due' | 'ending' | 'cancelled' | 'free';
export type PeopleChip = 'all' | 'trial' | 'past_due' | 'cancelled';

export interface PersonRow {
  id: string;
  name: string;
  email: string;
  plan: 'Gratis' | 'Pro' | 'VIP';
  status: PersonStatus;
  since: string;
  sub: (SubscriptionFact & { grace_ends_at?: string | null; access_until?: string | null }) | null;
}

const DAY = 86_400_000;

export function personStatus(
  sub: (SubscriptionFact & { grace_ends_at?: string | null; access_until?: string | null }) | null,
  now: number,
): PersonStatus {
  if (!sub) return 'free';
  if (sub.status === 'paused' || (sub.grace_ends_at && Date.parse(sub.grace_ends_at) > now)) return 'past_due';
  if (sub.status === 'cancelled' || sub.cancel_at_period_end) {
    const until = sub.access_until ? Date.parse(sub.access_until) : 0;
    return until > now && until - now <= 14 * DAY ? 'ending' : 'cancelled';
  }
  if (sub.status === 'authorized' && sub.trial_ends_at && Date.parse(sub.trial_ends_at) > now) return 'trial';
  if (sub.status === 'authorized') return 'active';
  return 'cancelled';
}

export function filterPeople(rows: readonly PersonRow[], chip: PeopleChip, query: string): PersonRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (chip === 'all' ||
        (chip === 'trial' && r.status === 'trial') ||
        (chip === 'past_due' && r.status === 'past_due') ||
        (chip === 'cancelled' && (r.status === 'cancelled' || r.status === 'ending'))) &&
      (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)),
  );
}

/** Which row actions make sense for this person (none is a dead button). */
export function personActions(r: PersonRow, lastChargeCents: number | null) {
  const hasRecurring = r.sub?.status === 'authorized' || r.sub?.status === 'paused';
  return {
    // A month on us only where no automatic charge would land inside it.
    giftMonth: !hasRecurring,
    changePlan: true,
    resendAccess: !!r.email,
    refundLast: lastChargeCents !== null && lastChargeCents > 0,
    cancel: hasRecurring && !r.sub?.cancel_at_period_end,
  };
}
