// Mi perfil · Zona horaria (FIX-3 §C.2 row 8). The stored value stays IANA;
// people see a city and the offset Intl computes right now (never written
// by hand, so daylight saving shows correctly). Pure.

export const TIMEZONES = [
  'America/Mexico_City',
  'America/Tijuana',
  'America/Hermosillo',
  'America/Cancun',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
] as const;
export type TimezoneId = (typeof TIMEZONES)[number];

export function isKnownTimezone(v: unknown): v is TimezoneId {
  return typeof v === 'string' && (TIMEZONES as readonly string[]).includes(v);
}

/** "UTC−6", "UTC+2", "UTC+5:30" for a zone at an instant. */
export function utcOffsetLabel(tz: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  // "GMT-06:00" | "GMT+02:00" | "GMT"
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(part ?? '');
  if (!m) return 'UTC';
  const h = String(Number(m[2]));
  const mins = m[3] === '00' ? '' : `:${m[3]}`;
  return `UTC${m[1] === '-' ? '−' : '+'}${h}${mins}`;
}

/** The zone to preselect: the saved one, else the browser's when it's on
 *  the list, else Mexico City. */
export function initialTimezone(saved: string | null, browser: string | null): TimezoneId {
  if (isKnownTimezone(saved)) return saved;
  if (isKnownTimezone(browser)) return browser;
  return 'America/Mexico_City';
}
