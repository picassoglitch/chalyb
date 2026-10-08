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
import { subscriptionActiveTemplate } from '@/lib/email/templates';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { getMercadoPago, getAppUrl, mpGet } from './mercadopago';
import {
  authorizedPaymentStatusToChargeStatus,
  ledgerStatus,
  paymentStatusToChargeStatus,
  type ChargeStatus,
} from './order-charge';
import { gatePreapproval } from './webhook-verify';
import {
  PRICING,
  ivaPortion,
  planPrice,
  type PlanKey,
} from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { dispatchBillingEmail } from '@/lib/billing/notices';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { unpaidCharge } from '@/lib/billing/billing-state';
import { track } from '@/lib/analytics/track';
import {
  entitlementFor,
  isLiveStatus,
  normalizePreapprovalStatus,
  parseSubscriptionReference,
  type PreapprovalStatus,
} from './subscription-reference';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import { onLealtadCharge } from '@/lib/billing/lealtad-server';
import { onChargebackOpened, onRefundReported } from '@/lib/billing/disputes-server';
import { lealtadFailedVars } from '@/lib/billing/notices';

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
  const { data: before, error: beforeErr } = await admin
    .from('subscriptions')
    .select(
      'status, plan_key, trial_ends_at, next_charge_at, charge_hold_until, last_charge_at, reminder_delivered_at, first_charge_at',
    )
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle();
  if (beforeErr) {
    console.error('[mp/subscription] subscriptions read failed', beforeErr);
    return { ok: false, reason: 'db', retry: true };
  }
  // Every checkout writes our row (with its plan_key) right after creating the
  // preapproval. A notification that beats that write would be gated against
  // the default monthly price — wrong for an annual or Lealtad plan — and be
  // stored as amount_mismatch with no retry. Ask Mercado Pago to send it
  // again instead; by then the row is there (or the checkout cancelled it).
  if (!before && status === 'authorized') {
    console.warn('[mp/subscription] preapproval has no row yet — asking for a retry', {
      preapprovalId,
    });
    return { ok: false, reason: 'db', retry: true };
  }
  const planKey = (before?.plan_key as PlanKey | null) ?? null;
  const trialEndsAt = (before?.trial_ends_at as string | null) ?? null;
  const inTrial = !!trialEndsAt && Date.now() < Date.parse(trialEndsAt);
  const previousStatus = before ? normalizePreapprovalStatus(before.status as string) : null;
  // Mercado Pago's own record of the last charge that went through: one
  // whose authorized_payment notification never reached us still counts, so
  // the unpaid-charge deadline below can't take Pro from someone who paid.
  const chargedByMp =
    (mp.summarized?.charged_quantity ?? 0) > 0 ? (mp.summarized?.last_charged_date ?? null) : null;
  const knownChargeAt = (before?.last_charge_at as string | null) ?? null;
  const newerCharge =
    !!chargedByMp &&
    (!knownChargeAt || Date.parse(chargedByMp) > Date.parse(knownChargeAt));
  const lastChargeAt = newerCharge ? chargedByMp : knownChargeAt;
  const unpaid = unpaidCharge({
    tier,
    plan_key: planKey,
    trial_ends_at: trialEndsAt,
    last_charge_at: lastChargeAt,
    charge_hold_until: (before?.charge_hold_until as string | null) ?? null,
    reminder_delivered_at: (before?.reminder_delivered_at as string | null) ?? null,
    first_charge_at: (before?.first_charge_at as string | null) ?? null,
  });
  // The trial's annual charge, or a renewal, is due and hasn't landed (yet).
  const overdue = !!unpaid && !inTrial && Date.now() >= Date.parse(unpaid.dueAt);

  // ── Price gate ──────────────────────────────────────────────────────
  // The reference names the tier; the preapproval carries what is actually
  // being charged each month. They were both set by us, so any difference
  // means the preapproval was made elsewhere. Same rule as the one-off
  // webhook: a mismatch grants nothing and does not retry. Decided BEFORE
  // our copy is written: an 'authorized' row grants its tier by itself
  // (deriveBillingState), so a refused one is stored as amount_mismatch.
  const gate = gatePreapproval({ status, planKey, tier, amountMajor, currency });

  // Our copy of the preapproval — written whatever the status, so a paused or
  // cancelled one is visible in /dashboard/billing even when nothing is
  // granted below.
  const { error: rowErr } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier,
      mp_preapproval_id: preapprovalId,
      external_reference: mp.external_reference,
      status: gate.storedStatus,
      amount_cents: Math.round((amountMajor ?? 0) * 100),
      currency: currency ?? 'MXN',
      next_payment_date: nextPaymentDate,
      // A charge we missed: it settles any grace a failure had opened.
      ...(newerCharge ? { last_charge_at: chargedByMp, grace_ends_at: null } : {}),
      ...(before?.charge_hold_until
        ? {}
        : { next_charge_at: nextPaymentDate ?? before?.next_charge_at ?? null }),
      ended_at: isLiveStatus(status) ? null : new Date().toISOString(),
      raw: mp as unknown as Record<string, unknown>,
    },
    { onConflict: 'mp_preapproval_id' },
  );
  if (rowErr) {
    console.error('[mp/subscription] subscriptions upsert failed', rowErr);
    return { ok: false, reason: 'db', retry: true };
  }

  if (gate.refused) {
    const expected = gate.expected;
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
      href: '/dashboard/dinero',
      source: 'mp.webhook',
    });
    return { ok: false, reason: 'amount_mismatch', retry: false };
  }

  // A bounce hold pauses the preapproval on purpose (no charge until an
  // effective notice + 5 days); it must not end the plan.
  if (status === 'paused' && before?.charge_hold_until) {
    return { ok: true, status, applied: 'none' };
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
    // A scheduled downgrade (VIP → Pro at the period end) is authorised now
    // but must not take VIP away early: the replaced subscription keeps
    // granting it until its access_until (entitlements read both), and the
    // billing cron moves profiles.tier when the date comes.
    const RANK: Record<string, number> = { FREE: 0, PRO: 1, PARTNER: 1, VIP: 2 };
    const neverCharged = !lastChargeAt;
    const startsLater =
      !inTrial && !!nextPaymentDate && Date.parse(nextPaymentDate) > Date.now() && neverCharged;
    const deferred = startsLater && RANK[tier]! < RANK[tierBefore ?? 'FREE']!;
    if (overdue) {
      // The charge is due and hasn't landed: Pro runs to the deadline and
      // no further (the session lapses it then). The charge landing is what
      // clears the end — the next sync sees a new last_charge_at.
      const deadline = unpaid!.deadline;
      const { error: tierErr } =
        Date.now() < Date.parse(deadline)
          ? await admin
              .from('profiles')
              .update({ tier, tier_ends_at: deadline })
              .eq('id', userId)
          : await admin
              .from('profiles')
              .update({ tier_ends_at: deadline })
              .eq('id', userId)
              .eq('tier', tier);
      if (tierErr) {
        console.error('[mp/subscription] unpaid-charge tier_ends_at update failed', tierErr);
        return { ok: false, reason: 'db', retry: true };
      }
    } else if (!deferred) {
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
        href: '/dashboard/dinero',
        source: 'mp.webhook',
      });
      // A trial's welcome (Email 1, with the evidence) is sent by the trial
      // start itself; this generic one is for paid starts only.
      if (email && !trialEndsAt) {
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
          href: '/dashboard/dinero',
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
  // ONE status vocabulary in the ledger. `ap.payment.status` already speaks
  // it; `ap.status` does not (scheduled | processed | recycling | cancelled),
  // and writing it raw is what made a settled monthly charge read as
  // "processed" — invisible to every `status = 'approved'` filter on
  // /app/billing and in the revenue queries. Normalise before it is stored.
  const paymentStatus: ChargeStatus = ap.payment?.status
    ? paymentStatusToChargeStatus(ap.payment.status)
    : authorizedPaymentStatusToChargeStatus(ap.status);
  // 'scheduled' means Mercado Pago has not tried the card yet: there is no
  // payment to record, only a date. Everything else has a payment id.
  if (paymentId) {
    // What the ledger already says about this charge: an unmapped status
    // never overwrites a known one (same rule as every other ledger writer).
    const { data: existing } = await admin
      .from('payments')
      .select('status')
      .eq('mp_payment_id', String(paymentId))
      .maybeSingle();
    const previousLedgerStatus = (existing?.status as string | null | undefined) ?? null;
    const { error } = await admin.from('payments').upsert(
      {
        user_id: ref.userId,
        tier: ref.tier,
        kind: 'subscription',
        mp_payment_id: String(paymentId),
        mp_preapproval_id: preapprovalId,
        amount_cents: Math.round((ap.transaction_amount ?? 0) * 100),
        iva_cents: ivaPortion(Math.round((ap.transaction_amount ?? 0) * 100)),
        currency: ap.currency_id ?? 'MXN',
        status: ledgerStatus(paymentStatus, previousLedgerStatus),
        raw: ap as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_payment_id' },
    );
    if (error) {
      console.error('[mp/subscription] payments upsert failed', error);
      return { ok: false, retry: true };
    }
    const { data: subRow } = await admin
      .from('subscriptions')
      .select('tier, plan_key, last_charge_at, trial_ends_at, charge_hold_until, reminder_delivered_at, first_charge_at')
      .eq('mp_preapproval_id', preapprovalId)
      .maybeSingle();
    if (paymentStatus === 'approved') {
      // Notifications can be replayed (unsigned IPN) or arrive out of order:
      // last_charge_at only ever moves forward. Writing an older charge's
      // date would roll it back and could start the unpaid-charge deadline
      // for someone who has paid.
      const chargeAt = new Date(
        ap.debit_date ?? ap.date_created ?? new Date().toISOString(),
      ).toISOString();
      const storedAt = (subRow?.last_charge_at as string | null | undefined) ?? null;
      const olderThanStored = !!storedAt && Date.parse(chargeAt) < Date.parse(storedAt);
      await admin
        .from('subscriptions')
        .update({
          ...(olderThanStored ? {} : { last_charge_at: chargeAt }),
          grace_ends_at: null,
          // The next charge needs its own notice.
          reminder_delivered_at: null,
          charge_hold_until: null,
        })
        .eq('mp_preapproval_id', preapprovalId);
      await chargeEmail('charge_ok', ref.userId, preapprovalId, String(paymentId), ap);
      if (subRow?.plan_key === 'pro_lealtad') {
        await onLealtadCharge({
          userId: ref.userId,
          preapprovalId,
          paymentId: String(paymentId),
          chargedCents: Math.round((ap.transaction_amount ?? 0) * 100),
        }).catch((err) => console.error('[mp/subscription] Pro Lealtad step not recorded', err));
      }
      if (!subRow?.last_charge_at && subRow?.trial_ends_at) {
        void track('conversion', {
          // From the plan, not the amount: VIP mensual costs more than any
          // threshold that once told the two Pro intervals apart.
          plan:
            subRow.plan_key && planPrice(subRow.plan_key as PlanKey).interval === 'year'
              ? 'anual'
              : 'mensual',
        });
      }
    } else if (paymentStatus === 'rejected') {
      // Pago pendiente: full access until the grace window ends (Q12), and
      // never past the charge's own deadline (none at all for the trial's).
      const graceMs = Date.now() + PRICING.graceDays * 24 * 60 * 60 * 1000;
      const unpaid = subRow ? unpaidCharge(subRow as Parameters<typeof unpaidCharge>[0]) : null;
      const graceEnds = new Date(
        unpaid ? Math.min(graceMs, Date.parse(unpaid.deadline)) : graceMs,
      ).toISOString();
      await admin
        .from('subscriptions')
        .update({ grace_ends_at: graceEnds })
        .eq('mp_preapproval_id', preapprovalId)
        .is('grace_ends_at', null);
      // Access lapses when grace does (the session reads tier_ends_at).
      await admin
        .from('profiles')
        .update({ tier_ends_at: graceEnds })
        .eq('id', ref.userId)
        .is('tier_ends_at', null);
      await chargeEmail('charge_failed', ref.userId, preapprovalId, String(paymentId), ap);
      void track('payment_failed', {});
    }
    if (paymentStatus === 'charged_back' || paymentStatus === 'in_mediation') {
      // A dispute changes nothing on the account (Términos §10.2, WS-8):
      // recorded, triaged and handed to an admin.
      const opened = await onChargebackOpened({
        mpPaymentId: String(paymentId),
        mpStatus: paymentStatus,
      });
      if (!opened.ok) return { ok: false, retry: true };
    } else if (paymentStatus === 'refunded') {
      // A refund never changes the plan, price, step or account (§7.3).
      await onRefundReported({
        userId: ref.userId,
        mpPaymentId: String(paymentId),
        amountMajor: ap.transaction_amount ?? null,
      });
    } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      await notify({
        severity: 'warning',
        title: `Cobro mensual ${paymentStatus === 'rejected' ? 'rechazado' : 'cancelado'} — ${ref.tier}`,
        body: `MP pago #${String(paymentId)} · suscripción ${preapprovalId} · reintento ${ap.retry_attempt ?? 0}${ap.next_retry_date ? ` · próximo ${formatDateEs(ap.next_retry_date)}` : ''}`,
        href: '/dashboard/dinero',
        source: 'mp.webhook',
      });
    }
  }

  const synced = await syncSubscription(preapprovalId);
  return { ok: synced.ok, retry: !synced.ok && synced.retry, synced };
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
    .select('mp_preapproval_id, status, next_charge_at, next_payment_date, trial_ends_at')
    .eq('user_id', userId)
    .neq('mp_preapproval_id', keepPreapprovalId)
    .in('status', ['pending', 'authorized', 'paused']);
  for (const other of others ?? []) {
    const id = other.mp_preapproval_id as string;
    try {
      await cancelPreapproval(id);
      // It stops charging now, but what it already granted runs to the end:
      // the trial end, or the date it would have charged next (paid through).
      const paidThrough =
        (other.status as string) === 'authorized'
          ? (other.trial_ends_at as string | null) &&
            Date.parse(other.trial_ends_at as string) > Date.now()
            ? (other.trial_ends_at as string)
            : ((other.next_charge_at as string | null) ??
              (other.next_payment_date as string | null))
          : null;
      await admin
        .from('subscriptions')
        .update({
          status: 'cancelled',
          ended_at: new Date().toISOString(),
          cancel_at_period_end: true,
          access_until: paidThrough,
        })
        .eq('mp_preapproval_id', id);
    } catch (err) {
      // The webhook for the new one already ran; the old one keeps charging
      // until an admin cancels it by hand. Make that loud.
      console.error('[mp/subscription] could not cancel the replaced subscription', id, err);
      await notify({
        severity: 'critical',
        title: 'Suscripción anterior sigue activa — cancélala en Mercado Pago',
        body: `usuario ${userId} · MP ${id} fue reemplazada por ${keepPreapprovalId} pero no se pudo cancelar`,
        href: '/dashboard/dinero',
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

/** Email 3 / 3b for one recurring charge, once per payment id, with evidence. */
async function chargeEmail(
  kind: 'charge_ok' | 'charge_failed',
  userId: string,
  preapprovalId: string,
  paymentId: string,
  ap: MpAuthorizedPayment,
): Promise<void> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: sub }] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
    admin
      .from('subscriptions')
      .select('plan_key, tier, card_last4, next_payment_date, grace_ends_at, loyalty_step')
      .eq('mp_preapproval_id', preapprovalId)
      .maybeSingle(),
  ]);
  const email = profile?.email as string | null;
  if (!email) return;
  const planKey =
    (sub?.plan_key as PlanKey | null) ?? (sub?.tier === 'VIP' ? 'vip_month' : 'pro_month');
  const renew = (sub?.next_payment_date as string | null) ?? null;
  const grace = (sub?.grace_ends_at as string | null) ?? null;
  if (kind === 'charge_failed')
    await addUserNotice({
      userId,
      kind: 'pastDue',
      ...(await noticeText('pastDue')),
      href: '/app/billing/tarjeta',
      dedupeKey: `pay:${paymentId}`,
      keepUntil: grace,
    });
  // Pro Lealtad: a failed charge says what is at stake — the step, kept if
  // it is paid within the 7-day grace (aceptacion-ux §4.2; day 0 here, day 5
  // from the cron).
  if (kind === 'charge_failed' && planKey === 'pro_lealtad') {
    await dispatchBillingEmail({
      userId,
      email,
      kind: 'lealtad_failed',
      periodKey: `pay:${paymentId}:d0`,
      evidence: 'charge_failed',
      vars: lealtadFailedVars({
        nombre: ((profile?.full_name as string | null) ?? '').split(' ')[0] ?? '',
        step: (sub?.loyalty_step as number | null) ?? 0,
        chargedAt: ap.debit_date ?? ap.date_created ?? new Date().toISOString(),
        graceEndsAt: grace,
        appUrl: getAppUrl(),
      }),
    });
    return;
  }
  await dispatchBillingEmail({
    userId,
    email,
    kind,
    periodKey: `pay:${paymentId}`,
    evidence: kind === 'charge_ok' ? 'charge_succeeded' : 'charge_failed',
    vars: {
      nombre: ((profile?.full_name as string | null) ?? '').split(' ')[0] ?? '',
      plan: PLAN_NAMES[planKey],
      monto: formatMXN(Math.round((ap.transaction_amount ?? 0) * 100)),
      ultimos4: (sub?.card_last4 as string | null) ?? undefined,
      fecha_renovacion: renew ? formatFechaLarga(renew, 'es') : undefined,
      fecha_gracia: grace ? formatFechaLarga(grace, 'es') : undefined,
      appUrl: getAppUrl(),
    },
  });
}
