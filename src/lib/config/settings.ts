// Owner settings that save (P5-6), in public.app_settings. Read per request;
// a failed read falls back to the env default, never to "off".

import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBillingToggle } from '@/config/pricing';
import { PACK_PRICES_SETTING, parsePackPricing, type PackPricing } from '@/config/pack-pricing';
import { trialPlanChoiceEnabled } from './flags';

export const SETTING_KEYS = {
  billingToggle: 'billing_toggle_enabled',
  usageMargin: 'usage_margin_percent',
  packPrices: PACK_PRICES_SETTING,
} as const;

/** Margin on top of real provider cost when usage is charged to a balance.
 *  Postgres reads the same key when it prices each usage event
 *  (usage_margin_percent(), migration 0046); this default must match. */
export const DEFAULT_USAGE_MARGIN_PERCENT = 160;
export const MAX_USAGE_MARGIN_PERCENT = 500;

const readSetting = cache(async (key: string): Promise<unknown> => {
  try {
    const { data, error } = await createAdminClient()
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.value;
  } catch (e) {
    console.error('[settings] read failed', key, e instanceof Error ? e.message : e);
    return undefined;
  }
});

/** Mensual/Anual: the saved override, else TRIAL_PLAN_CHOICE_ENABLED. */
export async function billingToggleEnabled(): Promise<boolean> {
  return resolveBillingToggle(await readSetting(SETTING_KEYS.billingToggle), trialPlanChoiceEnabled());
}

/** The saved usage margin, else the default. */
export async function usageMarginPercent(): Promise<number> {
  const v = await readSetting(SETTING_KEYS.usageMargin);
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(MAX_USAGE_MARGIN_PERCENT, Math.max(0, v))
    : DEFAULT_USAGE_MARGIN_PERCENT;
}

/** The credit-pack prices in force, or null when the row is missing,
 *  unreadable or malformed. Null is never replaced by a default: whoever
 *  charges refuses, whoever displays says the store is unavailable. */
export async function packPricing(): Promise<PackPricing | null> {
  const parsed = parsePackPricing(await readSetting(SETTING_KEYS.packPrices));
  if (!parsed) console.error('[settings] pack_prices missing or invalid: pack checkout is closed');
  return parsed;
}

export async function writeSetting(key: string, value: unknown, actorId: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: actorId }, { onConflict: 'key' });
  if (error) console.error('[settings] write failed', key, error.message);
  return !error;
}
