'use server';

// Self-serve: a first-time user accepts the welcome banner on /app.
//
// What "accepting" does:
//   1. Marks profiles.welcome_gift_claimed_at = now() so the banner never
//      shows again (idempotent — re-accepting is a no-op).
//   2. Starts the 7-day ChalyClip live trial (chalybclip_trial_started_at) if
//      one isn't already running.
//   3. Best-effort provisions the user inside ChalyClip so the trial's live
//      access is usable end-to-end. Non-fatal — mirrors the launch route.
//
// The "50,000 token gift" IS the existing Free monthly allocation — there is
// no separate token grant here. The /app page just renders the real balance.
//
// THE TRIAL WAITS FOR CHALYCLIP. The 7-day clock starts only when ChalyClip is
// actually runnable (engineIsRunnable). While it is coming_soon / under
// construction, accepting records the claim and leaves the trial unstarted;
// the banner says so. A later call — the /auth/launch/chalybclip funnel runs
// this on every visit — starts the trial the first time ChalyClip is up. So
// nobody burns their seven days against an engine they could not open.
//
// Admin-side grant/revoke of the same promotions lives in promo-admin-actions.ts.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { provisionEngineAccess } from '@/lib/engines/subscriptions';
import { logAudit } from '@/lib/audit/log';
import { CHALYBCLIP_TRIAL_SLUG } from '@/lib/billing/tiers';
import { engineIsRunnable } from '@/lib/billing/readiness';
import type { EngineIntegrationMode, EngineStatus } from '@/lib/data/types';

interface ClaimResult {
  ok: boolean;
  error?: string;
  alreadyClaimed?: boolean;
  /** True when the ChalyClip trial clock is running after this call. False
   *  means the claim is recorded but the trial waits for ChalyClip to be
   *  runnable. */
  trialStarted?: boolean;
}

interface ClipRow {
  id: string;
  runnable: boolean;
}

/** The ChalyClip catalog row + whether it can actually be opened today. */
async function readChalybclip(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ClipRow | null> {
  const { data } = await admin
    .from('engines')
    .select('id, status, integration_mode, external_url')
    .eq('slug', CHALYBCLIP_TRIAL_SLUG)
    .maybeSingle();
  if (!data?.id) return null;
  return {
    id: data.id as string,
    runnable: engineIsRunnable({
      status: data.status as EngineStatus,
      integrationMode: data.integration_mode as EngineIntegrationMode,
      externalUrl: (data.external_url as string | null) ?? null,
    }),
  };
}

/** Where the claim originated. 'welcome_banner' is the self-serve banner on
 *  /app; 'chalybclip_landing_launch' is the silent claim the /auth/launch/chalybclip
 *  route runs for users who registered from the ChalyClip landing page — that
 *  value in the audit log IS the "registered via ChalyClip" marker. */
type ClaimVia = 'welcome_banner' | 'chalybclip_landing_launch';

export async function claimWelcomeGift(via: ClaimVia = 'welcome_banner'): Promise<ClaimResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };

  const userId = session.user.id;
  const admin = createAdminClient();

  const { data: before, error: readErr } = await admin
    .from('profiles')
    .select('email, welcome_gift_claimed_at, chalybclip_trial_started_at')
    .eq('id', userId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!before) return { ok: false, error: 'No encontramos tu perfil.' };

  const clip = await readChalybclip(admin);
  const existingTrial = (before.chalybclip_trial_started_at as string | null) ?? null;
  const nowIso = new Date().toISOString();

  // Idempotent — already accepted. The one thing left to do is start a trial
  // that was reserved while ChalyClip was down, now that it is up.
  if (before.welcome_gift_claimed_at) {
    if (!existingTrial && clip?.runnable) {
      const { error: lateErr } = await admin
        .from('profiles')
        .update({ chalybclip_trial_started_at: nowIso })
        .eq('id', userId)
        .is('chalybclip_trial_started_at', null);
      if (lateErr) return { ok: false, error: lateErr.message };
      await logAudit({
        action: 'promo.trial_grant',
        actorId: userId,
        actorEmail: session.user.email ?? null,
        targetUserId: userId,
        targetEmail: (before.email as string | null) ?? null,
        after: { chalybclip_trial_started_at: nowIso },
        metadata: { via, self_serve: true, deferred: true },
      });
      revalidatePath('/[locale]', 'layout');
      return { ok: true, alreadyClaimed: true, trialStarted: true };
    }
    return { ok: true, alreadyClaimed: true, trialStarted: !!existingTrial };
  }

  // Start the trial only when there is a ChalyClip to run it against. An
  // admin may already have started one; coalesce on the existing value.
  const trialStart = existingTrial ?? (clip?.runnable ? nowIso : null);

  const { error: updErr } = await admin
    .from('profiles')
    .update({
      welcome_gift_claimed_at: nowIso,
      chalybclip_trial_started_at: trialStart,
    })
    .eq('id', userId);
  if (updErr) return { ok: false, error: updErr.message };

  // Best-effort: provision the user in ChalyClip so live access works the moment
  // they open the engine. Only against a reachable engine — provisioning POSTs
  // to admin_api_base, and a dead host would hang the claim. Failure never
  // blocks the claim (the engine page has a manual reprovision backstop).
  if (clip?.runnable) {
    try {
      await provisionEngineAccess(userId, clip.id, 'manual');
    } catch (err) {
      console.warn('[welcome] chalybclip trial provisioning failed (non-fatal):', err);
    }
  }

  await logAudit({
    action: 'promo.welcome_claim',
    actorId: userId,
    actorEmail: session.user.email ?? null,
    targetUserId: userId,
    targetEmail: (before.email as string | null) ?? null,
    after: { welcome_gift_claimed_at: nowIso, chalybclip_trial_started_at: trialStart },
    metadata: { via, self_serve: true },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true, trialStarted: trialStart !== null };
}
