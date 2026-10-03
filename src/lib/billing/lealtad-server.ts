// Pro Lealtad I/O (WS-7): what happens when a charge is approved, and the
// daily reconcile of the amount Mercado Pago will charge next. Rules in
// ./lealtad.ts.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago } from '@/lib/payments/mercadopago';
import { notify } from '@/lib/notifications/notify';
import { mpPreapprovalAmountPutVerified } from '@/lib/config/flags';
import { lealtadPriceCents } from '@/config/pricing';
import { recordConsent, UI_VERSION } from './consent';
import { formatMXN } from './format';
import { issueRefund } from './disputes-server';
import { lealtadGate, stepAfterCharge } from './lealtad';

/**
 * Set the amount Mercado Pago charges next. Only when lowering a running
 * card-token preapproval's amount is verified (O-6, R.7); otherwise a
 * person does it. No code path ever raises the amount of a running
 * preapproval (Términos 4 bis.4): the schedule only goes down.
 */
export async function putNextAmount(preapprovalId: string, step: number): Promise<boolean> {
  const cents = lealtadPriceCents(step);
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from('subscriptions')
    .select('loyalty_mp_amount_cents, amount_cents')
    .eq('mp_preapproval_id', preapprovalId)
    .maybeSingle();
  const current =
    (sub?.loyalty_mp_amount_cents as number | null) ?? (sub?.amount_cents as number | null);
  if (current !== null && current !== undefined && cents > current) {
    console.error('[lealtad] refusing to raise a running preapproval', {
      preapprovalId,
      current,
      cents,
    });
    return false;
  }
  if (!mpPreapprovalAmountPutVerified()) {
    await notify({
      severity: 'warning',
      title: 'Pro Lealtad: ajustar el monto del siguiente cobro a mano',
      body: `Suscripción ${preapprovalId}: el siguiente cobro debe ser ${formatMXN(cents)} MXN (paso ${step + 1}). El cambio de monto en Mercado Pago no está verificado (OPS-14). TODO(owner O-6)`,
      href: '/dashboard/dinero',
      source: 'billing.lealtad',
    }).catch(() => {});
    return false;
  }
  try {
    await getMercadoPago().preapproval.update({
      id: preapprovalId,
      body: { auto_recurring: { transaction_amount: cents / 100, currency_id: 'MXN' } },
    } as never);
  } catch (err) {
    // An MP-side failure never resets the step; the daily reconcile retries.
    console.error('[lealtad] PUT next amount failed', preapprovalId, err);
    return false;
  }
  await admin
    .from('subscriptions')
    .update({ loyalty_mp_amount_cents: cents })
    .eq('mp_preapproval_id', preapprovalId);
  return true;
}

/**
 * An approved Pro Lealtad charge: gate the amount against its step, record
 * the step on the payment, move the subscription one step down and set the
 * next amount. Idempotent on the payment: a replayed webhook finds
 * payments.loyalty_step already set and changes nothing.
 */
