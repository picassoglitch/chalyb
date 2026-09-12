'use server';

// Cancelling a paid plan — and changing your mind.
//
// The button on /app/subscription used to call changeUserTier(userId, 'FREE'),
// which dropped the user to FREE immediately while the copy right next to it
// promised "conservas tu acceso hasta que termine el período que ya pagaste".
// Someone cancelling on day 2 of a paid month lost the other 28 days.
//
// Now it records WHEN the cancellation takes effect and leaves the tier alone.
// getSessionUser() resolves the date on every read, so the downgrade happens
// on its own the first time someone loads a page after the period ends — no
// scheduled job to run or to miss.

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getSessionUser } from '@/lib/auth/session';
import { cancellationEffectiveAt } from './subscription-state';

export interface CancelResult {
  ok: boolean;
  error?: string;
  /** ISO timestamp the plan actually ends. Present when ok. */
  effectiveAt?: string;
  /** True when the plan ended right away because there was no paid period
   *  left to honour (a comped or admin-granted tier, typically). */
  immediate?: boolean;
}

/** Schedule the current user's plan to end when the paid period runs out. */
export async function cancelSubscriptionAtPeriodEnd(): Promise<CancelResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };

  if (session.tier === 'FREE') {
    return { ok: false, error: 'Ya tienes el plan Free.' };
  }

  const now = new Date();
  const effectiveAt = cancellationEffectiveAt(session.tierPeriodEnd, now);
  const immediate = Date.parse(effectiveAt) <= now.getTime();

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    // The tier itself is untouched. What the user bought, they keep until
    // `effectiveAt`; the session layer stops honouring it after that.
    .update({ tier_cancel_at: effectiveAt })
    .eq('id', session.user.id);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    action: 'tier.downgrade',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId: session.user.id,
    targetEmail: session.user.email ?? null,
    before: { tier: session.tier, tier_cancel_at: null },
    after: { tier: session.tier, tier_cancel_at: effectiveAt },
    metadata: {
      via: 'subscription_page',
      kind: 'cancel_at_period_end',
      period_end: session.tierPeriodEnd,
      immediate,
    },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true, effectiveAt, immediate };
}

/** Undo a pending cancellation. Nothing was ever taken away, so this is just
 *  clearing the date. */
export async function resumeSubscription(): Promise<CancelResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };

  if (!session.pendingCancelAt) {
    return { ok: false, error: 'No hay ninguna cancelación pendiente.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('profiles')
    .update({ tier_cancel_at: null })
    .eq('id', session.user.id);

  if (error) return { ok: false, error: error.message };

  await logAudit({
    action: 'tier.change',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId: session.user.id,
    targetEmail: session.user.email ?? null,
    before: { tier: session.tier, tier_cancel_at: session.pendingCancelAt },
    after: { tier: session.tier, tier_cancel_at: null },
    metadata: { via: 'subscription_page', kind: 'cancel_reverted' },
  });

  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
