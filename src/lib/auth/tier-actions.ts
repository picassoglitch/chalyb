'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { decideTierChange } from '@/lib/billing/tier-change-policy';
import { getSessionUser, type SubscriptionTier } from './session';

interface ChangeResult {
  ok: boolean;
  error?: string;
  /** Set when the request was refused because the tier has to be PAID for.
   *  The UI reads this to send the user to the Mercado Pago checkout instead
   *  of showing a bare error. It is never a "we wrote it anyway" flag — a
   *  refusal writes nothing. */
  paymentRequired?: boolean;
}

export async function changeUserTier(
  targetUserId: string,
  newTier: SubscriptionTier,
): Promise<ChangeResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, error: 'Inicia sesión para continuar.' };

  const isSelf = targetUserId === session.user.id;
  const isAdmin = session.role === 'SUPER_ADMIN' || session.role === 'ADMIN';

  // THE gate. A non-admin may only ever move their own row to FREE; every
  // paid tier is written by the Mercado Pago webhook once the payment is
  // confirmed. See src/lib/billing/tier-change-policy.ts for the table.
  const decision = decideTierChange({ isSelf, isAdmin, newTier });
  if (!decision.allowed) {
    return {
      ok: false,
      error: decision.error,
      paymentRequired: decision.reason === 'payment_required',
    };
  }

  // Use the service-role client so the write bypasses RLS. This is the only
  // way env-locked admins (whose stored DB role may not match their session
  // role) can actually update other users' rows. We've already done permission
  // checking above; the DB is now just a write target.
  const admin = createAdminClient();

  // Read the previous tier + target's email for the audit log (before mutating).
  const { data: targetBefore } = await admin
    .from('profiles')
    .select('email, tier')
    .eq('id', targetUserId)
    .maybeSingle();

  const { data, error } = await admin
    .from('profiles')
    .update({ tier: newTier })
    .eq('id', targetUserId)
    .select('id, tier'); // .select() returns affected rows so we can verify

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    // No RLS rejection (admin client bypasses it) — this means the id didn't match.
    return { ok: false, error: 'No encontramos a ese usuario.' };
  }

  // Audit log — distinguishes self-downgrade vs admin-driven change so
  // dispute resolution can tell "this was the user's own choice" apart.
  const prevTier = (targetBefore?.tier as SubscriptionTier | undefined) ?? null;
  const isSelfDowngrade = isSelf && !isAdmin && newTier === 'FREE';
  await logAudit({
    action: isSelfDowngrade ? 'tier.downgrade' : 'tier.change',
    actorId: session.user.id,
    actorEmail: session.user.email ?? null,
    targetUserId,
    targetEmail: (targetBefore?.email as string | null) ?? null,
    before: { tier: prevTier },
    after: { tier: newTier },
    metadata: { via: 'team_page', is_admin_actor: isAdmin },
  });

  // Auto-provision engine subscriptions on tier upgrades:
  //   - VIP: seed access to every currently-active engine in the org.
  //   - PRO: nothing here — provisioning happens when the user picks their
  //     live engine via setSelectedLiveEngine. (Until they pick, they have
  //     no engine access — by design.)
  //   - FREE: no provisioning. We DON'T deactivate existing rows on a
  //     downgrade so re-upgrades are seamless; deactivation is a separate
  //     manual flow.
  // Only an admin can reach VIP through this action now (a self-upgrade is
  // refused above and lands via the webhook instead), so the grant source is
  // unambiguous.
  if (newTier === 'VIP') {
    await provisionAllAccessEngines(targetUserId, 'admin_grant');
  }

  // IMPORTANT: revalidatePath needs the FILE path (with bracketed dynamic
  // segments), not the rendered URL. Passing '/app/subscription' matches
  // nothing because the real route is '/[locale]/app/subscription' — and
  // without a match, the server cache keeps serving the stale render to the
  // affected user. The 'layout' tag nukes the entire dashboard subtree under
  // [locale] in one call, which is overkill but bulletproof for a small app.
  revalidatePath('/[locale]', 'layout');

  // Nothing here is ever a paid self-grant — the policy above refused those
  // before we reached the write.
  return { ok: true };
}
