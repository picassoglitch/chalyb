// Refunds and chargebacks, the I/O (WS-8). Rules in ./disputes.ts.
//
// Opening a dispute changes NOTHING on the account: no access, plan, price,
// loyalty_step or trial change. A refund never does either. The only writer
// of account_restrictions is applyMeasure(), and it refuses while
// CHARGEBACK_MEASURES_ENABLED is off.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago, getAppUrl } from '@/lib/payments/mercadopago';
import { getContactInbox } from '@/lib/email/resend';
import { notify } from '@/lib/notifications/notify';
import {
  chargebackCloseAfterDays,
  chargebackMeasuresEnabled,
} from '@/lib/config/flags';
import { lealtadPriceCents } from '@/config/pricing';
import { legalDocument } from '@/lib/legal/documents';
import { recordConsent, UI_VERSION } from './consent';
import { openPersonal } from './consent-crypto';
import type { ConsentEventType } from './consent-core';
import { formatMXN } from './format';
import { dispatchBillingEmail } from './notices';
import { PLAN_NAMES } from './plan-names';
import {
  closeDue,
  decide,
  measuresFor,
  noticeDeadline,
  triage,
  type BadFaithInput,
  type MeasureKind,
  type RefundReason,
} from './disputes';
import { evidenceLines, renderPdf, sha256Hex, type EvidenceInput } from './evidence-pdf';

const DAY = 86_400_000;
const NOTICE_KINDS = ['trial_7d', 'trial_1d', 'renew_7d', 'renew_30d', 'lealtad_7d'];
const CONSENT_KINDS = [
  'trial_started',
  'subscription_started',
  'lealtad_started',
  'price_change_accepted',
  'plan_changed',
];

type Row = Record<string, unknown>;

function mxDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(new Date(iso));
}

async function evidenceEvent(
  type: ConsentEventType,
  userId: string,
  surface: string,
  details: Record<string, unknown>,
  amountCents: number | null = null,
): Promise<void> {
  await recordConsent({
    event_type: type,
    user_id: userId,
    account_email: null,
    documents: [],
    client_timezone: null,
    ip_address: null,
    user_agent: null,
    locale: 'es-MX',
    surface,
    ui_version: UI_VERSION,
    disclosure_text: null,
    checkbox_text: null,
    checkbox_checked: null,
    button_label: null,
    plan_id: null,
    amount_mxn: amountCents === null ? null : amountCents / 100,
    currency: 'MXN',
    tax_included: true,
    billing_interval: null,
    trial_end_utc: null,
    charge_date_utc: null,
    reminder_date_utc: null,
    payment_method: null,
    marketing_opt_in: false,
    details,
  }).catch((err) => console.error('[disputes] evidence not stored', type, err));
}

// ── Refunds ───────────────────────────────────────────────────────────────

/**
 * Refund through Mercado Pago with a Términos §7.2 reason, and record
 * refund_issued. Touches nothing else: not the plan, the price, the
 * loyalty_step, the trial or the account (§7.3). A refund with a cancel
 * goes through the ordinary cancel path, separately.
 */
export async function issueRefund(input: {
  userId: string;
  mpPaymentId: string;
  cents: number;
  reason: RefundReason;
  surface: string;
  actor: string | null;
}): Promise<{ ok: boolean }> {
  if (input.cents <= 0) return { ok: false };
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('payments')
    .select('amount_cents, refunded_cents')
    .eq('mp_payment_id', input.mpPaymentId)
    .maybeSingle();
  // Idempotent: never refund past what is left of the charge.
  const already = (pay?.refunded_cents as number | null) ?? 0;
  const left = pay ? ((pay.amount_cents as number | null) ?? 0) - already : input.cents;
  const cents = Math.min(input.cents, left);
  if (cents <= 0) return { ok: true };
  try {
    await getMercadoPago().refund.create({
      payment_id: input.mpPaymentId,
      body: { amount: cents / 100 },
    });
  } catch (err) {
    console.error('[disputes] Mercado Pago refused the refund', input.mpPaymentId, err);
    return { ok: false };
  }
  await admin
    .from('payments')
    .update({ refunded_cents: already + cents, refund_reason: input.reason })
    .eq('mp_payment_id', input.mpPaymentId);
  await evidenceEvent(
    'refund_issued',
    input.userId,
    input.surface,
    { reason: input.reason, payment_id: input.mpPaymentId, admin: input.actor },
    cents,
  );
  return { ok: true };
}

