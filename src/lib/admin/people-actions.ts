'use server';

// Personas row actions (P5-2). Each one re-checks the admin on the server,
// does exactly one thing, and lands in Actividad with the admin's name.
// Nothing here charges a customer: a plan change is an emailed link the user
// accepts with the recurring-charge checkbox (P2-9).

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { getAppUrl } from '@/lib/payments/mercadopago';
import { sendEmail } from '@/lib/email/resend';
import { escapeHtml } from '@/lib/email/escape';
import { wrap } from '@/lib/email/templates';
import { cancelForUser } from '@/lib/billing/billing-actions';
import { issueRefund } from '@/lib/billing/disputes-server';
import { isRefundReason } from '@/lib/billing/disputes';
import { planPrice, type PlanKey } from '@/config/pricing';
import { PLAN_KEYS } from '@/lib/billing/api';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import { formatMXN } from '@/lib/billing/format';
import { adminName, adminSession } from './guard';
import { personActions, personStatus } from './people';
import type { SubRow } from './data';

export type PeopleActionResult =
  | { ok: true }
  | { ok: false; code: 'FORBIDDEN' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'MP_ERROR' | 'EMAIL_ERROR' };

const DAY = 86_400_000;

async function target(userId: string) {
  const db = createAdminClient();
  const [{ data: profile }, { data: sub }, { data: pay }] = await Promise.all([
    db
      .from('profiles')
      .select('id, email, full_name, tier, tier_ends_at, role')
      .eq('id', userId)
      .maybeSingle(),
    db
      .from('subscriptions')
      .select(
        'user_id, status, plan_key, tier, mp_preapproval_id, trial_ends_at, started_at, created_at, cancel_at_period_end, cancelled_at, grace_ends_at, access_until, charge_hold_until, reminder_due_at, reminder_delivered_at, last_charge_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from('payments')
      .select('id, amount_cents, refunded_cents, mp_payment_id, currency')
      .eq('user_id', userId)
      .in('status', ['approved', 'accredited', 'processed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!profile) return null;
  const left = pay
    ? (pay.amount_cents as number) - ((pay.refunded_cents as number | null) ?? 0)
    : 0;
  const row = {
    id: profile.id as string,
    name: (profile.full_name as string | null) ?? '',
    email: (profile.email as string | null) ?? '',
    plan: 'Gratis' as const,
    status: personStatus((sub as SubRow | null) ?? null, Date.now()),
    since: '',
    sub: (sub as SubRow | null) ?? null,
  };
  return { profile, sub: row.sub, pay, left, allowed: personActions(row, left > 0 ? left : null) };
}

async function audit(
  actor: NonNullable<Awaited<ReturnType<typeof adminSession>>>,
  action: Parameters<typeof logAudit>[0]['action'],
  t: { id: string; email: string },
  extra: { before?: unknown; after?: unknown; metadata?: Record<string, unknown> } = {},
) {
  await logAudit({
    action,
    actorId: actor.user.id,
    actorEmail: actor.user.email ?? null,
    targetUserId: t.id,
    targetEmail: t.email || null,
    ...extra,
    metadata: { ...(extra.metadata ?? {}), admin_name: adminName(actor) },
  } as Parameters<typeof logAudit>[0]);
  revalidatePath('/[locale]/dashboard', 'layout');
}

/** "Regalar 1 mes gratis": Pro for 30 more days, no charge. Not offered
 *  while an automatic charge would land inside that month. */
export async function giftMonth(userId: string): Promise<PeopleActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  const t = await target(userId);
  if (!t) return { ok: false, code: 'NOT_FOUND' };
  if (!t.allowed.giftMonth) return { ok: false, code: 'NOT_ALLOWED' };
  const now = Date.now();
  const current = t.profile.tier_ends_at ? Date.parse(t.profile.tier_ends_at as string) : 0;
  const until = new Date(Math.max(now, current) + 30 * DAY).toISOString();
  const tier = t.profile.tier === 'VIP' ? 'VIP' : 'PRO';
  const { error } = await createAdminClient()
    .from('profiles')
    .update({ tier, tier_ends_at: until })
    .eq('id', userId);
  if (error) return { ok: false, code: 'NOT_FOUND' };
  await audit(
    actor,
    'admin.gift_month',
    { id: userId, email: t.profile.email as string },
    {
      before: { tier: t.profile.tier, tier_ends_at: t.profile.tier_ends_at },
      after: { tier, tier_ends_at: until },
    },
  );
  return { ok: true };
}

/** "Cambiar su plan": emails a link to the confirm step with the
 *  recurring-charge checkbox. No charge until the user accepts there. */
export async function offerPlanChange(
  userId: string,
  planKey: string,
): Promise<PeopleActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  if (!(PLAN_KEYS as readonly string[]).includes(planKey))
    return { ok: false, code: 'NOT_ALLOWED' };
  const t = await target(userId);
  if (!t?.profile.email) return { ok: false, code: 'NOT_FOUND' };
  const price = planPrice(planKey as PlanKey);
  const link = `${getAppUrl()}/app/billing/cambiar?plan=${planKey}`;
  const name = ((t.profile.full_name as string | null) ?? '').split(' ')[0] ?? '';
  const plan = PLAN_NAMES[planKey as PlanKey];
  const subject = `Te proponemos el plan ${plan}`;
  const body = `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f4f3ee;">Hola ${escapeHtml(name)}, te proponemos cambiar a <b>${escapeHtml(plan)}</b> (${escapeHtml(formatMXN(price.totalCents))} MXN ${price.interval === 'year' ? 'al año' : 'al mes'}, IVA incluido).</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f4f3ee;">No cambia nada ni se cobra nada hasta que tú lo confirmes.</p>
<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#e8bb7f;color:#070809;font-weight:700;text-decoration:none;">Revisar y confirmar</a>`;
  const sent = await sendEmail({
    to: t.profile.email as string,
    subject,
    html: wrap({ title: subject, preview: subject, body }),
  });
  if (!sent.ok) return { ok: false, code: 'EMAIL_ERROR' };
  await audit(
    actor,
    'admin.plan_offer',
    { id: userId, email: t.profile.email as string },
    { metadata: { plan_key: planKey } },
  );
  return { ok: true };
}

/** "Reenviar correo de acceso": a fresh sign-in link. */
export async function resendAccessEmail(userId: string): Promise<PeopleActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  const t = await target(userId);
  const email = t?.profile.email as string | undefined;
  if (!email) return { ok: false, code: 'NOT_FOUND' };
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${getAppUrl()}/app` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) return { ok: false, code: 'EMAIL_ERROR' };
  const subject = 'Tu enlace para entrar a Chalyb';
  const body = `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f4f3ee;">Toca el botón para entrar a tu cuenta. El enlace dura poco y sirve una sola vez.</p>
<a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#e8bb7f;color:#070809;font-weight:700;text-decoration:none;">Entrar a Chalyb</a>`;
  const sent = await sendEmail({
    to: email,
    subject,
    html: wrap({ title: subject, preview: subject, body }),
  });
  if (!sent.ok) return { ok: false, code: 'EMAIL_ERROR' };
  await audit(actor, 'admin.access_email', { id: userId, email });
  return { ok: true };
}

/** "Reembolsar último cobro": the unrefunded rest of the last settled
 *  charge, back to the card through Mercado Pago, for one of the legal cases
 *  of Términos de Suscripción §7.2 (there is no courtesy refund, §7.4). The
 *  refund changes nothing else: plan, price, Lealtad step, account (§7.3). */
export async function refundLastCharge(
  userId: string,
  reason: string,
): Promise<PeopleActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  if (!isRefundReason(reason)) return { ok: false, code: 'NOT_ALLOWED' };
  const t = await target(userId);
  if (!t?.pay || !t.allowed.refundLast || !t.pay.mp_payment_id)
    return { ok: false, code: 'NOT_ALLOWED' };
  const r = await issueRefund({
    userId,
    mpPaymentId: t.pay.mp_payment_id as string,
    cents: t.left,
    reason,
    surface: 'admin_people',
    actor: adminName(actor),
  });
  if (!r.ok) return { ok: false, code: 'MP_ERROR' };
  await audit(
    actor,
    'admin.refund',
    { id: userId, email: t.profile.email as string },
    {
      metadata: { payment_id: t.pay.mp_payment_id, amount_cents: t.left, reason },
    },
  );
  return { ok: true };
}

/** "Cancelar su suscripción": the same cancel as Mi plan (P2-7); access
 *  stays until the end of what was paid. */
export async function cancelForPerson(userId: string): Promise<PeopleActionResult> {
  const actor = await adminSession();
  if (!actor) return { ok: false, code: 'FORBIDDEN' };
  const t = await target(userId);
  if (!t || !t.allowed.cancel) return { ok: false, code: 'NOT_ALLOWED' };
  const r = await cancelForUser(
    {
      id: userId,
      email: (t.profile.email as string | null) ?? null,
      fullName: (t.profile.full_name as string | null) ?? null,
    },
    { offerShown: false, locale: 'es', surface: 'admin_people', buttonLabel: 'Sí, cancelar' },
  );
  if (!r.ok) return { ok: false, code: r.code === 'MP_ERROR' ? 'MP_ERROR' : 'NOT_ALLOWED' };
  await audit(
    actor,
    'admin.cancel',
    { id: userId, email: t.profile.email as string },
    { metadata: { folio: r.folio } },
  );
  return { ok: true };
}
