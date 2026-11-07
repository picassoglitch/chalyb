// Which reservations count toward the monthly caps. Pure, so the quota bar
// and its test read the same rule admit_usage() applies.

export interface ReservationRow {
  id: string;
  status: string;
  source_minutes: number | string | null;
  created_at: string;
}

/** Failed jobs a month that don't count (admit_usage, 20261107000300). */
export const FREE_FAILED_RETRIES = 3;

/** What counts toward the monthly job caps, as admit_usage() counts it: not
 *  cancelled, not expired without one usage event (abandoned), and not one of
 *  the month's first FREE_FAILED_RETRIES failed jobs (earliest first). */
export function countedReservations<T extends ReservationRow>(
  rows: readonly T[],
  reported: ReadonlySet<string>,
): T[] {
  const live = rows.filter(
    (r) => r.status !== 'cancelled' && !(r.status === 'expired' && !reported.has(r.id)),
  );
  const free = new Set(
    live
      .filter((r) => r.status === 'failed')
      .sort((a, b) => byCreatedThenId(a, b))
      .slice(0, FREE_FAILED_RETRIES)
      .map((r) => r.id),
  );
  return live.filter((r) => !free.has(r.id));
}

// created_at, then id, as the SQL orders them. Same millisecond: PostgREST's
// UTC strings carry microseconds and compare in order as text.
function byCreatedThenId(a: ReservationRow, b: ReservationRow): number {
  const ms = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (ms !== 0) return ms;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
