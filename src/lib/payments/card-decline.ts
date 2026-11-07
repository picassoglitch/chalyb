// Why Mercado Pago refused a card, as the kinds the checkout words differently
// (owner, 2026-11-07: a risk rejection was shown as "tu banco no aceptó"). Pure.

/** What the buyer can do about it decides the kind, not MP's exact code. */
export type DeclineReason =
  | 'risk'
  | 'funds'
  | 'authorize'
  | 'card_data'
  | 'disabled'
  | 'max_attempts'
  | 'duplicated'
  | 'bank'
  | 'unknown';

export const DECLINE_REASONS: readonly DeclineReason[] = [
  'risk',
  'funds',
  'authorize',
  'card_data',
  'disabled',
  'max_attempts',
  'duplicated',
  'bank',
  'unknown',
];

const DETAIL_RE = /\bcc_rejected_[a-z_]+\b/i;

/** The `cc_rejected_*` status_detail anywhere in what the SDK threw; null when
 *  Mercado Pago only gave a generic code such as CC_VAL_433. */
export function rejectionDetailOf(err: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (v: unknown, depth: number): string | null => {
    if (typeof v === 'string') return DETAIL_RE.exec(v)?.[0].toLowerCase() ?? null;
    if (!v || typeof v !== 'object' || depth > 4 || seen.has(v)) return null;
    seen.add(v);
    // Error.message is not enumerable; read it first.
    if (v instanceof Error) {
      const hit = walk(v.message, depth + 1);
      if (hit) return hit;
    }
    for (const child of Object.values(v as Record<string, unknown>)) {
      const hit = walk(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return walk(err, 0);
}

/** Mercado Pago's status_detail → the kind of decline the buyer is told. */
export function declineReasonOf(detail: string | null | undefined): DeclineReason {
  const d = (detail ?? '').trim().toLowerCase();
  if (!d) return 'unknown';
  if (d === 'cc_rejected_high_risk' || d === 'cc_rejected_blacklist') return 'risk';
  if (d === 'cc_rejected_insufficient_amount') return 'funds';
  if (d === 'cc_rejected_call_for_authorize') return 'authorize';
  if (d.startsWith('cc_rejected_bad_filled_')) return 'card_data';
  if (d === 'cc_rejected_card_disabled') return 'disabled';
  if (d === 'cc_rejected_max_attempts') return 'max_attempts';
  if (d === 'cc_rejected_duplicated_payment') return 'duplicated';
  if (d.startsWith('cc_rejected_')) return 'bank';
  return 'unknown';
}

/** A reason from an API answer, or 'unknown' for anything else. */
export function asDeclineReason(v: unknown): DeclineReason {
  return DECLINE_REASONS.includes(v as DeclineReason) ? (v as DeclineReason) : 'unknown';
}