export async function onLealtadCharge(input: {
  userId: string;
  preapprovalId: string;
  paymentId: string;
  chargedCents: number;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const admin = createAdminClient();
  const { data: pay } = await admin
    .from('payments')
    .select('loyalty_step')
    .eq('mp_payment_id', input.paymentId)
    .maybeSingle();
  if (pay?.loyalty_step !== null && pay?.loyalty_step !== undefined) return; // already counted
  const { data: sub } = await admin
    .from('subscriptions')
    .select('loyalty_step')
    .eq('mp_preapproval_id', input.preapprovalId)
    .maybeSingle();
  const step = (sub?.loyalty_step as number | null) ?? 0;
  const { data: lastPaid } = await admin
    .from('payments')
    .select('created_at')
    .eq('mp_preapproval_id', input.preapprovalId)
    .not('loyalty_step', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const gate = lealtadGate({
    chargedCents: input.chargedCents,
    step,
    advancedAt: lastPaid?.created_at ? new Date(lastPaid.created_at as string) : null,
    now,
  });
  if (gate.action === 'refund_difference') {
    // Access stays; the difference goes back automatically (Términos §7.2(d))
    // and the step is unaffected.
    const r = await issueRefund({
      userId: input.userId,
      mpPaymentId: input.paymentId,
      cents: gate.refundCents,
      reason: 'legal_7_2_d',
      surface: 'mp_webhook',
      actor: null,
    });
    if (!r.ok) console.error('[lealtad] automatic refund of an overcharge failed', input.paymentId);
    await notify({
      severity: 'warning',
      title: 'Pro Lealtad: cobro mayor al del calendario, se reembolsó la diferencia',
      body: `Pago ${input.paymentId}: ${formatMXN(input.chargedCents)} MXN; correspondía ${formatMXN(lealtadPriceCents(step))} MXN.`,
      href: '/dashboard/dinero',
      source: 'billing.lealtad',
    }).catch(() => {});
  } else if (gate.action !== 'accept') {
    await notify({
      severity: 'warning',
      title: 'Pro Lealtad: el cobro no coincide con el calendario',
      body: `Pago ${input.paymentId}: ${formatMXN(input.chargedCents)} MXN; correspondía ${formatMXN(lealtadPriceCents(step))} MXN (paso ${step + 1}).`,
      href: '/dashboard/dinero',
      source: 'billing.lealtad',
    }).catch(() => {});
  }

  const next = stepAfterCharge(step);
  await admin.from('payments').update({ loyalty_step: step }).eq('mp_payment_id', input.paymentId);
  await admin
    .from('subscriptions')
    .update({ loyalty_step: next })
    .eq('mp_preapproval_id', input.preapprovalId);
  await recordConsent({
    event_type: 'lealtad_step_advanced',
    user_id: input.userId,
    account_email: null,
    documents: [],
    client_timezone: null,
    ip_address: null,
    user_agent: null,
    locale: 'es-MX',
    surface: 'mp_webhook',
    ui_version: UI_VERSION,
    disclosure_text: null,
    checkbox_text: null,
    checkbox_checked: null,
    button_label: null,
    plan_id: 'pro_lealtad',
    amount_mxn: input.chargedCents / 100,
    currency: 'MXN',
    tax_included: true,
    billing_interval: 'month',
    trial_end_utc: null,
    charge_date_utc: now.toISOString(),
    reminder_date_utc: null,
    payment_method: null,
    marketing_opt_in: false,
    details: {
      mp_preapproval_id: input.preapprovalId,
      mp_payment_id: input.paymentId,
      paid_step: String(step),
      next_step: String(next),
    },
  }).catch((err) => console.error('[lealtad] step event not recorded', err));
  if (next !== step) await putNextAmount(input.preapprovalId, next);
}

/** Daily: if MP isn't set to the next step's amount, try again; tell ops
 *  when it is still wrong 48 h before the charge (spec §15.6). */
export async function reconcileLealtad(row: Record<string, unknown>, now: Date): Promise<void> {
  if (row.plan_key !== 'pro_lealtad' || row.status !== 'authorized') return;
  const step = (row.loyalty_step as number | null) ?? 0;
  const want = lealtadPriceCents(step);
  const have =
    (row.loyalty_mp_amount_cents as number | null) ?? (row.amount_cents as number | null);
  if (have === want) return;
  const ok = await putNextAmount(row.mp_preapproval_id as string, step);
  const next = Date.parse(((row.next_charge_at ?? row.next_payment_date) as string | null) ?? '');
  if (!ok && Number.isFinite(next) && next - now.getTime() <= 2 * 86_400_000) {
    await notify({
      severity: 'critical',
      title: 'Pro Lealtad: el próximo cobro saldría con el monto equivocado',
      body: `Suscripción ${String(row.mp_preapproval_id)}: debe cobrar ${formatMXN(want)} MXN en menos de 48 h.`,
      href: '/dashboard/dinero',
      source: 'billing.lealtad',
    }).catch(() => {});
  }
}
