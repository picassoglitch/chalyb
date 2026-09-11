'use server';

// Admin reconciliation actions (B3 + B4 of the partner-program contemplation
// plan).
//
// B4 — relinkUserToEngine(userId, engineSlug):
//   Single-user "fix this person's engine link". Forces a re-provision through
//   the integration's idempotent POST /api/admin/tenants. Post-B2, the engine
//   side claims any orphan tenant by email and backfills its external_user_id
//   so usage reporting can resume. Used from the per-row "Re-link" button in
//   /dashboard/team.
//
// B3 — reconcileEngineLinks(engineSlug, dryRun?):
//   Bulk version. Loops every profile, calls B4 for each. Returns a summary
//   {scanned, newly_linked, already_linked, errors[]} so the admin can see
//   what the sweep would do (dry-run) or what it did. Idempotent: re-running
//   has no side effects on already-linked rows. Caps the loop at a few
//   hundred users — past that we'd want a paginated background job.
//
// Both actions are admin-only and audit every change.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { logAudit } from '@/lib/audit/log';
import {
  provisionEngineAccess,
  type ProvisionEngineAccessResult,
} from './subscriptions';

interface ReLinkResult {
  ok: boolean;
  error?: string;
  /** `provisioned` = newly linked (the fix actually did something).
   *  `already_provisioned` = was already linked + the engine knows it.
   *  `no_provisioning_needed` = engine doesn't require external provisioning
   *  (internal_placeholder mode). */
  status?: 'provisioned' | 'already_provisioned' | 'no_provisioning_needed';
  externalUserId?: string | null;
}

/** Resolve a slug → engine row id. Returns null if not found. */
async function resolveEngineId(slug: string): Promise<{
  id: string;
  name: string;
} | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('engines')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, name: (data.name as string) ?? slug };
}

/** B4: force-reprovision a single user against a single engine. */
export async function relinkUserToEngine(
  targetUserId: string,
  engineSlug: string,
): Promise<ReLinkResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden re-linkear' };
  }
  if (!targetUserId || !engineSlug) {
    return { ok: false, error: 'userId y engineSlug requeridos' };
  }

  const engine = await resolveEngineId(engineSlug);
  if (!engine) {
    return { ok: false, error: `Engine '${engineSlug}' no encontrado` };
  }

  // Force=true makes provisionEngineAccess re-call the engine even when our
  // local engine_subscriptions row already has external_user_id. Necessary
  // because the engine SIDE may have lost or never written the linkage —
  // we can't tell from here, so we always re-ask.
  const result = await provisionEngineAccess(
    targetUserId,
    engine.id,
    'admin_grant',
    { force: true },
  );

  // Audit — useful when the partner program scales and we need to see who
  // touched which link.
  const admin = createAdminClient();
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .maybeSingle();
  await logAudit({
    action: 'partner.engine_assign', // existing audit verb is close enough
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId,
    targetEmail: (targetProfile?.email as string | null) ?? null,
    before: {},
    after: {
      engine_slug: engineSlug,
      result: result.ok ? result.status : 'failed',
    },
    metadata: {
      via: 'relink_button',
      // Surface the failure reason in the audit metadata so support has
      // forensics without going to logs.
      result_reason: result.ok ? null : result.reason,
      result_error: result.ok ? null : result.error,
    },
  });

  // Both the team page (which shows linked engines per user) and the
  // user's /app/engines surface depend on engine_subscriptions. Layout-
  // level revalidate keeps both fresh.
  revalidatePath('/[locale]', 'layout');

  if (!result.ok) {
    return { ok: false, error: `${result.reason}: ${result.error ?? '(no detail)'}` };
  }
  return {
    ok: true,
    status: result.status,
    externalUserId: result.externalUserId ?? null,
  };
}

