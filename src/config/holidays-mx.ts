// Mexican official rest days (O-18), for counting business days (días
// hábiles): the chargeback notice deadline (Términos de Suscripción §10.5) and
// the 5-business-day refund of an overcharge (§7.2(d), LFPC art. 91).
//
// The fixed list is Ley Federal del Trabajo art. 74: 1 Jan, first Monday of
// February, third Monday of March, 1 May, 16 Sep, third Monday of November,
// 1 Oct when the federal executive changes (every six years from 2024) and
// 25 Dec. EXTRA holds one-off days the owner adds (election days, decrees).
// TODO(owner O-18): confirm the calendar and add EXTRA days as they're set.

const EXTRA: readonly string[] = [];

/** Mexico City has had no daylight saving time since 2022: UTC−6 all year. */
export const MX_UTC_OFFSET_HOURS = -6;

function nthMonday(year: number, month: number, n: number): number {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return 1 + ((8 - first) % 7) + (n - 1) * 7;
}

const pad = (n: number) => String(n).padStart(2, '0');
const key = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Every official rest day of a year, as YYYY-MM-DD. */
export function mxHolidays(year: number): Set<string> {
  const days = new Set<string>([
    key(year, 0, 1),
    key(year, 1, nthMonday(year, 1, 1)),
    key(year, 2, nthMonday(year, 2, 3)),
    key(year, 4, 1),
    key(year, 8, 16),
    key(year, 10, nthMonday(year, 10, 3)),
    key(year, 11, 25),
  ]);
  if (year >= 2024 && (year - 2024) % 6 === 0) days.add(key(year, 9, 1));
  for (const d of EXTRA) if (d.startsWith(`${year}-`)) days.add(d);
  return days;
}

/** Whether a Mexico City calendar day (YYYY-MM-DD) is a business day. */
export function isMxBusinessDay(ymd: string): boolean {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow !== 0 && dow !== 6 && !mxHolidays(y).has(ymd);
}
