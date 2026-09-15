'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { getSessionUser, type SubscriptionTier } from './session';
import { decideTierChange } from './tier-policy';
import { cancellationOutcome } from '@/lib/billing/subscription-period';
import { cancelPreapproval } from '@/lib/payments/subscription-sync';
import { normalizePreapprovalStatus } from '@/lib/payments/subscription-reference';

interface ChangeResult {
  ok: boolean;
  error?: string;
  /** True when the caller asked for a paid tier they cannot grant themselves.
   *  The write did NOT happen — the UI must send them through Mercado Pago
   *  (createTierSubscription), and the tier lands when the webhook confirms the
   *  payment. */
  paymentRequired?: boolean;
  /** ISO date the cancelled plan stops working. Present when the user
   *  cancelled a paid plan with time left on the period they paid for: the
   *  plan keeps working until then and lapses to FREE by itself. */
  endsAt?: string;
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
  const currentTier = (targetBefore?.tier as SubscriptionTier | undefined) ?? 'FREE';

  // ── Cancelling a paid plan ────────────────────────────────────────────
  // The user paid for a month. Taking the plan away the moment they click
  // cancel keeps the money and withdraws the service, which the LFPC does not
  // allow us to do (and PROFECO reads Art. 90 the same way). So a cancellation
  // stops the renewal and schedules the end: the plan runs to the end of the
  // period already paid for, then lapses to FREE on its own — enforced on
  // read in getSessionUser(), not by a job that could fail.
  //
  // An admin setting FREE is an override, not a cancellation, and applies now.
  // A tier with no payment behind it (an admin grant, a comp account) has no
  // paid period to honour, so that is immediate too.
  if (newTier === 'FREE' && isSelf && !isAdmin) {
    // A Mercado Pago subscription behind the tier has to stop charging
    // FIRST. If Mercado Pago refuses, nothing is scheduled and the user is
    // told — reporting a cancellation while the card keeps being charged is
    // the one outcome this must never produce. The webhook will confirm the
    // cancelled state shortly after and reach the same tier_ends_at.
    const { data: live } = await admin
      .from('subscriptions')
      .select('mp_preapproval_id, status, next_payment_date')
      .eq('user_id', targetUserId)
      .in('status', ['pending', 'authorized', 'paused'])
      .order('created_at', { ascending: false });
    let subscriptionEndsAt: string | null = null;
    for (const sub of live ?? []) {
      const id = sub.mp_preapproval_id as string;
      try {
        await cancelPreapproval(id);
      } catch (err) {
        console.error('[tier-actions] Mercado Pago refused to cancel', id, err);
        return {
          ok: false,
          error:
            'Mercado Pago no pudo cancelar tu suscripción en este momento. Inténtalo de nuevo en unos minutos; no se ha cambiado nada.',
        };
      }
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('mp_preapproval_id', id);
      // The paid period runs to the charge Mercado Pago had scheduled next.
      const next = sub.next_payment_date as string | null;
      if (
        normalizePreapprovalStatus(sub.status as string) === 'authorized' &&
        next &&
        new Date(next).getTime() > Date.now() &&
        (!subscriptionEndsAt || new Date(next) > new Date(subscriptionEndsAt))
      ) {
        subscriptionEndsAt = next;
      }
    }

    const { data: lastPayment } = await admin
      .from('payments')
      .select('created_at')
      .eq('user_id', targetUserId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const outcome = cancellationOutcome({
      currentTier,
      lastApprovedPaymentAt: (lastPayment?.created_at as string | null) ?? null,
    });

    // The subscription's own renewal date beats the 30-day arithmetic, which
    // only exists for the legacy one-off purchases.
    const scheduledEnd =
      subscriptionEndsAt ?? (outcome.kind === 'scheduled' ? outcome.endsAt.toISOString() : null);

    if (scheduledEnd) {
      const endsAtIso = scheduledEnd;
      const { error: scheduleErr } = await admin
        .from('profiles')
        // tier stays as it is — this schedules the end, it does not apply it.
        .update({ tier_ends_at: endsAtIso })
        .eq('id', targetUserId);
      if (scheduleErr) return { ok: false, error: scheduleErr.message };

      await logAudit({
        action: 'tier.downgrade',
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        targetUserId,
        targetEmail: (targetBefore?.email as string | null) ?? null,
        before: { tier: currentTier, tier_ends_at: null },
        after: { tier: currentTier, tier_ends_at: endsAtIso },
        metadata: { via: 'subscription_page', kind: 'cancel_scheduled', is_admin_actor: false },
      });

      revalidatePath('/[locale]', 'layout');
      return { ok: true, endsAt: endsAtIso };
    }
  }

  const { data, error } = await admin
    .from('profiles')
    // Any tier that is applied now clears a pending cancellation: paying again
    // (or an admin moving the plan) replaces whatever was scheduled.
    .update({ tier: newTier, tier_ends_at: null })
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
  const prevTier = currentTier;
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
