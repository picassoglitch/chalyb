// Keeping a subscription in step with Mercado Pago.
//
// Mercado Pago owns the preapproval: whether it is charging, when it charges
// next, whether a charge went through. This module pulls that state and
// applies it to our side — the `subscriptions` row, `profiles.tier`, the
// `payments` ledger — and is the ONLY place a subscription grants or ends a
// tier. The webhook calls it for every subscription_preapproval and
// subscription_authorized_payment notification; the cancel path in
// tier-actions.ts calls it after telling Mercado Pago to stop.
//
// Everything here is idempotent. Mercado Pago retries notifications and
// sends the same status more than once; re-running a sync against unchanged
// state writes the same values again and grants nothing twice.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/resend';
import { paymentReversedTemplate, subscriptionActiveTemplate } from '@/lib/email/templates';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { getMercadoPago, getAppUrl, mpGet } from './mercadopago';
import { checkCharge, expectedChargeForTier } from './webhook-verify';
import {
  entitlementFor,
  isLiveStatus,
  normalizePreapprovalStatus,
  parseSubscriptionReference,
  type PreapprovalStatus,
  type SubscribableTier,
} from './subscription-reference';

/** GET /authorized_payments/{id} — one recurring charge of a preapproval.
 *  The SDK has no client for it, hence the hand-rolled type. */
export interface MpAuthorizedPayment {
  id?: number | string;
  preapproval_id?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  /** scheduled | processed | recycling | cancelled */
  status?: string;
  date_created?: string;
  debit_date?: string;
  next_retry_date?: string | null;
  retry_attempt?: number;
  payment?: { id?: number | string; status?: string; status_detail?: string } | null;
}

export type SyncOutcome =
  | { ok: true; status: PreapprovalStatus; applied: 'activate' | 'end' | 'none' }
  | { ok: false; reason: 'not_ours' | 'amount_mismatch' | 'db'; retry: boolean };

/**
 * Pull the preapproval from Mercado Pago and make our side match it.
 *
 * `not_ours`: the reference is not a subscription we created. `retry: false`
 * because no retry will change that. `db`: our write failed, retry so
 * Mercado Pago sends it again once the database is back.
 */
