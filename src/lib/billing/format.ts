// Money and date formatting for everything billing shows (rebuild prompt
// P2-10). Pure.

/** "$868.84", "$7,490": whole pesos print without decimals. Never a currency
 *  code here — copy adds "MXN" where the rules ask for it. */
export function formatMXN(cents: number): string {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  })}`;
}

const TZ = 'America/Mexico_City';

/** "30 de octubre de 2026" (es) / "October 30, 2026" (en), in Mexico City
 *  time. Stored timestamps are UTC; only the display is local. */
export function formatFechaLarga(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    timeZone: TZ,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(typeof date === 'string' ? new Date(date) : date);
}

/** "15 oct." — short form for tight rows. */
export function formatFechaCorta(date: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
  }).format(typeof date === 'string' ? new Date(date) : date);
}
