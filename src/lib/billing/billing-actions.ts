// Cancel and plan changes (rebuild P2-7, P2-9; BUILD-SPEC §6.9–6.10).

import 'server-only';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago, getAppUrl } from '@/lib/payments/mercadopago';
import { cancelPreapproval } from '@/lib/payments/subscription-sync';
import { track } from '@/lib/analytics/track';
import { planPrice, type PlanKey } from '@/config/pricing';
import type { SessionUser } from '@/lib/auth/session';
import { recordConsent, requestContext, UI_VERSION } from './consent';
import type { ConsentEventInput } from './consent-core';
import { dispatchBillingEmail } from './notices';
import { formatFechaLarga } from './format';
import { loadBilling } from './subscription-store';
import { changeTiming, reactivationStart, upgradeQuote } from './plan-change';
import { startSubscription, type StartResult } from './start-subscription';

/** "C-K7Q2M9" — short, unambiguous, shown to the user and in the email. */
export function newFolio(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `C-${Array.from(randomBytes(6), (b) => alphabet[b % alphabet.length]).join('')}`;
}

export type CancelResult =
  | { ok: true; folio: string; accessUntil: string | null }
  | { ok: false; code: 'NOTHING_TO_CANCEL' | 'MP_ERROR' };

/**
 * Cancel now, keep access to the end of what was granted. Never blocked by a
 * debt: a past_due subscription cancels the same way.
 */
export async function cancelSubscription(
  session: SessionUser,
  opts: { offerShown: boolean; locale: string },
): Promise<CancelResult> {
  return cancelForUser(
    {
      id: session.user.id,
      email: session.user.email ?? null,
      fullName: (session.user.user_metadata?.full_name as string | undefined) ?? null,
    },
    { ...opts, surface: 'web_my_plan', buttonLabel: 'Sí, cancelar' },
  );
}

/**
 * The cancel itself, for the subscriber (Mi plan) or for the owner acting on
 * their behalf (/dashboard/personas, P5-2): same Mercado Pago cancel, same
 * evidence, same email; `surface` says where it came from.
 */
export async function cancelForUser(
  target: { id: string; email: string | null; fullName: string | null },
  opts: { offerShown: boolean; locale: string; surface: string; buttonLabel: string },
): Promise<CancelResult> {
  const userId = target.id;
  const billing = await loadBilling(userId);
  const row = billing.primaryRow;
  if (!row || !['trialing', 'pro', 'past_due'].includes(billing.primary.state)) {
    return { ok: false, code: 'NOTHING_TO_CANCEL' };
  }
  const preapprovalId = row.mp_preapproval_id as string;
  try {
    await cancelPreapproval(preapprovalId);
  } catch (err) {
    console.error('[billing/cancel] Mercado Pago refused the cancel', preapprovalId, err);
    return { ok: false, code: 'MP_ERROR' };
  }

  const now = new Date();
  const s = billing.primary;
  const accessUntil =
    s.state === 'trialing'
      ? s.trialEndsAt
      : s.state === 'past_due'
        ? s.graceEndsAt
        : s.nextChargeAt;
  const folio = newFolio();
  const admin = createAdminClient();
  await admin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancel_at_period_end: true,
      cancelled_at: now.toISOString(),
      access_until: accessUntil,
      pending_plan_key: null,
      pending_effective_at: null,
    })
    .eq('mp_preapproval_id', preapprovalId);
  // Paid access runs to the end of the period: the session lapses the tier then.
  await admin
    .from('profiles')
    .update({ tier_ends_at: accessUntil ?? now.toISOString() })
    .eq('id', userId);

  const ctx = await requestContext();
  const base = {
    user_id: userId,
    account_email: target.email,
    documents: [] as ConsentEventInput['documents'],
    client_timezone: null,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    locale: opts.locale === 'es' ? 'es-MX' : 'en',
    surface: opts.surface,
    ui_version: UI_VERSION,
    disclosure_text: null,
    checkbox_text: null,
    checkbox_checked: null,
    plan_id: s.planKey,
    amount_mxn: null,
    currency: 'MXN',
    tax_included: true,
    billing_interval: null,
    trial_end_utc: s.trialEndsAt,
    charge_date_utc: null,
    reminder_date_utc: null,
    payment_method: null,
    marketing_opt_in: false,
  } satisfies Omit<ConsentEventInput, 'event_type' | 'button_label'>;
  if (opts.offerShown) {
    await recordConsent({ ...base, event_type: 'retention_offer_shown', button_label: null }).catch(
      () => {},
    );
  }
  const consent = await recordConsent({
    ...base,
    event_type: 'cancellation_requested',
    button_label: opts.buttonLabel,
    details: { folio_cancelacion: folio, access_until: accessUntil },
  });

  const email = target.email;
  let messageId: string | null = null;
  if (email) {
    const sent = await dispatchBillingEmail({
      userId,
      email,
      kind: 'cancelled',
      periodKey: folio,
      vars: {
        nombre: (target.fullName ?? '').split(' ')[0] ?? '',
        plan: s.planKey && planPrice(s.planKey).tier === 'VIP' ? 'VIP' : 'Pro',
        monto: '',
        folio_cancelacion: folio,
        fecha_hora_cancelacion: `${formatFechaLarga(now, 'es')}, ${now.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}`,
        fecha_fin_acceso: accessUntil
          ? formatFechaLarga(accessUntil, 'es')
          : formatFechaLarga(now, 'es'),
        appUrl: getAppUrl(),
      },
    });
    if (sent.sent) messageId = sent.messageId;
  }
  await admin.from('cancellation_events').insert({
    folio_cancelacion: folio,
    user_id: userId,
    subscription_id: (row.id as string | undefined) ?? null,
    requested_at: now.toISOString(),
    access_until: accessUntil,
    consent_id: consent.consent_id,
    email_message_id: messageId,
  });
  void track('cancel', {
    plan: s.planKey && planPrice(s.planKey).interval === 'year' ? 'anual' : 'mensual',
  });
  return { ok: true, folio, accessUntil };
}

