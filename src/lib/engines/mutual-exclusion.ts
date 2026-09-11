// Mutual-exclusion enforcement for PRO subscribers.
//
// PRO = exactly ONE engine running live at a time. When the user switches
// their live selection (or activates a different engine for the first time),
// every OTHER active engine_subscription for that user gets:
//   1. status flipped to 'paused' in our DB
//   2. an outbound call to the engine's pause API so the engine itself stops
//      running jobs / spending tokens / publishing for this tenant
//
// VIP subscribers are exempt — they pay for parallel execution and
// should never be paused by another engine becoming active.
//
// Failure mode: if the engine pause API fails, we still leave the DB in
// 'paused' state. The next time we sync (e.g. via SSO login or admin
// re-grant) we'll re-attempt. Better to be inconsistent for a few minutes
// than to leave the user with two engines competing for one slot.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getIntegration } from './integrations/registry';

interface PauseAttempt {
  engineId: string;
  engineSlug: string;
  ok: boolean;
  error?: string;
}

/** Pause every active engine_subscription for `userId` EXCEPT `keepActiveEngineId`.
 *  Returns per-engine outcomes for logging / surface back to caller. */
export async function pauseOtherActiveEngines(
  userId: string,
  keepActiveEngineId: string,
): Promise<{ paused: PauseAttempt[] }> {
  const admin = createAdminClient();

  // Look up every active subscription this user has + the matching engine
  // metadata in one round-trip via a foreign-table embed.
  const { data: rows, error } = await admin
    .from('engine_subscriptions')
    .select(
      'engine_id, external_user_id, engines(id, slug, name, external_url, admin_api_base, integration_mode, requires_provisioning)',
    )
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('engine_id', keepActiveEngineId);

  if (error) {
    console.error('[mutual_exclusion] lookup failed', error.message);
    return { paused: [] };
  }

  const attempts: PauseAttempt[] = [];

  for (const row of rows ?? []) {
    const engineId = row.engine_id as string;
    // Supabase embeds foreign tables as either an object or a single-element
    // array depending on schema metadata; normalize.
    const engineRaw = row.engines as unknown;
    const engineRow = Array.isArray(engineRaw) ? engineRaw[0] : engineRaw;
    if (!engineRow) {
      attempts.push({ engineId, engineSlug: '?', ok: false, error: 'engine row missing' });
      continue;
    }
    const slug = (engineRow as { slug: string }).slug;
    const externalUserId = (row.external_user_id as string | null) ?? '';

    // Step 1: flip our DB row to paused FIRST so even if the outbound call
    // fails, the rest of Chalyb (workspace UI, future quota checks) sees
    // the user as not-active on this engine.
    await admin
      .from('engine_subscriptions')
      .update({ status: 'paused' })
      .eq('user_id', userId)
      .eq('engine_id', engineId);

    // Step 2: notify the engine itself. Best-effort.
    const integration = getIntegration(slug);
    if (!integration) {
      // No outbound integration registered (engine is internal-placeholder
      // or hasn't shipped its pause API yet). DB-only pause is enough.
      attempts.push({ engineId, engineSlug: slug, ok: true });
      continue;
    }

    if (!externalUserId) {
      // Never provisioned externally — nothing for the engine to pause.
      attempts.push({ engineId, engineSlug: slug, ok: true });
      continue;
    }

    const result = await integration.pause({
      userId,
      externalUserId,
      engine: {
        id: (engineRow as { id: string }).id,
        slug,
        name: (engineRow as { name: string }).name,
        externalUrl: (engineRow as { external_url: string | null }).external_url,
        adminApiBase: (engineRow as { admin_api_base: string | null }).admin_api_base,
        integrationMode: (engineRow as { integration_mode: 'internal_placeholder' | 'external_sso_redirect' | 'iframe_embed' }).integration_mode,
        requiresProvisioning: (engineRow as { requires_provisioning: boolean }).requires_provisioning,
      } as Parameters<typeof integration.pause>[0]['engine'],
    });

    if (!result.ok) {
      console.error(
        `[mutual_exclusion] pause failed for ${slug}`,
        result.reason,
        result.error,
      );
    }
    attempts.push({
      engineId,
      engineSlug: slug,
      ok: result.ok,
      error: result.ok ? undefined : result.error,
    });
  }

  return { paused: attempts };
}
