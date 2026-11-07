// What one video's runs took from the balance, from the same ledger the balance
// sums (usage_events.billable_tokens) — not the engine's own figure. Pure.

export interface RunReservationRow {
  id: string;
  status: string;
  est_tokens: number;
  fee_tokens: number;
  expires_at?: string | null;
  settled_at?: string | null;
}

export interface RunEventRow {
  reservation_id: string;
  kind: string;
  billable_tokens: number | null;
}

export type RunCharge =
  /** No admitted run to look up (pre-consumption-contract video). */
  | { state: 'none' }
  | {
      /** 'reserved' while any run is still open, 'settled' once all closed. */
      state: 'reserved' | 'settled';
      /** Credits already taken from the balance. */
      charged: number;
      /** What open runs still hold on top of `charged`: same rule as
       *  usage_balance (estimate minus reported, never below 0, plus fee). */
      reserved: number;
      bySource: { kind: string; credits: number }[];
      /** A run closed moments ago: the engine reports its base fee after the
       *  settle, so the page keeps refreshing until that lands. */
      settling: boolean;
    };

const SETTLE_GRACE_MS = 2 * 60_000;

export function runCharge(
  reservations: RunReservationRow[],
  events: RunEventRow[],
  now = Date.now(),
): RunCharge {
  if (reservations.length === 0) return { state: 'none' };
  // Past its TTL an open reservation is expired, as usage_balance treats it.
  const isOpen = (r: RunReservationRow) =>
    r.status === 'open' && !(r.expires_at && Date.parse(r.expires_at) <= now);
  const spent = new Map<string, number>();
  const byKind = new Map<string, number>();
  let charged = 0;
  for (const e of events) {
    const credits = Number(e.billable_tokens ?? 0);
    if (!Number.isFinite(credits) || credits === 0) continue;
    charged += credits;
    spent.set(e.reservation_id, (spent.get(e.reservation_id) ?? 0) + credits);
    byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + credits);
  }
  let reserved = 0;
  for (const r of reservations) {
    if (!isOpen(r)) continue;
    reserved += Math.max(0, Number(r.est_tokens) - (spent.get(r.id) ?? 0)) + Number(r.fee_tokens);
  }
  const open = reservations.some(isOpen);
  return {
    state: open ? 'reserved' : 'settled',
    charged,
    reserved,
    settling: reservations.some(
      (r) => !!r.settled_at && now - Date.parse(r.settled_at) < SETTLE_GRACE_MS,
    ),
    bySource: [...byKind]
      .map(([kind, credits]) => ({ kind, credits }))
      .sort((a, b) => b.credits - a.credits),
  };
}
