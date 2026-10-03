// Sending a billing email exactly once, with its evidence.
//
// The email_dispatches row is written FIRST, under its unique (user_id, kind,
// period_key) key: a second cron run, a webhook replay or a double click hits
// the key and sends nothing. Then the email goes out and the row gets the
// provider message id, which the Resend webhook later marks delivered or
// bounced (the bounce rule reads that).

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';
import {
  billingEmail,
  type BillingEmailKind,
  type BillingEmailVars,
} from '@/lib/email/billing-templates';
import { recordConsent, UI_VERSION } from './consent';
import type { ConsentEventType } from './consent-core';
import { legalDocuments } from '@/lib/legal/documents';
import { PRICING, planPrice, type PlanKey } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from './format';
import { PLAN_NAMES } from '@/lib/billing/plan-names';

const DOC_LABELS: Record<string, string> = {
  terminos: 'Términos y Condiciones',
  suscripcion: 'Términos de Suscripción',
  privacidad: 'Aviso de Privacidad',
};

/**
 * Every value the trial's charge notice (and the optional day-6 reminder)
 * prints, from the subscription itself: the day-0 send and the cron fill it
 * the same way. Amounts from the pricing config.
 */
export function trialNoticeVars(input: {
  nombre: string;
  planKey: PlanKey;
  startedAt: Date | string;
  trialEndsAt: Date | string;
  chargeAt: Date | string;
  last4: string | null;
  consentId: string | null;
  appUrl: string;
  now?: Date;
}): BillingEmailVars {
  const price = planPrice(input.planKey);
  const year = price.interval === 'year';
  const monto = formatMXN(price.totalCents);
  return {
    nombre: input.nombre,
    plan: PLAN_NAMES[input.planKey],
    monto,
    renovacion: `${year ? 'cada año' : 'cada mes'} (${monto} MXN)`,
    periodicidad: year ? 'por 1 año de Pro' : 'por tu primer mes de Pro',
    fecha_inicio: formatFechaLarga(input.startedAt, 'es'),
    fecha_fin_prueba: formatFechaLarga(input.trialEndsAt, 'es'),
    fecha_cobro: formatFechaLarga(input.chargeAt, 'es'),
    dias: PRICING.trial.days,
    faltan: Math.max(
      0,
      Math.ceil(
        (new Date(input.chargeAt).getTime() - (input.now ?? new Date()).getTime()) / 86_400_000,
      ),
    ),
    ultimos4: input.last4 ?? undefined,
    consent_id: input.consentId ?? undefined,
    switch_mensual: year ? formatMXN(planPrice('pro_month').totalCents) : undefined,
    documentos: legalDocuments('terminos', 'suscripcion', 'privacidad').map((d) => ({
      label: DOC_LABELS[d.doc] ?? d.doc,
      version: d.version,
      url: d.url,
    })),
    appUrl: input.appUrl,
  };
}

export interface DispatchInput {
  userId: string;
  email: string;
  kind: BillingEmailKind;
  /** Unique per occurrence: the charge date, the payment id, the folio… */
  periodKey: string;
  vars: BillingEmailVars;
  /** Evidence event to write once sent (charge_notice_sent, …). */
  evidence?: ConsentEventType;
}

export type DispatchResult =
  | { sent: true; messageId: string | null }
  | { sent: false; reason: 'duplicate' | 'send_failed' | 'db' };

export async function dispatchBillingEmail(input: DispatchInput): Promise<DispatchResult> {
  const admin = createAdminClient();
  const mail = billingEmail(input.kind, input.vars);

  const { data: claimed, error } = await admin
    .from('email_dispatches')
    .insert({
      user_id: input.userId,
      kind: input.kind,
      period_key: input.periodKey,
      template_id: mail.templateId,
      template_version: mail.templateVersion,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    // 23505 = the unique key: this notice was already sent.
    if (error.code === '23505') return { sent: false, reason: 'duplicate' };
    console.error('[notices] could not claim', input.kind, input.periodKey, error.message);
    return { sent: false, reason: 'db' };
  }

  const res = await sendEmail({
    to: input.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  const messageId = res.ok ? (res.id ?? null) : null;
  await admin
    .from('email_dispatches')
    .update({
      provider_message_id: messageId,
      delivery_status: res.ok ? 'sent' : 'failed',
    })
    .eq('id', claimed!.id as string);

  if (!res.ok) {
    console.error('[notices] send failed', input.kind, input.periodKey, res);
    return { sent: false, reason: 'send_failed' };
  }

  if (input.evidence) {
    await recordConsent({
      event_type: input.evidence,
      user_id: input.userId,
      account_email: input.email,
      documents: [],
      client_timezone: 'America/Mexico_City',
      ip_address: null,
      user_agent: null,
      locale: 'es-MX',
      surface: 'email',
      ui_version: UI_VERSION,
      disclosure_text: mail.text,
      checkbox_text: null,
      checkbox_checked: null,
      button_label: null,
      plan_id: null,
      amount_mxn: null,
      currency: 'MXN',
      tax_included: true,
      billing_interval: null,
      trial_end_utc: null,
      charge_date_utc: null,
      reminder_date_utc: null,
      payment_method: null,
      marketing_opt_in: false,
      details: {
        kind: input.kind,
        period_key: input.periodKey,
        template_id: mail.templateId,
        template_version: mail.templateVersion,
        provider_message_id: messageId,
      },
    }).catch((err) => console.error('[notices] evidence not stored', err));
  }
  return { sent: true, messageId };
}
