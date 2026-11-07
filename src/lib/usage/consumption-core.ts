// Which reservations count toward the monthly caps. Pure, so the quota bar
// and its test read the same rule admit_usage() applies.

export interface ReservationRow {
  id: string;
  status: string;
  source_minutes: number | string | null;
}

/** What counts toward the monthly caps, as admit_usage() counts it: not
 *  cancelled, and not expired without one usage event (abandoned). */
export function countedReservations<T extends ReservationRow>(
  rows: readonly T[],
  reported: ReadonlySet<string>,
): T[] {
  return rows.filter(
    (r) => r.status !== 'cancelled' && !(r.status === 'expired' && !reported.has(r.id)),
  );
}
