// The price-increase flow's I/O (WS-6): what a subscriber has been told and
// answered (consent_events), recording an answer, and acting on it. The
// rules are in ./price-change.ts.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago } from '@/lib/payments/mercadopago';
import { notify } from '@/lib/notifications/notify';
import {
  mpPreapprovalAmountPutVerified,
  priceIncreaseNoAnswer,
  priceIncreaseNoticesEnabled,
} from '@/lib/config/flags';
import { planPrice, type PlanKey } from '@/config/pricing';
import type { SessionUser } from '@/lib/auth/session';
import type { ConsentEventType } from './consent-core';
import { recordConsent, requestContext, UI_VERSION } from './consent';
import { loadBilling } from './subscription-store';
import { formatFechaLarga, formatMXN } from './format';
import { cancelForUser } from './billing-actions';
import { PLAN_NAMES } from './plan-names';
import {
  DEFAULT_TZ,
  increaseFor,
  schedule,
  targetRenewal,
  type Answer,
  type Increase,
  type Schedule,
} from './price-change';

export interface PendingIncrease {
  preapprovalId: string;
  increase: Increase;
  schedule: Schedule;
  answer: Answer;
  noticeSent: boolean;
  reminderSent: boolean;
  tz: string;
}

/** The subscriber's zone: the one their consent was given in, or Mexico City. */
async function zoneOf(consentId: string | null): Promise<string> {
  if (!consentId) return DEFAULT_TZ;
  const { data } = await createAdminClient()
    .from('consent_events')
    .select('client_timezone')
    .eq('consent_id', consentId)
    .maybeSingle();
  const tz = (data?.client_timezone as string | null) ?? null;
  try {
    if (tz) new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz ?? DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

async function eventsFor(userId: string, preapprovalId: string, renewalDay: string) {
  const { data } = await createAdminClient()
    .from('consent_events')
    .select('event_type, details')
    .eq('user_id', userId)
    .in('event_type', [
      'price_change_notice_sent',
      'price_change_accepted',
      'price_change_declined',
    ])
    .eq('details->>mp_preapproval_id', preapprovalId)
    .eq('details->>renewal_day', renewalDay);
  return (data ?? []) as { event_type: string; details: Record<string, string> }[];
}

/**
 * The increase this subscription faces now, with what was sent and
 * answered; null when none applies (flag off, not grandfathered, …).
 */
export async function pendingIncrease(
  userId: string,
  row: Record<string, unknown> | null,
  now = new Date(),
): Promise<PendingIncrease | null> {
  if (!priceIncreaseNoticesEnabled() || !row) return null;
  if (row.status !== 'authorized' || row.cancel_at_period_end) return null;
  const planKey = ((row.plan_key as PlanKey | null) ??
    (row.tier === 'VIP' ? 'vip_month' : 'pro_month')) as PlanKey;
  const increase = increaseFor(planKey, row.amount_cents as number | null);
  const next = (row.next_charge_at as string | null) ?? (row.next_payment_date as string | null);
  if (!increase || !next) return null;
  const tz = await zoneOf((row.consent_id as string | null) ?? null);
  const renewalAt = targetRenewal(new Date(next), planPrice(planKey).interval, now, tz);
  const s = schedule(renewalAt, tz);
  const preapprovalId = row.mp_preapproval_id as string;
  const events = await eventsFor(userId, preapprovalId, renewalDay(renewalAt));
  const kinds = new Set(events.map((e) => e.event_type));
  const reminders = events.filter(
    (e) => e.event_type === 'price_change_notice_sent' && e.details.step === 'reminder',
  );
  return {
    preapprovalId,
    increase,
    schedule: s,
    tz,
    answer: kinds.has('price_change_accepted')
      ? 'accepted'
      : kinds.has('price_change_declined')
        ? 'declined'
        : null,
    noticeSent: kinds.has('price_change_notice_sent'),
    reminderSent: reminders.length > 0,
  };
}

export function renewalDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The words the modal and the email show (aceptacion-ux §4.1), as plain
 *  text for the evidence. */
export function shownText(p: PendingIncrease, locale = 'es'): string {
  const per = planPrice(p.increase.planKey).interval === 'year' ? 'año' : 'mes';
  const plan = PLAN_NAMES[p.increase.planKey].split(' ')[0];
  const date = formatFechaLarga(p.schedule.renewalAt, locale);
  const rest =
    priceIncreaseNoAnswer() === 'keep_old'
      ? `Solo se te cobrará si lo aceptas. Si no, seguirás pagando ${formatMXN(p.increase.oldCents)} MXN al ${per}.`
      : `Solo se te cobrará si lo aceptas. Si no, conservas ${plan} hasta el ${date} y después pasas a Gratis, sin cobro.`;
  return [
    `Cambia el precio de tu plan ${plan}`,
    `Hoy pagas ${formatMXN(p.increase.oldCents)} MXN al ${per}. A partir del ${date}: ${formatMXN(p.increase.newCents)} MXN al ${per}, IVA incluido.`,
    rest,
  ].join('\n');
}

function eventBase(p: PendingIncrease, userId: string, email: string | null, text: string | null) {
  return {
    user_id: userId,
    account_email: email,
    documents: [],
    client_timezone: p.tz,
    locale: 'es-MX',
    ui_version: UI_VERSION,
    disclosure_text: text,
    checkbox_text: null,
    checkbox_checked: null,
    plan_id: p.increase.planKey,
    amount_mxn: p.increase.newCents / 100,
    currency: 'MXN',
    tax_included: true,
    billing_interval: planPrice(p.increase.planKey).interval,
    trial_end_utc: null,
    charge_date_utc: p.schedule.renewalAt.toISOString(),
    reminder_date_utc: p.schedule.reminderAt.toISOString(),
    payment_method: null,
    marketing_opt_in: false,
    details: {
      mp_preapproval_id: p.preapprovalId,
      renewal_day: renewalDay(p.schedule.renewalAt),
      old_amount_cents: String(p.increase.oldCents),
      new_amount_cents: String(p.increase.newCents),
      pct: String(p.increase.pct),
    },
  };
}

/** The cron (or anyone) writing that a notice / reminder went out. */
export async function recordNotice(
  p: PendingIncrease,
  userId: string,
  email: string | null,
  step: 'notice' | 'reminder',
  text: string,
) {
  const base = eventBase(p, userId, email, text);
  await recordConsent({
    ...base,
    event_type: 'price_change_notice_sent' as ConsentEventType,
    ip_address: null,
    user_agent: null,
    surface: 'email',
    button_label: null,
    details: { ...base.details, step },
  });
}

/** The subscriber's express answer, from the modal (aceptacion-ux §4.1). */
export async function answerIncrease(
  session: SessionUser,
  decision: 'accept' | 'decline',
): Promise<{ ok: true } | { ok: false; code: 'NOTHING_PENDING' | 'MP_ERROR' }> {
  const billing = await loadBilling(session.user.id);
  const p = await pendingIncrease(session.user.id, billing.primaryRow);
  if (!p || p.answer || Date.now() < p.schedule.noticeAt.getTime())
    return { ok: false, code: 'NOTHING_PENDING' };
  const ctx = await requestContext();
  const base = eventBase(p, session.user.id, session.user.email ?? null, shownText(p));
  await recordConsent({
    ...base,
    event_type: decision === 'accept' ? 'price_change_accepted' : 'price_change_declined',
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    surface: 'price_change_modal',
    button_label: decision === 'accept' ? 'Acepto el nuevo precio' : 'No, gracias',
  });
  if (decision === 'accept') return applyAccepted(p);
  if (priceIncreaseNoAnswer() === 'gratis') {
    const r = await endAtPeriod(p, session.user.id, 'price_change_declined', 'No, gracias');
    return r.ok ? { ok: true } : { ok: false, code: 'MP_ERROR' };
  }
  return { ok: true };
}

/**
 * Accepted: the next renewal charges the new amount. Only when changing a
 * running preapproval's amount is verified at MP (O-6); otherwise the old
 * amount stays and a person handles it — never the new amount unverified.
 */
export async function applyAccepted(
  p: PendingIncrease,
): Promise<{ ok: true } | { ok: false; code: 'MP_ERROR' }> {
  if (!mpPreapprovalAmountPutVerified()) {
    await notify({
      severity: 'warning',
      title: 'Aumento de precio aceptado: actualizar el monto a mano',
      body: `Suscripción ${p.preapprovalId} aceptó ${formatMXN(p.increase.newCents)} MXN desde el ${formatFechaLarga(p.schedule.renewalAt, 'es')}. El cambio de monto en Mercado Pago no está verificado (OPS-14): sigue cobrando ${formatMXN(p.increase.oldCents)} MXN hasta actualizarlo. TODO(owner O-6)`,
      href: '/dashboard/dinero',
      source: 'billing.price_change',
    }).catch(() => {});
    return { ok: true };
  }
  try {
    await getMercadoPago().preapproval.update({
      id: p.preapprovalId,
      body: {
        auto_recurring: { transaction_amount: p.increase.newCents / 100, currency_id: 'MXN' },
      },
    } as never);
  } catch (err) {
    console.error('[price-change] PUT preapproval amount failed', p.preapprovalId, err);
    return { ok: false, code: 'MP_ERROR' };
  }
  await createAdminClient()
    .from('subscriptions')
    .update({ amount_cents: p.increase.newCents })
    .eq('mp_preapproval_id', p.preapprovalId);
  return { ok: true };
}

/** Option (a): the plan doesn't renew; the user keeps it to the end of the
 *  paid period, then Gratis. The ordinary cancel path (evidence, folio,
 *  email), so it can never charge again. */
export async function endAtPeriod(
  p: PendingIncrease,
  userId: string,
  surface: 'price_change_declined' | 'price_change_no_answer',
  buttonLabel: string,
) {
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('email, full_name')
    .eq('id', userId)
    .maybeSingle();
  return cancelForUser(
    {
      id: userId,
      email: (profile?.email as string | null) ?? null,
      fullName: (profile?.full_name as string | null) ?? null,
    },
    { offerShown: false, locale: 'es', surface, buttonLabel },
  );
}
