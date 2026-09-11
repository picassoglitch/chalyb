// Engine subscription provisioning helpers.
//
// All inserts go through the service-role admin client because:
//   - RLS denies anon/auth writes on engine_subscriptions on purpose
//   - The MP webhook has no session, only the service role
//   - Env-locked admin sessions can't write through user-scoped RLS
//
// Idempotency: every insert uses `on conflict (user_id, engine_id) do update`
// so re-running provisioning during retries / re-selection just bumps status +
// updated_at instead of erroring.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveTier as computeEffectiveTier } from '@/lib/billing/tiers';
import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import { getIntegration } from './integrations/registry';

type SubscriptionSource =
  | 'manual'
  | 'pro_selection'
  | 'all_access_seed'
  | 'admin_grant'
  | 'mp_payment';

/** Create/reactivate a single engine subscription for a user.
 *
 *  Two-step:
 *    1. Upsert the Chalyb side row in engine_subscriptions.
 *    2. If the engine `requires_provisioning`, call its integration client to
 *       create the user inside the external engine, then update the row with
 *       external_user_id + external_credentials.
 *
 *  Step 2 failures don't roll back step 1 — the row stays so the admin can
 *  retry provisioning later from the management page. We log loudly so the
 *  failure is visible.
 */
export async function provisionEngineAccess(
  userId: string,
  engineId: string,
  source: SubscriptionSource,
  options: { force?: boolean } = {},
): Promise<ProvisionEngineAccessResult> {
  const admin = createAdminClient();

  // Step 1: ensure the access row exists on our side.
  const { data: upserted, error: upsertErr } = await admin
    .from('engine_subscriptions')
    .upsert(
      {
        user_id: userId,
        engine_id: engineId,
        status: 'active',
        source,
      },
      { onConflict: 'user_id,engine_id' },
    )
    .select('external_user_id')
    .maybeSingle();

  if (upsertErr) {
    console.error('[engine_subs] provision failed', { userId, engineId, source }, upsertErr.message);
    return { ok: false, reason: 'db_write_failed', error: upsertErr.message };
  }

  // Skip external provisioning if we already have a tenant id stored — the
  // engine integration is idempotent but the round-trip is wasteful.
  // `force` overrides this for the reconciliation paths (per-user re-link
  // button + bulk reconcile sweep): we WANT to round-trip even when the
  // local row says it's already provisioned because the engine side may
  // have lost or never properly stored its link (CLI-era tenants on the
  // engine side, deploy that wiped state, etc).
  if (upserted?.external_user_id && !options.force) {
    return {
      ok: true,
      status: 'already_provisioned',
      externalUserId: upserted.external_user_id as string,
    };
  }

  // Step 2: fetch engine + user details for external provisioning.
  // Also pull role + tier so we can compute the effective tier (admin override
  // applied) and ship it to the engine — the engine writes that to its own
  // tier column so the user lands as Pro/VIP from the first login.
  const [{ data: engineRow }, { data: profile }] = await Promise.all([
    admin
      .from('engines')
      .select(
        'id, slug, name, requires_provisioning, admin_api_base, external_url, integration_mode',
      )
      .eq('id', engineId)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('email, full_name, role, tier')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  if (!engineRow?.requires_provisioning) {
    return { ok: true, status: 'no_provisioning_needed' };
  }

  const integration = getIntegration(engineRow.slug as string);
  if (!integration) {
    console.warn(
      `[engine_subs] no integration registered for slug=${engineRow.slug} — skipping external provisioning`,
    );
    return {
      ok: false,
      reason: 'no_integration',
      error: `No integration registered for slug=${engineRow.slug}`,
    };
  }

  if (!profile?.email) {
    console.error('[engine_subs] cannot provision externally: profile missing email', userId);
    return { ok: false, reason: 'missing_profile_email' };
  }

  // Effective tier — admin override applied. Admins land as VIP on the
  // engine even if their stored profiles.tier is FREE (which it usually is for
  // env-locked admins: we never billed them).
  const role = (profile.role as UserRole | undefined) ?? 'VIEWER';
  const storedTier = (profile.tier as SubscriptionTier | undefined) ?? 'FREE';
  const tier = computeEffectiveTier(role, storedTier);

  // Build a partial Engine object — integration only needs a handful of fields.
  const engineForIntegration = {
    id: engineRow.id as string,
    slug: engineRow.slug as string,
    name: engineRow.name as string,
    externalUrl: engineRow.external_url as string | null,
    adminApiBase: engineRow.admin_api_base as string | null,
    integrationMode: engineRow.integration_mode as 'internal_placeholder' | 'external_sso_redirect' | 'iframe_embed',
    requiresProvisioning: engineRow.requires_provisioning as boolean,
  } as Parameters<typeof integration.provision>[0]['engine'];

  const result = await integration.provision({
    userId,
    email: profile.email as string,
    fullName: (profile.full_name as string | null) ?? null,
    effectiveTier: tier,
    engine: engineForIntegration,
  });

  if (!result.ok) {
    console.error(
      `[engine_subs] external provisioning failed for ${engineRow.slug}`,
      result.reason,
      result.error,
    );
    return {
      ok: false,
      reason: result.reason ?? 'unknown',
      error: result.error,
    };
  }

  // Persist what the integration gave us back.
  const { error: writeErr } = await admin
    .from('engine_subscriptions')
    .update({
      external_user_id: result.externalUserId ?? null,
      external_credentials: result.credentials ?? null,
    })
    .eq('user_id', userId)
    .eq('engine_id', engineId);

  if (writeErr) {
    console.error('[engine_subs] credential persist failed', writeErr.message);
    return {
      ok: false,
      reason: 'db_write_failed',
      error: writeErr.message,
    };
  }
  return {
    ok: true,
    status: 'provisioned',
    externalUserId: (result.externalUserId as string | undefined) ?? null,
  };
}

// Result shape from provisionEngineAccess. Existing callers ignore the
// return value (it was previously void) so this is purely additive — the
// reconciliation paths use it to decide whether each user was newly-linked,
// already-linked, or errored.
export type ProvisionEngineAccessResult =
  | {
      ok: true;
      /** `provisioned` = new external link established this call.
       *  `already_provisioned` = local row already had external_user_id.
       *  `no_provisioning_needed` = engine doesn't require external provisioning. */
      status: 'provisioned' | 'already_provisioned' | 'no_provisioning_needed';
      externalUserId?: string | null;
    }
  | {
      ok: false;
      reason: string;
      error?: string;
    };

/** Seed subscriptions for ALL currently-active engines in the user's org.
 *  Called when a user reaches VIP (admin grant, MP payment for top tier,
 *  or env-locked admin promotion). */
export async function provisionAllAccessEngines(
  userId: string,
  source: SubscriptionSource = 'all_access_seed',
): Promise<{ provisioned: number }> {
  const admin = createAdminClient();

  // Look up the user's org so we only seed engines they should see.
  const { data: profile } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.org_id) {
    console.warn('[engine_subs] provisionAllAccess: user has no org_id', userId);
    return { provisioned: 0 };
  }

  // Pull active engines in that org.
  const { data: engines } = await admin
    .from('engines')
    .select('id')
    .eq('org_id', profile.org_id)
    .eq('status', 'active');
  if (!engines || engines.length === 0) return { provisioned: 0 };

  const rows = engines.map((e) => ({
    user_id: userId,
    engine_id: e.id as string,
    status: 'active',
    source,
  }));

  const { error } = await admin
    .from('engine_subscriptions')
    .upsert(rows, { onConflict: 'user_id,engine_id' });
  if (error) {
    console.error('[engine_subs] bulk provision failed', error.message);
    return { provisioned: 0 };
  }
  return { provisioned: rows.length };
}

/** Has this user been provisioned for this engine? Returns the subscription
 *  row or null. Used by the engine workspace page to show "Tu acceso" status. */
export async function getEngineAccess(userId: string, engineId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from('engine_subscriptions')
    .select('id, status, external_user_id, source, created_at')
    .eq('user_id', userId)
    .eq('engine_id', engineId)
    .maybeSingle();
  return data as
    | {
        id: string;
        status: 'active' | 'paused' | 'cancelled';
        external_user_id: string | null;
        source: SubscriptionSource;
        created_at: string;
      }
    | null;
}

/** Lazy provisioning for admins — when an admin (effective VIP via role
 *  override) hits /app/engines/[slug], we ensure they have a fully-provisioned
 *  access record. "Fully provisioned" = row exists AND (if the engine requires
 *  external provisioning) external_user_id is populated.
 *
 *  This handles two distinct cases:
 *    (a) No row at all → create it + call integration.
 *    (b) Row exists but external_user_id is NULL → call integration only.
 *        This is the common case for admins backfilled by migration 0011
 *        before the integration secrets were configured. */
export async function ensureAdminEngineAccess(
  userId: string,
  engineId: string,
): Promise<void> {
  const existing = await getEngineAccess(userId, engineId);
  // Row exists AND has the external link → fully provisioned, nothing to do.
  if (existing && existing.external_user_id) return;
  // Otherwise: either create + provision (no row), or just provision
  // (row already there but external_user_id missing). provisionEngineAccess
  // handles both branches via upsert + the existing skip-if-already-set check.
  await provisionEngineAccess(userId, engineId, 'admin_grant');
}

/** Manually trigger re-provisioning. Used by the admin "Re-provisionar" CTA
 *  on /app/engines/[slug] when the lazy auto-retry can't fix it (e.g. the
 *  external service was down on first visit, or env vars changed). Returns
 *  whether the row now has an external_user_id so the UI can show
 *  success vs "still failing, check the server log". */
export async function retryEngineProvisioning(
  userId: string,
  engineId: string,
): Promise<{ ok: boolean; externalUserId: string | null }> {
  await provisionEngineAccess(userId, engineId, 'admin_grant');
  const row = await getEngineAccess(userId, engineId);
  return {
    ok: Boolean(row?.external_user_id),
    externalUserId: row?.external_user_id ?? null,
  };
}