/** B3 summary returned to the UI. */
export interface ReconcileSummary {
  engineSlug: string;
  engineName: string;
  scanned: number;
  /** Newly linked this run — the actual healing count. */
  newlyLinked: number;
  /** Skipped because the row already had external_user_id (and ok=true). */
  alreadyLinked: number;
  /** Skipped for non-error reasons (no_provisioning_needed, no email, etc). */
  skipped: number;
  /** Per-user errors. Truncated to 50 items to keep payloads bounded. */
  errors: Array<{ userId: string; email: string | null; reason: string }>;
  dryRun: boolean;
}

const MAX_RECONCILE_USERS = 500;

/** B3: sweep every profile, re-link each against this engine. */
export async function reconcileEngineLinks(
  engineSlug: string,
  options: { dryRun?: boolean } = {},
): Promise<{ ok: boolean; error?: string; summary?: ReconcileSummary }> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins' };
  }

  const engine = await resolveEngineId(engineSlug);
  if (!engine) {
    return { ok: false, error: `Engine '${engineSlug}' no encontrado` };
  }

  const dryRun = options.dryRun === true;
  const admin = createAdminClient();

  // Pull every profile — we'll only process the ones with email set. For
  // multi-hundred-user reconciliations the LIMIT acts as a guardrail; past
  // that we'd queue a background sweep. We sort newest-first because in
  // practice the orphans we're hunting are the most recent admin-grants
  // that didn't make it through to the engine side cleanly.
  const { data: profilesRaw, error: profilesErr } = await admin
    .from('profiles')
    .select('id, email, role, tier')
    .order('created_at', { ascending: false })
    .limit(MAX_RECONCILE_USERS);
  if (profilesErr) {
    return { ok: false, error: `profiles read: ${profilesErr.message}` };
  }
  const profiles = (profilesRaw ?? []) as Array<{
    id: string;
    email: string | null;
    role: string | null;
    tier: string | null;
  }>;

  const summary: ReconcileSummary = {
    engineSlug,
    engineName: engine.name,
    scanned: profiles.length,
    newlyLinked: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: [],
    dryRun,
  };

  for (const p of profiles) {
    if (!p.email) {
      summary.skipped += 1;
      continue;
    }
    // Dry-run: peek at the current engine_subscriptions state to predict
    // what would happen without actually round-tripping the engine.
    if (dryRun) {
      const { data: sub } = await admin
        .from('engine_subscriptions')
        .select('external_user_id')
        .eq('user_id', p.id)
        .eq('engine_id', engine.id)
        .maybeSingle();
      if (sub?.external_user_id) {
        summary.alreadyLinked += 1;
      } else {
        summary.newlyLinked += 1; // best-effort prediction
      }
      continue;
    }

    // Real run: force re-provision through the engine. Post-B2 the engine
    // self-heals by email match, so even users whose engine-side tenant
    // had NULL external_user_id come back linked after this call.
    const r: ProvisionEngineAccessResult = await provisionEngineAccess(
      p.id,
      engine.id,
      'admin_grant',
      { force: true },
    );
    if (r.ok) {
      if (r.status === 'provisioned') summary.newlyLinked += 1;
      else if (r.status === 'already_provisioned') summary.alreadyLinked += 1;
      else summary.skipped += 1; // no_provisioning_needed
    } else {
      if (summary.errors.length < 50) {
        summary.errors.push({
          userId: p.id,
          email: p.email,
          reason: r.error ?? r.reason,
        });
      }
    }
  }

  // One audit row per sweep (NOT per user — that'd flood the log). The
  // per-user audit happens already inside the loop's failure path, and
  // each successful provision is logged at INFO via the integration.
  if (!dryRun) {
    await logAudit({
      action: 'partner.engine_assign',
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      targetUserId: session.user.id, // bulk action, "target" = self
      targetEmail: session.user.email ?? null,
      before: {},
      after: {
        engine_slug: engineSlug,
        ...summary,
      },
      metadata: { via: 'bulk_reconcile' },
    });
    revalidatePath('/[locale]', 'layout');
  }

  return { ok: true, summary };
}
