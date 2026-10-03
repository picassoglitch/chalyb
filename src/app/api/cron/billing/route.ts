// GET /api/cron/billing — daily at 09:00 Mexico City (vercel.json "crons";
// Vercel Hobby allows daily jobs only — hourly once on Pro, OPS-7). Requires
// `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise (rebuild P2-8).
//
// Every run is idempotent. It:
//   1. sends the notices that are due (trial −5 days, renewals −7, annual −30)
//      — email_dispatches' unique key makes a second run send nothing;
//   2. enforces the bounce rule: no charge until 5 days after an effective
//      notice (pauses the preapproval, resumes it after);
//   3. moves profiles.tier when a scheduled plan change takes effect;
//   3b. ends Pro at the 7-day trial's deadline when its annual charge never
//      landed (PRICING.trial.firstChargeGraceDays after the charge date);
//   4. re-reads stale subscriptions from Mercado Pago (the webhook keeps them
//      current in between).
// Grace and cancelled periods lapse on their own: the session reads
// profiles.tier_ends_at.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago, getAppUrl } from '@/lib/payments/mercadopago';
import { syncSubscription } from '@/lib/payments/subscription-sync';
import { notify } from '@/lib/notifications/notify';
import {
  deriveBillingState,
  unpaidTrialDeadline,
  type SubscriptionRow,
} from '@/lib/billing/billing-state';
import { dueNotices, holdDecision, type NoticeKind } from '@/lib/billing/reminders';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { inAppBillingNotice } from '@/lib/notifications/core';
import { dispatchBillingEmail } from '@/lib/billing/notices';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { trialDay29ReminderEnabled } from '@/lib/config/flags';
import { planPrice, type PlanKey } from '@/config/pricing';
import type { BillingEmailKind } from '@/lib/email/billing-templates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;
const NAMES: Record<PlanKey, string> = {
  pro_year: 'Pro anual',
  pro_month: 'Pro mensual',
  vip_month: 'VIP',
};
const EMAIL_FOR: Partial<Record<NoticeKind, BillingEmailKind>> = {
  trial_7d: 'trial_7d',
  renew_7d: 'renew_7d',
  renew_30d: 'renew_30d',
  annual_summary: 'annual_summary',
  // trial_1d (D5) ships off; it needs its own template before it can be enabled.
};
const EVIDENCE = {
  trial_7d: 'charge_notice_sent',
  trial_1d: 'charge_notice_sent',
  renew_7d: 'renewal_notice_sent',
  renew_30d: 'renewal_notice_sent',
  annual_summary: 'annual_reminder_sent',
} as const;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();
  const stats = {
    notices: 0,
    holds: 0,
    resumes: 0,
    tierMoves: 0,
    unpaidTrials: 0,
    synced: 0,
    errors: 0,
  };

  const { data: rows } = await admin
    .from('subscriptions')
    .select(
      'id, user_id, status, tier, plan_key, started_at, trial_ends_at, next_charge_at, next_payment_date, grace_ends_at, access_until, card_brand, card_last4, card_exp, cancel_at_period_end, pending_plan_key, pending_effective_at, reminder_due_at, reminder_delivered_at, charge_hold_until, last_charge_at, mp_preapproval_id, updated_at',
    )
    .in('status', ['authorized', 'paused'])
    .limit(1000);

  for (const row of (rows ?? []) as (SubscriptionRow & Record<string, unknown>)[]) {
    const userId = row.user_id as string;
    const preapprovalId = row.mp_preapproval_id as string;
    try {
      const state = deriveBillingState(row, now.getTime());
      const planKey =
        (row.plan_key as PlanKey | null) ?? (row.tier === 'VIP' ? 'vip_month' : 'pro_month');
      const price = planPrice(planKey);
      const nextChargeAt = row.next_charge_at ?? row.next_payment_date;

      // 1. Notices.
      const due = dueNotices(
        {
          state: state.state,
          interval: price.interval,
          nextChargeAt,
          startedAt: (row.started_at as string | null) ?? null,
          day29Enabled: trialDay29ReminderEnabled(),
          trialReminderDueAt: (row.reminder_due_at as string | null) ?? null,
        },
        now,
      );
      if (due.length > 0) {
        const { data: profile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', userId)
          .maybeSingle();
        const email = profile?.email as string | null;
        for (const notice of due) {
          const kind = EMAIL_FOR[notice.kind];
          if (!email || !kind) continue;
          const sent = await dispatchBillingEmail({
            userId,
            email,
            kind,
            periodKey: notice.periodKey,
            evidence: EVIDENCE[notice.kind],
            vars: {
              nombre: ((profile?.full_name as string | null) ?? '').split(' ')[0] ?? '',
              plan: NAMES[planKey],
              monto: formatMXN(price.totalCents),
              periodicidad:
                price.interval === 'year' ? 'por 1 año de Pro' : 'por tu primer mes de Pro',
              fecha_fin_prueba: row.trial_ends_at
                ? formatFechaLarga(row.trial_ends_at, 'es')
                : undefined,
              fecha_cobro: nextChargeAt ? formatFechaLarga(nextChargeAt, 'es') : undefined,
              ultimos4: row.card_last4 ?? undefined,
              appUrl: getAppUrl(),
            },
          });
          if (sent.sent) stats.notices += 1;
          // The same notice in Avisos; it can't be deleted before the charge.
          const inApp = inAppBillingNotice(notice.kind, {
            nextChargeAt,
            fechaCobro: nextChargeAt ? formatFechaLarga(nextChargeAt, 'es') : '',
            monto: formatMXN(price.totalCents),
            periodKey: notice.periodKey,
          });
          if (inApp)
            await addUserNotice({
              userId,
              kind: inApp.kind,
              ...(await noticeText(inApp.kind, inApp.vars)),
              href: inApp.href,
              dedupeKey: inApp.dedupeKey,
              keepUntil: inApp.keepUntil,
            });
        }
      }

      // 2. Bounce hold.
      const decision = holdDecision({
        nextChargeAt,
        noticeDeliveredAt: row.reminder_delivered_at,
        holdUntil: (row.charge_hold_until as string | null) ?? null,
        now,
      });
      if (decision.action === 'hold') {
        if (!row.charge_hold_until) {
          await getMercadoPago().preapproval.update({
            id: preapprovalId,
            body: { status: 'paused' },
          });
          await notify({
            severity: 'warning',
            title: 'Cobro detenido: el aviso previo no se entregó',
            body: `Suscripción ${preapprovalId} · no se cobra hasta el ${formatFechaLarga(decision.until, 'es')}`,
            href: '/dashboard/dinero',
            source: 'billing.cron',
          });
          stats.holds += 1;
        }
        await admin
          .from('subscriptions')
          .update({ charge_hold_until: decision.until.toISOString() })
          .eq('mp_preapproval_id', preapprovalId);
      } else if (decision.action === 'resume') {
        // TODO(OPS-14): confirm Mercado Pago's behaviour when a preapproval is
        // resumed after its next_payment_date has passed.
        await getMercadoPago().preapproval.update({
          id: preapprovalId,
          body: { status: 'authorized' },
        });
        await admin
          .from('subscriptions')
          .update({ charge_hold_until: null })
          .eq('mp_preapproval_id', preapprovalId);
        stats.resumes += 1;
      }

      // 3. A scheduled change takes effect: the profile follows this row once
      // nothing higher still grants access.
      if (state.state === 'pro' || state.state === 'trialing') {
        const { data: higher } = await admin
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .neq('mp_preapproval_id', preapprovalId)
          .eq('status', 'cancelled')
          .gt('access_until', now.toISOString())
          .limit(1)
          .maybeSingle();
        if (!higher) {
          const { data: moved } = await admin
            .from('profiles')
            .update({ tier: row.tier, tier_ends_at: null })
            .eq('id', userId)
            .neq('tier', row.tier)
            .select('id');
          if (moved?.length) stats.tierMoves += 1;
        }
      }

      // 3b. The 7-day trial ended and its annual charge hasn't landed: give
      // the profile the deadline as its end (the session lapses it then).
      // Doesn't wait on Mercado Pago: a missing webhook or endless retries
      // can't keep Pro on. The charge landing clears it (sync re-activates).
      const unpaidUntil = unpaidTrialDeadline(row);
      if (unpaidUntil && row.trial_ends_at && now.getTime() >= Date.parse(row.trial_ends_at)) {
        const { data: ended } = await admin
          .from('profiles')
          .update({ tier_ends_at: unpaidUntil })
          .eq('id', userId)
          .eq('tier', row.tier)
          .is('tier_ends_at', null)
          .select('id');
        if (ended?.length) {
          stats.unpaidTrials += 1;
          await notify({
            severity: 'warning',
            title: 'Prueba terminada sin cobro anual',
            body: `Suscripción ${preapprovalId} · Pro hasta el ${formatFechaLarga(unpaidUntil, 'es')} si no entra el cobro`,
            href: '/dashboard/dinero',
            source: 'billing.cron',
          });
        }
      }

      // 4. Hourly reconcile with Mercado Pago.
      if (Date.parse(row.updated_at as string) < now.getTime() - HOUR) {
        await syncSubscription(preapprovalId);
        stats.synced += 1;
      }
    } catch (err) {
      stats.errors += 1;
      console.error('[cron/billing] subscription failed', preapprovalId, err);
    }
  }

  console.info('[cron/billing]', stats);
  return NextResponse.json({ ok: true, ...stats });
}
