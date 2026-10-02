// Owner settings that save (P5-6), in public.app_settings. Read per request;
// a failed read falls back to the env default, never to "off".

import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveBillingToggle } from '@/config/pricing';
import { trialPlanChoiceEnabled } from './flags';

export const SETTING_KEYS = { billingToggle: 'billing_toggle_enabled' } as const;

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

export async function writeSetting(key: string, value: unknown, actorId: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: actorId }, { onConflict: 'key' });
  if (error) console.error('[settings] write failed', key, error.message);
  return !error;
}
