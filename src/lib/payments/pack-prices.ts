// The credit-pack prices in force, on the server: the owner's setting
// (app_settings.pack_prices) turned into totals and priced packs. Every
// surface that shows or charges a pack reads THIS — the store, the checkout
// page, the checkout action, the webhook's price gate and /legal/packs.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { packPricing } from '@/lib/config/settings';
import { packTotals, type PackPricing } from '@/config/pack-pricing';
import { currentVersion, renderedSource } from '@/lib/legal/registry';
import { pricedTokenPacks, type PackTotals, type TokenPack } from './pricing';

export interface PricedPacks {
  pricing: PackPricing;
  totals: PackTotals;
  packs: TokenPack[];
}

/** Null when the setting is missing or invalid: the caller refuses to sell. */
export async function loadPricedPacks(): Promise<PricedPacks | null> {
  const pricing = await packPricing();
  if (!pricing) return null;
  const totals = packTotals(pricing);
  return { pricing, totals, packs: pricedTokenPacks(totals) };
}

/** The Paquetes terms as a buyer reads them with these totals (a published
 *  version shows the prices it was published with). */
export function packTermsText(totals: PackTotals): string | null {
  return renderedSource('paquetes', currentVersion('paquetes'), totals);
}

/** The consent event a pack checkout records (consent_events.event_type). */
export const PACK_CONSENT_EVENT = 'pack_purchase_accepted';

/**
 * Totals this person accepted for this pack in the last `days` (their
 * consent events). The webhook's gate honours them, so a price the owner
 * changes while someone is paying never refuses (and auto-refunds) the
 * amount that person saw and accepted. Throws when the log can't be read.
 */
export async function acceptedPackCents(
  userId: string,
  packId: string,
  now: Date = new Date(),
  days = 7,
): Promise<number[]> {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createAdminClient()
    .from('consent_events')
    .select('amount_mxn')
    .eq('user_id', userId)
    .eq('event_type', PACK_CONSENT_EVENT)
    .eq('plan_id', packId)
    .gte('timestamp_utc', since)
    .limit(50);
  if (error) throw new Error(`pack consent read failed: ${error.message}`);
  return (data ?? [])
    .map((r) => Math.round(Number(r.amount_mxn) * 100))
    .filter((c) => Number.isInteger(c) && c > 0);
}