export async function syncSubscription(preapprovalId: string): Promise<SyncOutcome> {
  const { preapproval } = getMercadoPago();
  const mp = await preapproval.get({ id: preapprovalId });

  const ref = parseSubscriptionReference(mp.external_reference);
  if (!ref) {
    console.error('[mp/subscription] preapproval without a reference of ours', {
      preapprovalId,
      externalReference: mp.external_reference ?? null,
    });
    return { ok: false, reason: 'not_ours', retry: false };
  }
  const { userId, tier } = ref;
  const status = normalizePreapprovalStatus(mp.status);
  const nextPaymentDate = mp.next_payment_date ?? null;
  const amountMajor = mp.auto_recurring?.transaction_amount;
  const currency = mp.auto_recurring?.currency_id;

  const admin = createAdminClient();

  // What we last knew, to tell a transition from a repeat.
  const { data: before } = await admin
    .from('subscriptions')
    .select('status')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle();
  const previousStatus = before ? normalizePreapprovalStatus(before.status as string) : null;

  // Our copy of the preapproval — written whatever the status, so a paused or
  // cancelled one is visible in /dashboard/billing even when nothing is
  // granted below.
  const { error: rowErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      mp_preapproval_id: preapprovalId,
      external_reference: mp.external_reference,
      status,
      amount_cents: Math.round((amountMajor ?? 0) * 100),
      currency: currency ?? 'MXN',
      next_payment_date: nextPaymentDate,
      ended_at: isLiveStatus(status) ? null : new Date().toISOString(),
      raw: mp as unknown as Record<string, unknown>,
    },
    { onConflict: 'mp_preapproval_id' },
  );
  if (rowErr) {
    console.error('[mp/subscription] subscriptions upsert failed', rowErr);
    return { ok: false, reason: 'db', retry: true };
  }

  // ── Price gate ──────────────────────────────────────────────────────
  // The reference names the tier; the preapproval carries what is actually
  // being charged each month. They were both set by us, so any difference
  // means the preapproval was made elsewhere. Same rule as the one-off
  // webhook: a mismatch grants nothing and does not retry.
  if (status === 'authorized') {
    const expected = expectedChargeForTier(tier);
    const charge = expected ? checkCharge(expected, { amountMajor, currency }) : null;
    if (!expected || !charge?.ok) {
      console.error('[mp/subscription] REFUSING grant — charge does not match the price', {
        preapprovalId,
        userId,
        tier,
        expected: expected ? `${expected.amountCents} ${expected.currency}` : null,
        charged: `${Math.round((amountMajor ?? 0) * 100)} ${currency ?? '?'}`,
      });
      await logAudit({
        action: 'tier.payment',
        actorId: null,
        actorEmail: null,
        targetUserId: userId,
        metadata: {
          mp_preapproval_id: preapprovalId,
          kind: 'subscription.amount_mismatch',
          rejected: true,
          expected_amount_cents: expected?.amountCents ?? null,
          expected_currency: expected?.currency ?? null,
          charged_amount_cents: Math.round((amountMajor ?? 0) * 100),
          charged_currency: currency ?? null,
        },
      });
      await notify({
        severity: 'critical',
        title: 'Suscripción con monto que no corresponde — no se otorgó nada',
        body: `MP suscripción ${preapprovalId} · cobra $${(amountMajor ?? 0).toFixed(2)} ${currency ?? '?'} por ${tier}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      return { ok: false, reason: 'amount_mismatch', retry: false };
    }
  }

  const entitlement = entitlementFor({ status, tier, nextPaymentDate });

  const { data: profile } = await admin
    .from('profiles')
    .select('email, tier, tier_ends_at')
    .eq('id', userId)
    .maybeSingle();
  const email = (profile?.email as string | null) ?? null;
  const tierBefore = (profile?.tier as string | null) ?? null;

  if (entitlement.kind === 'activate') {
    // The tier is theirs with no scheduled end: an authorised subscription
    // also withdraws a pending cancellation (they subscribed again).
    const { error: tierErr } = await admin
      .from('profiles')
      .update({ tier, tier_ends_at: null })
      .eq('id', userId);
    if (tierErr) {
      console.error('[mp/subscription] tier update failed', tierErr);
      return { ok: false, reason: 'db', retry: true };
    }
    if (tier === 'VIP') await provisionAllAccessEngines(userId, 'mp_payment');

    // One user, one live subscription. Upgrading Pro → VIP authorises a new
    // preapproval; the old one must stop charging.
    await cancelOtherLiveSubscriptions(userId, preapprovalId);

    const firstActivation = previousStatus !== 'authorized';
    if (firstActivation) {
      await logAudit({
        action: 'tier.payment',
        actorId: null,
        actorEmail: null,
        targetUserId: userId,
        targetEmail: email,
        before: { tier: tierBefore },
        after: { tier },
        metadata: {
          mp_preapproval_id: preapprovalId,
          kind: 'subscription.authorized',
          amount_cents: Math.round((amountMajor ?? 0) * 100),
          currency: currency ?? null,
          next_payment_date: nextPaymentDate,
        },
      });
      await notify({
        severity: 'info',
        title: `Suscripción ${tier} activa — $${(amountMajor ?? 0).toFixed(2)} ${currency ?? ''}/mes`,
        body: `${email ?? userId} · MP suscripción ${preapprovalId}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      if (email) {
        const tmpl = subscriptionActiveTemplate({
          tier: TIER_CAPS[tier].label,
          amountMajor: (amountMajor ?? 0).toFixed(2),
          currency: currency ?? 'MXN',
          nextChargeLabel: nextPaymentDate ? formatDateEs(nextPaymentDate) : null,
          preapprovalId,
          appUrl: getAppUrl(),
        });
        void sendEmail({
          to: email,
          subject: `Tu plan ${TIER_CAPS[tier].label} está activo · Chalyb`,
          html: tmpl.html,
          text: tmpl.text,
        }).catch((err) => console.error('[mp/subscription] activation email failed', err));
      }
    }
    return { ok: true, status, applied: 'activate' };
  }

  if (entitlement.kind === 'end') {
    // Only touch the profile if this subscription is the one behind the
    // tier. A cancelled Pro preapproval must not end a VIP the user has
    // since authorised (that one already cancelled this one above).
    const { data: newerLive } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', userId)
      .neq('mp_preapproval_id', preapprovalId)
      .eq('status', 'authorized')
      .limit(1)
      .maybeSingle();
    if (newerLive) return { ok: true, status, applied: 'none' };

    if (tierBefore === tier) {
      const endsAtIso = entitlement.endsAt.toISOString();
      const { error: endErr } = await admin
        .from('profiles')
        .update({ tier_ends_at: endsAtIso })
        .eq('id', userId);
      if (endErr) {
        console.error('[mp/subscription] tier_ends_at update failed', endErr);
        return { ok: false, reason: 'db', retry: true };
      }
      if (previousStatus !== status) {
        const why = status === 'paused' ? 'pausada por Mercado Pago (cobro fallido)' : 'cancelada';
        await logAudit({
          action: 'tier.downgrade',
          actorId: null,
          actorEmail: null,
          targetUserId: userId,
          targetEmail: email,
          before: { tier, tier_ends_at: (profile?.tier_ends_at as string | null) ?? null },
          after: { tier, tier_ends_at: endsAtIso },
          metadata: { mp_preapproval_id: preapprovalId, kind: `subscription.${status}` },
        });
        await notify({
          severity: status === 'paused' ? 'warning' : 'info',
          title: `Suscripción ${tier} ${why}`,
          body: `${email ?? userId} · acceso hasta ${formatDateEs(endsAtIso)} · MP ${preapprovalId}`,
          href: '/dashboard/billing',
          source: 'mp.webhook',
        });
      }
    }
    return { ok: true, status, applied: 'end' };
  }

  return { ok: true, status, applied: 'none' };
}

/**
 * A recurring charge landed (or failed). Record it in `payments` — the same
 * ledger the one-off checkout wrote to, so /app/billing and the P&L see it —
 * then re-sync the preapproval, because a failed charge is what moves a
 * subscription to paused and a successful one is what moves
 * next_payment_date forward.
 */
export async function recordAuthorizedPayment(
  authorizedPaymentId: string,
): Promise<{ ok: boolean; retry?: boolean; synced?: SyncOutcome }> {
  const ap = await mpGet<MpAuthorizedPayment>(`/authorized_payments/${authorizedPaymentId}`);
  const ref = parseSubscriptionReference(ap.external_reference);
  const preapprovalId = ap.preapproval_id;
  if (!ref || !preapprovalId) {
    console.error('[mp/subscription] authorized payment without a reference of ours', {
      authorizedPaymentId,
      externalReference: ap.external_reference ?? null,
      preapprovalId: preapprovalId ?? null,
    });
    return { ok: false, retry: false };
  }

  const admin = createAdminClient();
  const paymentId = ap.payment?.id;
  const paymentStatus = ap.payment?.status ?? ap.status ?? 'unknown';
  // 'scheduled' means Mercado Pago has not tried the card yet: there is no
  // payment to record, only a date. Everything else has a payment id.
  if (paymentId) {
    const { error } = await admin.from('payments').upsert(
      {
        user_id: ref.userId,
        tier: ref.tier,
        mp_payment_id: String(paymentId),
        mp_preapproval_id: preapprovalId,
        amount_cents: Math.round((ap.transaction_amount ?? 0) * 100),
        currency: ap.currency_id ?? 'MXN',
        status: String(paymentStatus),
        raw: ap as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_payment_id' },
    );
    if (error) {
      console.error('[mp/subscription] payments upsert failed', error);
      return { ok: false, retry: true };
    }
    if (paymentStatus === 'approved') {
      await admin
        .from('subscriptions')
        .update({ last_charge_at: ap.debit_date ?? ap.date_created ?? new Date().toISOString() })
        .eq('mp_preapproval_id', preapprovalId);
    } else if (paymentStatus === 'refunded' || paymentStatus === 'charged_back') {
      const revoked = await revokeSubscriptionForReversal({
        preapprovalId,
        mpPaymentId: String(paymentId),
        reason: paymentStatus,
        amountMajor: ap.transaction_amount ?? null,
        currency: ap.currency_id ?? null,
      });
      if (!revoked.ok) return { ok: false, retry: true };
    } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      await notify({
        severity: 'warning',
        title: `Cobro mensual ${paymentStatus === 'rejected' ? 'rechazado' : 'cancelado'} — ${ref.tier}`,
        body: `MP pago #${String(paymentId)} · suscripción ${preapprovalId} · reintento ${ap.retry_attempt ?? 0}${ap.next_retry_date ? ` · próximo ${formatDateEs(ap.next_retry_date)}` : ''}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
    }
  }

  const synced = await syncSubscription(preapprovalId);
  return { ok: synced.ok, retry: !synced.ok && synced.retry, synced };
}

/**
 * POLICY — a reversed subscription charge revokes the plan NOW.
 *
 * A refund we issued, or a chargeback the buyer's bank granted, means the
 * month was not paid for after all. Cancelling keeps the plan to the end of
 * the period because that period WAS paid; a reversal is the opposite case,
 * so the tier drops to FREE at once and the preapproval is cancelled at
 * Mercado Pago so it does not charge again. Anything less leaves a paid plan
 * running on money the user got back.
 *
 * Fail closed: only a payment whose preapproval is on file (our copy of a
 * subscription we created) can revoke anything. Idempotent: a second
 * delivery finds the subscription already cancelled and the tier already
 * FREE, and changes nothing.
 */
export async function revokeSubscriptionForReversal(input: {
  preapprovalId: string;
  mpPaymentId: string;
  reason: 'refunded' | 'charged_back';
  amountMajor: number | null;
  currency: string | null;
}): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('user_id, tier, status')
    .eq('mp_preapproval_id', input.preapprovalId)
    .maybeSingle();
  if (!sub) {
    console.error(
      '[mp/subscription] reversal for a preapproval we do not have — nothing revoked',
      input,
    );
    return { ok: true };
  }
  const userId = sub.user_id as string;
  const tier = sub.tier as SubscribableTier;
  const wasLive = isLiveStatus(normalizePreapprovalStatus(sub.status as string));

  if (wasLive) {
    try {
      await cancelPreapproval(input.preapprovalId);
    } catch (err) {
      // Mercado Pago may already have cancelled it as part of the dispute.
      console.warn(
        '[mp/subscription] cancel after reversal refused (may already be cancelled)',
        err,
      );
    }
    const { error } = await admin
      .from('subscriptions')
      .update({ status: 'cancelled', ended_at: new Date().toISOString() })
      .eq('mp_preapproval_id', input.preapprovalId);
    if (error) {
      console.error('[mp/subscription] could not mark the reversed subscription cancelled', error);
      return { ok: false };
    }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email, tier, tier_ends_at')
    .eq('id', userId)
    .maybeSingle();
  const email = (profile?.email as string | null) ?? null;
  if (profile?.tier === tier) {
    const { error } = await admin
      .from('profiles')
      .update({ tier: 'FREE', tier_ends_at: null })
      .eq('id', userId);
    if (error) {
      console.error('[mp/subscription] could not revoke the tier after reversal', error);
      return { ok: false };
    }
    await logAudit({
      action: 'tier.downgrade',
      actorId: null,
      actorEmail: null,
      targetUserId: userId,
      targetEmail: email,
      before: { tier, tier_ends_at: (profile?.tier_ends_at as string | null) ?? null },
      after: { tier: 'FREE', tier_ends_at: null },
      metadata: {
        mp_preapproval_id: input.preapprovalId,
        mp_payment_id: input.mpPaymentId,
        kind: `subscription.${input.reason}`,
        amount_cents: Math.round((input.amountMajor ?? 0) * 100),
        currency: input.currency,
      },
    });
    await notify({
      severity: 'warning',
      title: `Plan ${tier} revocado — pago ${input.reason === 'charged_back' ? 'con contracargo' : 'reembolsado'}`,
      body: `${email ?? userId} · MP pago #${input.mpPaymentId} · suscripción ${input.preapprovalId}`,
      href: '/dashboard/billing',
      source: 'mp.webhook',
    });
    if (email) {
      const tmpl = paymentReversedTemplate({
        reason: input.reason,
        what: `tu plan ${TIER_CAPS[tier].label}`,
        amountMajor: (input.amountMajor ?? 0).toFixed(2),
        currency: input.currency ?? 'MXN',
        paymentId: input.mpPaymentId,
        appUrl: getAppUrl(),
      });
      void sendEmail({
        to: email,
        subject: `Tu plan ${TIER_CAPS[tier].label} fue retirado · Chalyb`,
        html: tmpl.html,
        text: tmpl.text,
      }).catch((err) => console.error('[mp/subscription] reversal email failed', err));
    }
  }
  return { ok: true };
}

/**
 * Tell Mercado Pago to stop charging a preapproval. Used by the user's
 * cancel button and when a newer subscription replaces an older one.
 * Throws if Mercado Pago refuses — callers must not report a cancellation
 * that did not happen.
 */
export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  const { preapproval } = getMercadoPago();
  await preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } });
}

async function cancelOtherLiveSubscriptions(
  userId: string,
  keepPreapprovalId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: others } = await admin
    .from('subscriptions')
    .select('mp_preapproval_id, status')
    .eq('user_id', userId)
    .neq('mp_preapproval_id', keepPreapprovalId)
    .in('status', ['pending', 'authorized', 'paused']);
  for (const other of others ?? []) {
    const id = other.mp_preapproval_id as string;
    try {
      await cancelPreapproval(id);
      await admin
        .from('subscriptions')
        .update({ status: 'cancelled', ended_at: new Date().toISOString() })
        .eq('mp_preapproval_id', id);
    } catch (err) {
      // The webhook for the new one already ran; the old one keeps charging
      // until an admin cancels it by hand. Make that loud.
      console.error('[mp/subscription] could not cancel the replaced subscription', id, err);
      await notify({
        severity: 'critical',
        title: 'Suscripción anterior sigue activa — cancélala en Mercado Pago',
        body: `usuario ${userId} · MP ${id} fue reemplazada por ${keepPreapprovalId} pero no se pudo cancelar`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
    }
  }
}

/** "15 de octubre de 2026". */
export function formatDateEs(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  });
}