/** A refund Mercado Pago reports that we didn't issue here (e.g. from its
 *  panel). Recorded for a person to classify; the account is untouched. */
export async function onRefundReported(input: {
  userId: string | null;
  mpPaymentId: string;
  amountMajor: number | null;
}): Promise<void> {
  await notify({
    severity: 'info',
    title: 'Reembolso registrado en Mercado Pago',
    body: `Pago ${input.mpPaymentId}${input.amountMajor ? ` · ${formatMXN(Math.round(input.amountMajor * 100))} MXN` : ''}. La cuenta no cambia. Si no salió de Chalyb, anota el motivo legal (§7.2).`,
    href: '/dashboard/dinero',
    source: 'mp.webhook',
  }).catch(() => {});
}

// ── Chargebacks ───────────────────────────────────────────────────────────

async function triageInputs(cb: { user_id: string; mp_preapproval_id: string | null; charged_at: string | null; amount_cents: number }, pay: Row | null) {
  const admin = createAdminClient();
  const chargedAt = cb.charged_at ? new Date(cb.charged_at) : new Date();
  const isSub = (pay?.kind as string | undefined) === 'subscription' || !!cb.mp_preapproval_id;
  const [{ data: consent }, { data: notices }, { data: sub }] = await Promise.all([
    admin
      .from('consent_events')
      .select('consent_id')
      .eq('user_id', cb.user_id)
      .in('event_type', CONSENT_KINDS)
      .lte('timestamp_utc', chargedAt.toISOString())
      .limit(1),
    admin
      .from('email_dispatches')
      .select('sent_at, delivery_status')
      .eq('user_id', cb.user_id)
      .in('kind', NOTICE_KINDS)
      .lte('sent_at', chargedAt.toISOString())
      .gte('sent_at', new Date(chargedAt.getTime() - 40 * DAY).toISOString())
      .order('sent_at', { ascending: true }),
    cb.mp_preapproval_id
      ? admin
          .from('subscriptions')
          .select('amount_cents, plan_key, cancelled_at')
          .eq('mp_preapproval_id', cb.mp_preapproval_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const delivered = (notices ?? []).find(
    (n) => n.delivery_status !== 'bounced' && n.delivery_status !== 'failed',
  );
  const noticeDays = delivered
    ? Math.floor((chargedAt.getTime() - Date.parse(delivered.sent_at as string)) / DAY)
    : null;
  const cancelledAt = (sub?.cancelled_at as string | null) ?? null;
  const expected =
    sub?.plan_key === 'pro_lealtad' && pay?.loyalty_step !== null && pay?.loyalty_step !== undefined
      ? lealtadPriceCents(pay.loyalty_step as number)
      : ((sub?.amount_cents as number | null) ?? null);
  return {
    consentOnRecord: (consent ?? []).length > 0,
    unauthorizedSignals: false,
    noticeRequired: isSub,
    noticeDeliveredDaysBefore: noticeDays,
    cancelledBeforeCharge: !!cancelledAt && Date.parse(cancelledAt) < chargedAt.getTime(),
    amountMismatch: expected !== null && expected !== cb.amount_cents,
    serviceFailure: false,
  };
}

/**
 * Mercado Pago reports a dispute (payment `charged_back` / `in_mediation`,
 * or the `chargebacks` topic). Records it, triages it and tells an admin.
 * Changes NOTHING on the account. Idempotent per payment id.
 */
export async function onChargebackOpened(input: {
  mpPaymentId: string;
  mpStatus: string;
  mpChargebackId?: string | null;
}): Promise<{ ok: boolean }> {
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('payments')
    .select('user_id, amount_cents, mp_preapproval_id, created_at, kind, loyalty_step')
    .eq('mp_payment_id', input.mpPaymentId)
    .maybeSingle();
  if (!pay?.user_id) {
    console.error('[disputes] dispute for a payment we do not have', input);
    return { ok: true };
  }
  const row = {
    user_id: pay.user_id as string,
    mp_payment_id: input.mpPaymentId,
    mp_chargeback_id: input.mpChargebackId ?? null,
    mp_preapproval_id: (pay.mp_preapproval_id as string | null) ?? null,
    amount_cents: (pay.amount_cents as number | null) ?? 0,
    charged_at: (pay.created_at as string | null) ?? null,
    mp_status: input.mpStatus,
  };
  const { data: inserted, error } = await admin
    .from('chargebacks')
    .upsert(row, { onConflict: 'mp_payment_id', ignoreDuplicates: true })
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[disputes] could not record the chargeback', error.message);
    return { ok: false };
  }
  if (!inserted) return { ok: true }; // already on file
  const id = inserted.id as string;
  await evidenceEvent('chargeback_opened', row.user_id, 'mp_webhook', {
    chargeback_id: id,
    mp_payment_id: input.mpPaymentId,
    mp_status: input.mpStatus,
  }, row.amount_cents);

  const t = triage(await triageInputs(row, pay as Row));
  await admin
    .from('chargebacks')
    .update({
      triage: t.result,
      triage_reason: t.result === 'legal_refund' ? t.reason : null,
      closed_at: t.result === 'legal_refund' ? new Date().toISOString() : null,
    })
    .eq('id', id);
  await evidenceEvent('chargeback_triaged', row.user_id, 'mp_webhook', {
    chargeback_id: id,
    result: t.result,
    reason: t.result === 'legal_refund' ? t.reason : null,
  });
  await notify({
    severity: 'warning',
    title:
      t.result === 'legal_refund'
        ? 'Disputa: caso legal (§7.2), no impugnar'
        : 'Disputa: cargo autorizado, preparar evidencia',
    body: `Pago ${input.mpPaymentId} · ${formatMXN(row.amount_cents)} MXN. La cuenta no cambia durante la disputa.${t.result === 'legal_refund' ? ` Acepta la disputa en Mercado Pago (motivo ${t.reason}). Si el banco ya devolvió el dinero, no vuelvas a cobrar.` : ' Genera el paquete de evidencia en Dinero → Disputas.'}`,
    href: '/dashboard/dinero#disputas',
    source: 'billing.disputes',
  }).catch(() => {});
  return { ok: true };
}

async function loadChargeback(id: string): Promise<Row | null> {
  const { data } = await createAdminClient().from('chargebacks').select('*').eq('id', id).maybeSingle();
  return (data as Row | null) ?? null;
}

/** Admin: a §7.2 case found by a person (e.g. stolen-card signals or a
 *  service failure). Closes the case with no notice and no measure. */
export async function markLegalCase(id: string, reason: RefundReason, actor: string): Promise<boolean> {
  const cb = await loadChargeback(id);
  if (!cb || cb.decision) return false;
  await createAdminClient()
    .from('chargebacks')
    .update({ triage: 'legal_refund', triage_reason: reason, closed_at: new Date().toISOString() })
    .eq('id', id);
  await evidenceEvent('chargeback_triaged', cb.user_id as string, 'admin_disputes', {
    chargeback_id: id,
    result: 'legal_refund',
    reason,
    admin: actor,
  });
  return true;
}

/** Admin: Mercado Pago's resolution of the dispute. */
export async function recordResolution(id: string, resolution: 'won' | 'lost', actor: string): Promise<boolean> {
  const cb = await loadChargeback(id);
  if (!cb || cb.resolution) return false;
  await createAdminClient()
    .from('chargebacks')
    .update({ resolution, resolved_at: new Date().toISOString() })
    .eq('id', id);
  await evidenceEvent('chargeback_resolved', cb.user_id as string, 'admin_disputes', {
    chargeback_id: id,
    resolution,
    admin: actor,
  });
  return true;
}

/**
 * Admin: send the §10.5 notice (10 business days). Only for a contested,
 * resolved case. The deadline is stored with the event. Manual by design
 * while measures are off (R-6).
 */
export async function sendChargebackNotice(
  id: string,
  input: { actor: string; payUrl: string | null; medida: 'suspender' | 'cerrar' },
): Promise<{ ok: boolean; code?: 'NOT_ALLOWED' | 'PAY_URL' | 'EMAIL' }> {
  const cb = await loadChargeback(id);
  if (!cb || cb.triage !== 'contest' || !cb.resolution || cb.notice_sent_at || cb.decision)
    return { ok: false, code: 'NOT_ALLOWED' };
  const pendiente = cb.resolution === 'lost' && !cb.paid_at;
  const payUrl = input.payUrl?.trim() || null;
  if (pendiente && !(payUrl && /^https:\/\/([\w-]+\.)*(mercadopago\.com\.mx|mpago\.la)\//.test(payUrl)))
    return { ok: false, code: 'PAY_URL' };

  const admin = createAdminClient();
  const userId = cb.user_id as string;
  const [{ data: profile }, { data: consent }, { data: notice }, { data: sub }] = await Promise.all([
    admin.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
    admin
      .from('consent_events')
      .select('consent_id, timestamp_utc')
      .eq('user_id', userId)
      .in('event_type', CONSENT_KINDS)
      .lte('timestamp_utc', (cb.charged_at as string | null) ?? new Date().toISOString())
      .order('timestamp_utc', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('email_dispatches')
      .select('sent_at')
      .eq('user_id', userId)
      .in('kind', NOTICE_KINDS)
      .lte('sent_at', (cb.charged_at as string | null) ?? new Date().toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    cb.mp_preapproval_id
      ? admin.from('subscriptions').select('plan_key').eq('mp_preapproval_id', cb.mp_preapproval_id as string).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!profile?.email) return { ok: false, code: 'EMAIL' };
  const usage = await usageSummary(userId, cb);
  const sentAt = new Date();
  const deadline = noticeDeadline(sentAt);
  const plan = sub?.plan_key ? PLAN_NAMES[sub.plan_key as keyof typeof PLAN_NAMES] : 'Chalyb';
  const res = await dispatchBillingEmail({
    kind: 'chargeback_notice',
    userId,
    email: profile.email as string,
    periodKey: `chargeback:${id}`,
    vars: {
      nombre: ((profile.full_name as string | null) ?? '').split(' ')[0] ?? '',
      plan: plan ?? 'Chalyb',
      monto: formatMXN(cb.amount_cents as number),
      fecha_cobro: mxDate(cb.charged_at as string | null),
      fecha_consentimiento: mxDate((consent?.timestamp_utc as string | null) ?? null),
      consent_id: (consent?.consent_id as string | null) ?? '—',
      fecha_aviso: mxDate((notice?.sent_at as string | null) ?? null),
      resumen_uso: usage.text,
      pendiente,
      fecha_limite: mxDate(deadline.toISOString()),
      medida: input.medida,
      pagar_url: payUrl ?? undefined,
      responder_url: `mailto:${getContactInbox()}?subject=${encodeURIComponent(`Contracargo ${cb.mp_payment_id as string}`)}`,
      appUrl: getAppUrl(),
    },
  } as Parameters<typeof dispatchBillingEmail>[0]);
  if (!res.sent) return { ok: false, code: 'EMAIL' };
  await admin
    .from('chargebacks')
    .update({ notice_sent_at: sentAt.toISOString(), deadline_utc: deadline.toISOString() })
    .eq('id', id);
  await evidenceEvent('chargeback_notice_sent', userId, 'admin_disputes', {
    chargeback_id: id,
    deadline_utc: deadline.toISOString(),
    medida: input.medida,
    admin: input.actor,
  });
  return { ok: true };
}

/** Admin: the user answered. Accepted = they showed the charge wasn't owed;
 *  the case closes with no measure. */
export async function recordResponse(id: string, accepted: boolean, actor: string): Promise<boolean> {
  const cb = await loadChargeback(id);
  if (!cb || cb.decision) return false;
  await createAdminClient()
    .from('chargebacks')
    .update({ response_received_at: new Date().toISOString(), response_accepted: accepted })
    .eq('id', id);
  await evidenceEvent('chargeback_response_received', cb.user_id as string, 'admin_disputes', {
    chargeback_id: id,
    accepted,
    admin: actor,
  });
  if (accepted) await decideChargeback(id, new Date(), actor);
  return true;
}

/** Admin: the user paid. Any restriction tied to this case is lifted now. */
export async function recordPaid(id: string, actor: string): Promise<boolean> {
  const cb = await loadChargeback(id);
  if (!cb) return false;
  const now = new Date().toISOString();
  const admin = createAdminClient();
  await admin.from('chargebacks').update({ paid_at: now }).eq('id', id);
  await admin
    .from('account_restrictions')
    .update({ lifted_at: now })
    .eq('chargeback_id', id)
    .in('kind', ['restricted', 'closed'])
    .is('lifted_at', null);
  if (!cb.decision) await decideChargeback(id, new Date(), actor);
  return true;
}

function badFaithInput(cb: Row, used: boolean, now: Date): BadFaithInput {
  return {
    consentOnRecord: cb.triage === 'contest',
    legalCase: cb.triage === 'legal_refund',
    usedInPeriod: used,
    cancelledBeforeCharge: false, // a cancelled-before charge triages as legal_refund (§7.2(c))
    resolution: (cb.resolution as 'won' | 'lost' | null) ?? null,
    unpaid: !cb.paid_at,
    noticeSentAt: cb.notice_sent_at ? new Date(cb.notice_sent_at as string) : null,
    deadline: cb.deadline_utc ? new Date(cb.deadline_utc as string) : null,
    now,
    paid: !!cb.paid_at,
    responseAccepted: cb.response_accepted === true,
  };
}

/** The written decision (§10.5 / step 4). Records it once it's decidable and
 *  applies the measures the flags allow (none while they're off). */
export async function decideChargeback(id: string, now: Date, actor: string | null): Promise<'bad_faith' | 'none' | 'pending'> {
  const cb = await loadChargeback(id);
  if (!cb || cb.decision) return ((cb?.decision as 'bad_faith' | 'none' | undefined) ?? 'pending');
  const usage = await usageSummary(cb.user_id as string, cb);
  const d = decide(badFaithInput(cb, usage.used, now));
  if (d === 'pending') return d;
  const admin = createAdminClient();
  await admin
    .from('chargebacks')
    .update({ decision: d, decided_at: now.toISOString(), closed_at: d === 'none' ? now.toISOString() : null })
    .eq('id', id);
  const measures = measuresFor(d, { measuresEnabled: chargebackMeasuresEnabled(), unpaid: !cb.paid_at });
  await evidenceEvent('chargeback_bad_faith_decided', cb.user_id as string, actor ? 'admin_disputes' : 'cron', {
    chargeback_id: id,
    decision: d,
    measures: measures.length ? measures : 'sin medida',
    admin: actor,
  });
  for (const m of measures) await applyMeasure(cb.user_id as string, m, id);
  if (d === 'bad_faith' && measures.length === 0) {
    await notify({
      severity: 'warning',
      title: 'Contracargo de mala fe decidido: sin medida automática',
      body: `Pago ${cb.mp_payment_id as string}. CHARGEBACK_MEASURES_ENABLED está apagado; cualquier medida espera al abogado (OPS-10).`,
      href: '/dashboard/dinero#disputas',
      source: 'billing.disputes',
    }).catch(() => {});
  }
  return d;
}

/**
 * THE ONLY WRITER of account_restrictions. Refuses while
 * CHARGEBACK_MEASURES_ENABLED is off, and only acts on a case decided
 * bad_faith.
 */
async function applyMeasure(userId: string, kind: MeasureKind, chargebackId: string): Promise<boolean> {
  if (!chargebackMeasuresEnabled()) return false;
  const cb = await loadChargeback(chargebackId);
  if (cb?.decision !== 'bad_faith') return false;
  const { error } = await createAdminClient()
    .from('account_restrictions')
    .insert({ user_id: userId, kind, chargeback_id: chargebackId });
  if (error) {
    if (error.code !== '23505') console.error('[disputes] measure not stored', kind, error.message);
    return false;
  }
  const event: Record<MeasureKind, ConsentEventType> = {
    restricted: 'account_restricted',
    prepayment_required: 'prepayment_required',
    closed: 'account_closed',
  };
  await evidenceEvent(event[kind], userId, 'billing_disputes', { chargeback_id: chargebackId });
  return true;
}

/** Daily (billing cron): decide cases whose 10 business days have run out,
 *  and close accounts still unpaid N days after a restriction. */
export async function sweepChargebacks(now: Date): Promise<void> {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from('chargebacks')
    .select('id')
    .is('decision', null)
    .not('deadline_utc', 'is', null)
    .lte('deadline_utc', now.toISOString())
    .limit(50);
  for (const r of due ?? []) await decideChargeback(r.id as string, now, null);

  if (!chargebackMeasuresEnabled()) return;
  const { data: restricted } = await admin
    .from('account_restrictions')
    .select('user_id, set_at, chargeback_id')
    .eq('kind', 'restricted')
    .is('lifted_at', null)
    .limit(100);
  for (const r of restricted ?? []) {
    const cb = await loadChargeback(r.chargeback_id as string);
    const { count } = await admin
      .from('chargebacks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', r.user_id as string)
      .eq('decision', 'bad_faith');
    const due = closeDue({
      measuresEnabled: true,
      restrictedAt: new Date(r.set_at as string),
      unpaid: !cb?.paid_at,
      repeatBadFaith: (count ?? 0) > 1,
      closeAfterDays: chargebackCloseAfterDays(),
      now,
    });
    if (due) await applyMeasure(r.user_id as string, 'closed', r.chargeback_id as string);
  }
}

// ── Evidence ──────────────────────────────────────────────────────────────

async function usageSummary(userId: string, cb: Row): Promise<{ used: boolean; text: string; from: string; to: string; events: number; lastSignIn: string | null }> {
  const admin = createAdminClient();
  const from = (cb.charged_at as string | null) ?? new Date().toISOString();
  const to = new Date(Date.parse(from) + 31 * DAY).toISOString();
  const [{ count }, user] = await Promise.all([
    admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('occurred_at', from)
      .lt('occurred_at', to),
    admin.auth.admin.getUserById(userId).catch(() => ({ data: { user: null } })),
  ]);
  const lastSignIn = (user.data.user?.last_sign_in_at as string | undefined) ?? null;
  const signedIn = !!lastSignIn && lastSignIn >= from && lastSignIn < to;
  const events = count ?? 0;
  return {
    used: events > 0 || signedIn,
    text: `${events} usos registrados${lastSignIn ? `, último inicio de sesión ${mxDate(lastSignIn)}` : ''}`,
    from,
    to,
    events,
    lastSignIn,
  };
}

/** Admin "Generar paquete de evidencia": the PDF for Mercado Pago, its
 *  sha256 stored and logged as chargeback_evidence_submitted. */
export async function buildEvidencePackage(id: string, actor: string): Promise<{ pdf: Uint8Array; sha256: string; filename: string } | null> {
  const cb = await loadChargeback(id);
  if (!cb) return null;
  const admin = createAdminClient();
  const userId = cb.user_id as string;
  const chargedAt = (cb.charged_at as string | null) ?? new Date().toISOString();
  const [{ data: profile }, { data: consents }, { data: notices }, { data: sub }, { data: cancel }] =
    await Promise.all([
      admin.from('profiles').select('email').eq('id', userId).maybeSingle(),
      admin
        .from('consent_events')
        .select('*')
        .eq('user_id', userId)
        .in('event_type', CONSENT_KINDS)
        .lte('timestamp_utc', chargedAt)
        .order('timestamp_utc', { ascending: false })
        .limit(3),
      admin
        .from('email_dispatches')
        .select('kind, template_id, provider_message_id, sent_at, delivery_status')
        .eq('user_id', userId)
        .in('kind', NOTICE_KINDS)
        .lte('sent_at', chargedAt)
        .gte('sent_at', new Date(Date.parse(chargedAt) - 40 * DAY).toISOString())
        .order('sent_at', { ascending: false }),
      cb.mp_preapproval_id
        ? admin
            .from('subscriptions')
            .select('card_brand, card_last4')
            .eq('mp_preapproval_id', cb.mp_preapproval_id as string)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from('cancellation_events')
        .select('requested_at, folio_cancelacion')
        .eq('user_id', userId)
        .lt('requested_at', chargedAt)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const usage = await usageSummary(userId, cb);
  const input: EvidenceInput = {
    generatedAt: new Date(),
    account: { userId, email: (profile?.email as string | null) ?? null },
    charge: {
      mpPaymentId: cb.mp_payment_id as string,
      mpPreapprovalId: (cb.mp_preapproval_id as string | null) ?? null,
      amountMxn: (cb.amount_cents as number) / 100,
      chargedAt,
      cardBrand: (sub?.card_brand as string | null) ?? null,
      cardLast4: (sub?.card_last4 as string | null) ?? null,
    },
    consents: (consents ?? []).map((c) => ({
      event_type: c.event_type as string,
      consent_id: c.consent_id as string,
      timestamp_utc: c.timestamp_utc as string,
      ip: openPersonal((c.ip_address_enc as string | null) ?? null),
      user_agent: openPersonal((c.user_agent_enc as string | null) ?? null),
      disclosure_text: (c.disclosure_text as string | null) ?? null,
      checkbox_text: (c.checkbox_text as string | null) ?? null,
      checkbox_checked: (c.checkbox_checked as boolean | null) ?? null,
      button_label: (c.button_label as string | null) ?? null,
      ui_version: c.ui_version as string,
      event_hash: c.event_hash as string,
      documents: (c.documents as EvidenceInput['consents'][number]['documents']) ?? [],
    })),
    notices: (notices ?? []).map((n) => ({
      kind: n.kind as string,
      template: n.template_id as string,
      message_id: (n.provider_message_id as string | null) ?? null,
      sent_at: n.sent_at as string,
      delivery_status: n.delivery_status as string,
    })),
    cancellation: {
      requestedAt: (cancel?.requested_at as string | null) ?? null,
      folio: (cancel?.folio_cancelacion as string | null) ?? null,
    },
    usage: { from: usage.from, to: usage.to, lastSignInAt: usage.lastSignIn, meteredEvents: usage.events },
    policyUrls: (['terminos', 'suscripcion'] as const).map((d) => {
      const doc = legalDocument(d);
      return `${d} v${doc.version}: ${doc.url}`;
    }),
  };
  const pdf = renderPdf(evidenceLines(input));
  const sha256 = sha256Hex(pdf);
  await admin.from('chargebacks').update({ evidence_sha256: sha256 }).eq('id', id);
  await evidenceEvent('chargeback_evidence_submitted', userId, 'admin_disputes', {
    chargeback_id: id,
    pdf_sha256: sha256,
    admin: actor,
  });
  return { pdf, sha256, filename: `evidencia-${cb.mp_payment_id as string}.pdf` };
}
