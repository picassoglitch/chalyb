'use server';

// Admin-only: grant / revoke the onboarding promotions for any user, from
// /dashboard/team. Mirrors token-grant-actions.ts (admin gate + audit +
// layout revalidate).
//
// Three levers, all writing to profiles (migration 0025):
//   - grantChalybclipTrial : start a fresh 7-day ChalybClip live trial (now()).
//                          Re-granting resets the clock to a full 7 days.
//   - revokeChalybclipTrial : end the trial immediately (chalybclip_trial_started_at = NULL).
//   - resetWelcomeGift    : clear welcome_gift_claimed_at so the welcome banner
//                           shows again on the user's next /app visit.
//
// Trial length is fixed at CHALYBCLIP_TRIAL_DAYS (the helper that gates live
// access is duration-fixed); "modifying" a promotion = granting again (extends
// to a fresh window) or revoking.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole, CHALYBCLIP_TRIAL_SLUG } from '@/lib/billing/tiers';
import { provisionEngineAccess } from '@/lib/engines/subscriptions';
import { logAudit } from '@/lib/audit/log';

interface PromoResult {
  ok: boolean;
  error?: string;
  /** New trial start (ISO) after the change, or null when no trial. */
  trialStartedAt?: string | null;
}

/** Shared admin gate + target read. */
async function authorize(
  targetUserId: string,
): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      actorId: string;
      actorEmail: string | null;
      admin: ReturnType<typeof createAdminClient>;
      targetEmail: string | null;
    }
> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!isAdminRole(session.role)) {
    return { ok: false, error: 'Solo admins pueden gestionar promociones' };
  }
  if (!targetUserId) return { ok: false, error: 'Usuario inválido' };

  const admin = createAdminClient();
  const { data: before, error: readErr } = await admin
    .from('profiles')
    .select('email')
    .eq('id', targetUserId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!before) return { ok: false, error: 'Usuario no encontrado' };

  return {
    ok: true,
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    admin,
    targetEmail: (before.email as string | null) ?? null,
  };
}

/** Start (or extend, by resetting to a fresh window) a user's ChalybClip trial. */
export async function grantChalybclipTrial(
  targetUserId: string,
  reason: string | null = null,
): Promise<PromoResult> {
  const auth = await authorize(targetUserId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const nowIso = new Date().toISOString();
  const { error: updErr } = await auth.admin
    .from('profiles')
    .update({ chalybclip_trial_started_at: nowIso })
    .eq('id', targetUserId);
  if (updErr) return { ok: false, error: updErr.message };

  // Best-effort provision so the trial is live-usable immediately.
  try {
    const { data: engine } = await auth.admin
      .from('engines')
      .select('id')
      .eq('slug', CHALYBCLIP_TRIAL_SLUG)
      .maybeSingle();
    if (engine?.id) {
      await provisionEngineAccess(targetUserId, engine.id as string, 'admin_grant');
    }
  } catch (err) {
    console.warn('[promo] chalybclip trial provisioning failed (non-fatal):', err);
  }

  await logAudit({
    action: 'promo.trial_grant',
    actorId: auth.actorId,
    actorEmail: auth.actorEmail,
    targetUserId,
    targetEmail: auth.targetEmail,
    after: { chalybclip_trial_started_at: nowIso },
    metadata: { reason, via: 'team_page', engine: CHALYBCLIP_TRIAL_SLUG },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true, trialStartedAt: nowIso };
}

/** End a user's ChalybClip trial immediately. */
export async function revokeChalybclipTrial(
  targetUserId: string,
  reason: string | null = null,
): Promise<PromoResult> {
  const auth = await authorize(targetUserId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error: updErr } = await auth.admin
    .from('profiles')
    .update({ chalybclip_trial_started_at: null })
    .eq('id', targetUserId);
  if (updErr) return { ok: false, error: updErr.message };

  await logAudit({
    action: 'promo.trial_revoke',
    actorId: auth.actorId,
    actorEmail: auth.actorEmail,
    targetUserId,
    targetEmail: auth.targetEmail,
    after: { chalybclip_trial_started_at: null },
    metadata: { reason, via: 'team_page', engine: CHALYBCLIP_TRIAL_SLUG },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true, trialStartedAt: null };
}

/** Clear the welcome banner so it shows again for the user. */
export async function resetWelcomeGift(
  targetUserId: string,
  reason: string | null = null,
): Promise<PromoResult> {
  const auth = await authorize(targetUserId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const { error: updErr } = await auth.admin
    .from('profiles')
    .update({ welcome_gift_claimed_at: null })
    .eq('id', targetUserId);
  if (updErr) return { ok: false, error: updErr.message };

  await logAudit({
    action: 'promo.welcome_reset',
    actorId: auth.actorId,
    actorEmail: auth.actorEmail,
    targetUserId,
    targetEmail: auth.targetEmail,
    after: { welcome_gift_claimed_at: null },
    metadata: { reason, via: 'team_page' },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
