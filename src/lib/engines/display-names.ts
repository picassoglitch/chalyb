// What each engine is CALLED, in one place.
//
// THE RULE: `Chaly` + the thing it does. No `b`.
//
// The `b` belongs to the platform (Chalyb) and to the wire — slugs
// (`chalybclip`), hostnames (`chalybclip.chalyb.com`), env-var prefixes
// (`CHALYBCLIP_SSO_SECRET`), column names. Those are identifiers and they do
// not change; migration 0030 is explicit that renaming them again gets
// expensive. Display names are copy, and copy has to be consistent.
//
// HOW IT DRIFTED: migration 0036 dropped the `b` from the three engines that
// actually shipped (ChalybClip → ChalyClip, ChalybOBS → ChalyOBS,
// ChalybCrypto → ChalyCrypto) to match what their own repos render, and left
// the five catalogue-only engines on the old spelling because they "have no
// product yet and no decided name". The result was one sentence reading
// "ChalyClip, ChalybStreamManager y próximos productos" — the same brand,
// spelled two ways, three words apart. Migration 0040 finishes the rename;
// this module is what stops the next hardcoded string from re-opening it.
//
// Pure data, no imports: usable from client components, server components,
// emails and tests alike.

/** slug → display name. The slug is the wire value and keeps its `b`. */
export const ENGINE_DISPLAY_NAMES: Record<string, string> = {
  // Built and shipping.
  chalybclip: 'ChalyClip',
  chalybobs: 'ChalyOBS',
  chalybcrypto: 'ChalyCrypto',
  // Catalogue — announced, not built yet.
  chalybstream: 'ChalyStreamManager',
  chalybbot: 'ChalyBot',
  chalybpicks: 'ChalyPicks',
  chalybrealtor: 'ChalyRealtor',
  chalybtrade: 'ChalyTrade',
};

/**
 * The display name for a slug.
 *
 * `fallback` is for the common case where the caller already has the name
 * from the `engines` table: pass it, and a slug this module has not been
 * told about still renders its database name instead of the raw slug. The
 * map wins when it has an entry, so a stale row in a database that has not
 * run migration 0040 still renders the canonical spelling.
 */
export function engineDisplayName(
  slug: string | null | undefined,
  fallback?: string | null,
): string {
  const key = (slug ?? '').trim().toLowerCase();
  return ENGINE_DISPLAY_NAMES[key] ?? fallback ?? (slug || 'Engine');
}

/** The three engines with a product behind them today, in display order. */
export const LIVE_ENGINE_NAMES = [
  ENGINE_DISPLAY_NAMES.chalybclip!,
  ENGINE_DISPLAY_NAMES.chalybcrypto!,
  ENGINE_DISPLAY_NAMES.chalybobs!,
] as const;
