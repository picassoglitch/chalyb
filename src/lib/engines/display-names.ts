// What each tool is CALLED, in one place.
//
// THE RULE (BUILD-SPEC §0.2, rebuild prompt §4): customers see the tool's
// plain name — Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles,
// Inversiones. "Chalyb" appears only as the logo and in "Chalyb Pro". The old
// "Chaly" + thing names (ChalyClip, ChalyOBS, …) are gone from customer UI.
//
// Identifiers do NOT change: slugs (`chalybclip`), hostnames, env-var prefixes
// (`CHALYBCLIP_SSO_SECRET`), table and column names stay exactly as they are.
// Migration 0041 writes the same names into engines.name; this map wins over a
// database that has not run it yet.
//
// Pure data, no imports: usable from client components, server components,
// emails and tests alike.

/** slug → customer-facing tool name. */
export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  chalybclip: 'Clips',
  chalybcrypto: 'Señales',
  chalybobs: 'En vivo',
  chalybbot: 'Asistente',
  chalybpicks: 'Pronósticos',
  chalybrealtor: 'Inmuebles',
  chalybtrade: 'Inversiones',
  // TODO(owner) Q32: not one of the seven tools and has no customer name yet.
  // Kept as an internal label; customer lists never show it (see
  // HIDDEN_FROM_CUSTOMERS).
  chalybstream: 'Stream Manager',
};

/** Slugs that never appear in customer lists, counts or the sitemap, whatever
 *  their status (Q32). */
export const HIDDEN_FROM_CUSTOMERS: ReadonlySet<string> = new Set(['chalybstream']);

/** Tool colors from the design system (`more_shared.py` TOOLS). */
export const TOOL_COLORS: Record<string, string> = {
  chalybclip: '#5B4BFF',
  chalybcrypto: '#FF9F0A',
  chalybobs: '#FF375F',
  chalybbot: '#30B0C7',
  chalybpicks: '#34A853',
  chalybrealtor: '#0A84FF',
  chalybtrade: '#AF52DE',
};

/**
 * The display name for a slug.
 *
 * `fallback` is for the common case where the caller already has the name
 * from the `engines` table: a slug this module has not been told about still
 * renders its database name instead of the raw slug.
 */
export function engineDisplayName(
  slug: string | null | undefined,
  fallback?: string | null,
): string {
  const key = (slug ?? '').trim().toLowerCase();
  return ENGINE_DISPLAY_NAMES[key] ?? fallback ?? (slug || '');
}

/** The three tools with a product behind them today, in display order. */
export const LIVE_ENGINE_NAMES = [
  ENGINE_DISPLAY_NAMES.chalybclip!,
  ENGINE_DISPLAY_NAMES.chalybcrypto!,
  ENGINE_DISPLAY_NAMES.chalybobs!,
] as const;
