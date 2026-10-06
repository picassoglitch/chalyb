// Small formatting helpers for the Clips screens. Pure.

/** The platform a link belongs to, by its customer-facing name. */
export function platformName(url: string | undefined): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith('youtube.com') || host === 'youtu.be') return 'YouTube';
  if (host.endsWith('twitch.tv')) return 'Twitch';
  if (host.endsWith('kick.com')) return 'Kick';
  if (host.endsWith('facebook.com') || host === 'fb.watch') return 'Facebook';
  return null;
}

/**
 * When monthly credits renew, written out ("1 de noviembre de 2026"). The
 * allocation regenerates on the 1st (lib/usage/tokens.ts); dates are shown in
 * America/Mexico_City (rebuild prompt §1.6).
 */
export function creditsRenewDate(now: Date, locale: string): string {
  const tz = 'America/Mexico_City';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const year = Number(parts.year);
  const month = Number(parts.month); // 1-12, in Mexico City
  // Noon UTC on the 1st of next month is the 1st in Mexico City too.
  const next = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1, 12));
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(next);
}
