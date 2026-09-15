// The pure half of recurring billing: the reference we put on a Mercado Pago
// preapproval, the statuses Mercado Pago reports, and what each one means for
// the user's tier. No I/O, no SDK, so it can be read and tested on its own.
// The webhook and the checkout action are the only runtime callers.

/** Tiers that are sold as a monthly subscription. PARTNER is admin-granted
 *  and FREE has no price, so neither ever appears on a preapproval. */
export type SubscribableTier = 'PRO' | 'VIP';

const SUBSCRIBABLE: SubscribableTier[] = ['PRO', 'VIP'];

export function isSubscribableTier(tier: string): tier is SubscribableTier {
  return (SUBSCRIBABLE as string[]).includes(tier);
}

/** Prefix that tells a subscription reference apart from the one-off ones
 *  ("<userId>|<TIER>" for the old tier checkout, "pack|…" for token packs). */
export const SUBSCRIPTION_REF_PREFIX = 'sub';

/** external_reference for a preapproval: "sub|<userId>|<TIER>". */
export function subscriptionReference(userId: string, tier: SubscribableTier): string {
  return `${SUBSCRIPTION_REF_PREFIX}|${userId}|${tier}`;
}

export interface ParsedSubscriptionReference {
  userId: string;
  tier: SubscribableTier;
}

/** The inverse. null for anything that is not a well-formed subscription
 *  reference — a one-off reference, a pack, junk. */
export function parseSubscriptionReference(
  ref: string | null | undefined,
): ParsedSubscriptionReference | null {
  if (!ref) return null;
  const parts = ref.split('|');
  if (parts.length !== 3) return null;
  const [prefix, userId, tier] = parts;
  if (prefix !== SUBSCRIPTION_REF_PREFIX || !userId || !tier) return null;
  if (!isSubscribableTier(tier)) return null;
  return { userId, tier };
}

/** Mercado Pago's preapproval statuses, normalised. They spell the last one
 *  both "cancelled" and "canceled" depending on the endpoint. */
export type PreapprovalStatus = 'pending' | 'authorized' | 'paused' | 'cancelled' | 'unknown';

export function normalizePreapprovalStatus(status: string | null | undefined): PreapprovalStatus {
  const s = (status ?? '').trim().toLowerCase();
  if (s === 'pending' || s === 'authorized' || s === 'paused') return s;
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'unknown';
}

/** Statuses under which Mercado Pago may still charge the card. */
export function isLiveStatus(status: PreapprovalStatus): boolean {
  return status === 'pending' || status === 'authorized';
}

export type Entitlement =
  /** The subscription is charging: the tier is theirs, with no scheduled end. */
  | { kind: 'activate'; tier: SubscribableTier }
  /** The subscription stopped: the tier runs to `endsAt`, then lapses to FREE. */
  | { kind: 'end'; endsAt: Date }
  /** Nothing to change (not authorised yet, or a status we do not know). */
  | { kind: 'none' };

/**
 * What a preapproval in this state entitles the user to.
 *
 * Authorised means Mercado Pago holds a card and charges it monthly, so the
 * tier is active. Paused or cancelled means the charging stopped, but the
 * period already paid for is still theirs: access ends at the next charge
 * date Mercado Pago had scheduled. If that date is already behind us (a
 * charge failed and retries ran out), it ends now. Pending is not an
 * entitlement to anything — the card has not been authorised.
 */
export function entitlementFor(input: {
  status: PreapprovalStatus;
  tier: SubscribableTier;
  nextPaymentDate: Date | string | null | undefined;
  now?: Date;
}): Entitlement {
  const now = input.now ?? new Date();
  switch (input.status) {
    case 'authorized':
      return { kind: 'activate', tier: input.tier };
    case 'paused':
    case 'cancelled': {
      const next = toDate(input.nextPaymentDate);
      const endsAt = next && next.getTime() > now.getTime() ? next : now;
      return { kind: 'end', endsAt };
    }
    default:
      return { kind: 'none' };
  }
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Mercado Pago signs the webhook over `id:<data.id>;…`. Their docs say an
 * alphanumeric id goes into the manifest in lowercase; a numeric one is
 * unchanged either way. Preapproval ids are alphanumeric, payment ids are
 * numeric — this makes both safe.
 */
export function manifestId(dataId: string | number): string {
  return String(dataId).toLowerCase();
}