/** The current subscription is a trial that never charged. */
function unpaidTrial(billing: Awaited<ReturnType<typeof loadBilling>>): boolean {
  return !!billing.primary.trialEndsAt && !billing.primaryRow?.last_charge_at;
}

export interface ChangeInput {
  session: SessionUser;
  planKey: PlanKey;
  cardTokenId: string;
  consentChecked: boolean;
  locale: string;
  clientTimezone?: string | null;
}

export type ChangeResult = StartResult & { refundCents?: number };

/**
 * A plan change is a new subscription (Mercado Pago can't change a
 * preapproval's frequency, and card tokens are single-use, so the card is
 * entered again — which also captures the change's own consent). The old one
 * stops charging when the new one is authorised and keeps what it already
 * granted until its period ends: never two charging subscriptions, never a gap.
 */
export async function changePlan(input: ChangeInput): Promise<ChangeResult> {
  const billing = await loadBilling(input.session.user.id);
  const s = billing.primary;
  const from = s.planKey ?? 'pro_month';
  const trialing = s.state === 'trialing';
  const timing =
    s.state === 'free' || s.state === 'cancelled_active'
      ? 'reactivate'
      : changeTiming(from, input.planKey, trialing);

  const effectiveAt =
    timing === 'now'
      ? undefined
      : timing === 'trial_end'
        ? s.trialEndsAt
          ? new Date(s.trialEndsAt)
          : undefined
        : timing === 'reactivate'
          ? (reactivationStart({
              to: input.planKey,
              accessUntil: s.accessUntil,
              unpaidTrial: unpaidTrial(billing),
              now: new Date(),
            }) ?? undefined)
          : s.nextChargeAt
            ? new Date(s.nextChargeAt)
            : undefined;

  // An immediate change refunds the unused part of the current paid period.
  let refundCents = 0;
  let refundPaymentId: string | null = null;
  if (timing === 'now' && !trialing && billing.primaryRow) {
    const admin = createAdminClient();
    const { data: last } = await admin
      .from('payments')
      .select('mp_payment_id, amount_cents, created_at')
      .eq('mp_preapproval_id', billing.primaryRow.mp_preapproval_id as string)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && s.nextChargeAt) {
      const quote = upgradeQuote({
        to: input.planKey,
        trialing,
        lastChargeCents: last.amount_cents as number,
        periodStart: new Date(last.created_at as string),
        periodEnd: new Date(s.nextChargeAt),
        now: new Date(),
      });
      refundCents = quote.refundCents;
      refundPaymentId = last.mp_payment_id as string;
    }
  }

  const result = await startSubscription({
    session: input.session,
    planKey: input.planKey,
    cardTokenId: input.cardTokenId,
    consentChecked: input.consentChecked,
    locale: input.locale,
    clientTimezone: input.clientTimezone,
    intent: 'change',
    effectiveAt,
  });
  if (!result.ok) return result;

  if (refundCents > 0 && refundPaymentId) {
    try {
      await getMercadoPago().refund.create({
        payment_id: refundPaymentId,
        body: { amount: refundCents / 100 },
      });
    } catch (err) {
      // The upgrade stands; the refund goes to the admin's attention list.
      console.error(
        '[billing/change] proration refund failed — refund by hand',
        refundPaymentId,
        refundCents,
        err,
      );
    }
  }
  return { ...result, refundCents };
}

/** What a plan change will do, for the confirm step (shown BEFORE paying). */
export async function quoteChange(session: SessionUser, to: PlanKey) {
  const billing = await loadBilling(session.user.id);
  const s = billing.primary;
  const trialing = s.state === 'trialing';
  const from = s.planKey ?? 'pro_month';
  const timing =
    s.state === 'free' || s.state === 'cancelled_active'
      ? 'reactivate'
      : changeTiming(from, to, trialing);
  let quote = { chargeTodayCents: 0, refundCents: 0, thenCents: planPrice(to).totalCents };
  if (timing === 'now') {
    const admin = createAdminClient();
    const { data: last } = billing.primaryRow
      ? await admin
          .from('payments')
          .select('amount_cents, created_at')
          .eq('mp_preapproval_id', billing.primaryRow.mp_preapproval_id as string)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const q = upgradeQuote({
      to,
      trialing,
      lastChargeCents: (last?.amount_cents as number | undefined) ?? null,
      periodStart: last ? new Date(last.created_at as string) : null,
      periodEnd: s.nextChargeAt ? new Date(s.nextChargeAt) : null,
      now: new Date(),
    });
    quote = {
      chargeTodayCents: q.chargeTodayCents,
      refundCents: q.refundCents,
      thenCents: q.thenCents,
    };
  }
  const effectiveAt =
    timing === 'trial_end'
      ? s.trialEndsAt
      : timing === 'period_end'
        ? s.nextChargeAt
        : timing === 'reactivate'
          ? (reactivationStart({
              to,
              accessUntil: s.accessUntil,
              unpaidTrial: unpaidTrial(billing),
              now: new Date(),
            })?.toISOString() ?? null)
          : null;
  return { timing, effectiveAt, from, ...quote, billing };
}
