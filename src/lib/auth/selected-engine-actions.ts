'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from './session';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { provisionEngineAccess } from '@/lib/engines/subscriptions';
import { pauseOtherActiveEngines } from '@/lib/engines/mutual-exclusion';

export async function setSelectedLiveEngine(
  engineId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };

  // FREE has no live engines; VIP doesn't need a selection.
  // We block the action for those tiers so callers can't accidentally write a
  // selection that does nothing — keeps profiles.selected_engine_id meaningful.
  const caps = TIER_CAPS[session.tier];
  if (caps.liveEnginesCount === 0) {
    return { ok: false, error: 'Tu plan todavía no corre engines En vivo. Cámbiate a Pro o VIP para activarlos.' };
  }
  if (caps.liveEnginesCount === Infinity) {
    return {
      ok: false,
      error: 'Con VIP todos tus engines ya están En vivo, así que no hay nada que elegir.',
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ selected_engine_id: engineId })
    .eq('id', session.user.id);

  if (error) return { ok: false, error: error.message };

  // Auto-provision engine access — selecting your live engine on PRO is
  // equivalent to "buying in". The subscription row is what unlocks the
  // workspace page and (eventually) holds external API credentials.
  if (engineId) {
    await provisionEngineAccess(session.user.id, engineId, 'pro_selection');
    // Mutual exclusion: PRO subscribers can have ONLY ONE engine running at
    // a time. Pause every other active engine_subscription for this user so
    // they can't cross-use multiple engines and abuse the single-slot tier.
    // VIP is not subject to this — they pay for parallel.
    await pauseOtherActiveEngines(session.user.id, engineId);
  }

  // Layout-level revalidation covers /app/engines, /app/subscription, sidebar pill, etc.
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
// NOTE: don't add re-export aliases here. 'use server' modules are restricted
// to direct `export async function` declarations only — Turbopack drops the
// original export if a renamed re-export is present alongside, breaking imports
// of the canonical name.
