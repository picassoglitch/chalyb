'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { getSessionUser, type SubscriptionTier } from './session';
import { decideTierChange } from './tier-policy';


interface ChangeResult {
  ok: boolean;
  error?: string;
  /** True when the caller asked for a paid tier they cannot grant themselves.
   *  The write did NOT happen — the UI must send them through Mercado Pago
   *  (createTierCheckout), and the tier lands when the webhook confirms the
   *  payment. */
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

  // The gate. This action writes with the service-role client, so it is the
  // ONLY thing standing between a user and any tier they name — the UI routing
  // paid tiers through Mercado Pago is a convenience, not a control. A paid
  // tier becomes real in exactly two places: the MP webhook, once it has
  // verified the signature AND the amount (src/app/api/mp/webhook/route.ts),
  // or an admin acting here. The rule itself lives in tier-policy.ts so it can
  // be read and tested on its own.
  const decision = decideTierChange({ newTier, isSelf, isAdmin });
  if (!decision.allow) {
    switch (decision.reason) {
      case 'unknown_tier':
        return { ok: false, error: 'Ese plan no existe.' };
      case 'not_admin':
        return { ok: false, error: 'Solo un admin puede cambiar el plan de otra persona.' };
      case 'partner_is_admin_grant':
        return { ok: false, error: 'El plan Partner solo lo asigna un admin.' };
      case 'payment_required':
        return {
          ok: false,
          paymentRequired: true,
          error: 'Los planes de paga se activan al completar el pago en Mercado Pago.',
        };
    }
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
  if (newTier === 'VIP') {
    // Only an admin can reach VIP through this action now (a paid self-upgrade
    // returns above), so the grant source is always the admin.
    await provisionAllAccessEngines(targetUserId, 'admin_grant');
  }

  // IMPORTANT: revalidatePath needs the FILE path (with bracketed dynamic
  // segments), not the rendered URL. Passing '/app/subscription' matches
  // nothing because the real route is '/[locale]/app/subscription' — and
  // without a match, the server cache keeps serving the stale render to the
  // affected user. The 'layout' tag nukes the entire dashboard subtree under
  // [locale] in one call, which is overkill but bulletproof for a small app.
  revalidatePath('/[locale]', 'layout');

  // Anything that reaches here was either an admin action or a self-downgrade
  // to FREE, so there is no payment pending.
  return { ok: true };
}
