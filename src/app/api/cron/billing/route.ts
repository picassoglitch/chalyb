// GET /api/cron/billing — daily at 09:00 Mexico City (vercel.json "crons";
// Vercel Hobby allows daily jobs only — hourly once on Pro, OPS-7). Requires
// `Authorization: Bearer ${CRON_SECRET}`; 401 otherwise (rebuild P2-8).
//
// Every run is idempotent. It:
//   1. sends the notices that are due (the trial's charge notice if the
//      day-0 send didn't go out, day 6 with TRIAL_DAY6_REMINDER, renewals
//      −7, annual −30)
//      — email_dispatches' unique key makes a second run send nothing;
//   2. enforces the bounce rule: no charge until 5 days after an effective
//      notice (pauses the preapproval and resumes it after; during a trial
//      only once MP_PAUSE_IN_TRIAL_VERIFIED, else an admin attention item);
//   3. moves profiles.tier when a scheduled plan change takes effect;
//   3b. ends Pro at the deadline of a charge that never landed: the trial's
//      annual charge (no grace) or a renewal (PRICING.graceDays);
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
  unpaidCharge,
  type SubscriptionRow,
} from '@/lib/billing/billing-state';
import { dueNotices, holdDecision, noticeEmailKind, type NoticeKind } from '@/lib/billing/reminders';
import { addUserNotice, noticeText } from '@/lib/notifications/user';
import { inAppBillingNotice } from '@/lib/notifications/core';
import {
  dispatchBillingEmail,
  lealtadFailedVars,
  lealtadNoticeVars,
  trialNoticeVars,
} from '@/lib/billing/notices';
import { reconcileLealtad } from '@/lib/billing/lealtad-server';
import { sweepChargebacks } from '@/lib/billing/disputes-server';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import {
  mpPauseInTrialVerified,
  priceIncreaseNoAnswer,
  trialDay6ReminderEnabled,
} from '@/lib/config/flags';
import { nextChargeCents, planPrice, type PlanKey } from '@/config/pricing';
import type { BillingEmailKind } from '@/lib/email/billing-templates';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import { nextStep } from '@/lib/billing/price-change';
import {
  endAtPeriod,
  pendingIncrease,
  recordNotice,
  renewalDay,
  shownText,
} from '@/lib/billing/price-change-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const HOUR = 60 * 60 * 1000;
const EMAIL_FOR: Record<NoticeKind, BillingEmailKind> = {
  trial_7d: 'trial_7d',
  trial_1d: 'trial_1d',
  renew_7d: 'renew_7d',
  renew_30d: 'renew_30d',
  annual_summary: 'annual_summary',
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
    unpaidCharges: 0,
    synced: 0,
    priceChanges: 0,
    errors: 0,
  };

  const { data: rows } = await admin
    .from('subscriptions')
    .select(
      'id, user_id, status, tier, plan_key, amount_cents, loyalty_step, loyalty_mp_amount_cents, started_at, trial_ends_at, next_charge_at, next_payment_date, grace_ends_at, access_until, card_brand, card_last4, card_exp, cancel_at_period_end, pending_plan_key, pending_effective_at, reminder_due_at, reminder_delivered_at, charge_hold_until, last_charge_at, mp_preapproval_id, consent_id, updated_at',
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
          day6Enabled: trialDay6ReminderEnabled(),
          subKey: preapprovalId,
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
          const lealtad = planKey === 'pro_lealtad';
          // Pro Lealtad: the notice before every charge carries that month's
          // amount and step (Términos 4 bis.6).
          const emailKind = noticeEmailKind(notice.kind, planKey);
          const kind: BillingEmailKind =
            emailKind === 'lealtad_7d' ? 'lealtad_7d' : EMAIL_FOR[emailKind];
          if (!email) continue;
          const nombre = ((profile?.full_name as string | null) ?? '').split(' ')[0] ?? '';
          const trialNotice = notice.kind === 'trial_7d' || notice.kind === 'trial_1d';
          const sent = await dispatchBillingEmail({
            userId,
            email,
            kind,
            periodKey: notice.periodKey,
            evidence: EVIDENCE[notice.kind],
            vars:
              lealtad && kind === 'lealtad_7d' && nextChargeAt
                ? lealtadNoticeVars({
                    nombre,
                    step: (row.loyalty_step as number | null) ?? 0,
                    chargeAt: nextChargeAt,
                    last4: row.card_last4 ?? null,
                    appUrl: getAppUrl(),
                  })
                : trialNotice && nextChargeAt && row.trial_ends_at
                  ? trialNoticeVars({
                      nombre,
                      planKey,
                      startedAt: (row.started_at as string | null) ?? now,
                      trialEndsAt: row.trial_ends_at,
                      chargeAt: nextChargeAt,
                      last4: row.card_last4 ?? null,
                      consentId: (row.consent_id as string | null) ?? null,
                      appUrl: getAppUrl(),
                      now,
                    })
                  : {
                      nombre,
                      plan: PLAN_NAMES[planKey],
                      monto: formatMXN(nextChargeCents({ ...row, plan_key: planKey })),
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
            monto: formatMXN(nextChargeCents({ ...row, plan_key: planKey })),
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

      // 1b. Price increase (WS-6, behind PRICE_INCREASE_NOTICES_ENABLED):
      // the notice exactly 30 days before, the reminder at 7, and an
      // unanswered one settled the day before the renewal.
      const pc = await pendingIncrease(userId, row, now);
      if (pc) {
        const step = nextStep({
          now,
          schedule: pc.schedule,
          noticeSent: pc.noticeSent,
          reminderSent: pc.reminderSent,
          answer: pc.answer,
          noAnswer: priceIncreaseNoAnswer(),
        });
        if (step.kind === 'notice' || step.kind === 'reminder') {
          const { data: profile } = await admin
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle();
          const email = profile?.email as string | null;
          const per = planPrice(pc.increase.planKey).interval === 'year' ? 'año' : 'mes';
          const plan = PLAN_NAMES[pc.increase.planKey].split(' ')[0]!;
          const fecha = formatFechaLarga(pc.schedule.renewalAt, 'es');
          if (email) {
            const sent = await dispatchBillingEmail({
              userId,
              email,
              kind: step.kind === 'notice' ? 'price_change' : 'price_change_7d',
              periodKey: `price:${renewalDay(pc.schedule.renewalAt)}:${preapprovalId}`,
              vars: {
                nombre: ((profile?.full_name as string | null) ?? '').split(' ')[0] ?? '',
                plan,
                monto: formatMXN(pc.increase.newCents),
                precio_anterior: formatMXN(pc.increase.oldCents),
                precio_nuevo: formatMXN(pc.increase.newCents),
                porcentaje: pc.increase.pct,
                periodo: per,
                fecha_aplicacion: fecha,
                fecha_fin_periodo: fecha,
                keep_old: priceIncreaseNoAnswer() === 'keep_old',
                appUrl: getAppUrl(),
              },
            });
            if (sent.sent) {
              await recordNotice(pc, userId, email, step.kind, shownText(pc));
              stats.priceChanges += 1;
            }
          }
        } else if (step.kind === 'end_at_period' && !pc.answer) {
          await endAtPeriod(pc, userId, 'price_change_no_answer', 'Sin respuesta');
          stats.priceChanges += 1;
        }
      }

      // 1d. Pro Lealtad, payment failed: the second warning on day 5 of the
      // 7-day grace (the first went out on day 0 from the webhook).
      if (planKey === 'pro_lealtad' && state.state === 'past_due' && row.grace_ends_at) {
        const graceEnd = Date.parse(row.grace_ends_at);
        if (now.getTime() >= graceEnd - 2 * 86_400_000 && now.getTime() < graceEnd) {
          const { data: profile } = await admin
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .maybeSingle();
          if (profile?.email) {
            await dispatchBillingEmail({
              userId,
              email: profile.email as string,
              kind: 'lealtad_failed',
              periodKey: `grace:${row.grace_ends_at.slice(0, 10)}:${preapprovalId}:d5`,
              evidence: 'charge_failed',
              vars: lealtadFailedVars({
                nombre: ((profile.full_name as string | null) ?? '').split(' ')[0] ?? '',
                step: (row.loyalty_step as number | null) ?? 0,
                chargedAt: nextChargeAt ?? now,
                graceEndsAt: row.grace_ends_at,
                appUrl: getAppUrl(),
              }),
            });
          }
        }
      }

      // 1c. Pro Lealtad: MP must be set to the next step's amount.
      await reconcileLealtad(row, now).catch((err) =>
        console.error('[cron/billing] Pro Lealtad reconcile failed', preapprovalId, err),
      );

      // 2. Bounce hold.
      const decision = holdDecision({
        nextChargeAt,
        noticeDeliveredAt: row.reminder_delivered_at,
        holdUntil: (row.charge_hold_until as string | null) ?? null,
        now,
      });
      // During a trial, pausing the preapproval is unverified at MP (OPS-14):
      // it might charge on resume. Until MP_PAUSE_IN_TRIAL_VERIFIED, record
      // the hold and hand it to a person. Recreating the preapproval with a
      // later start_date needs a new card token, i.e. the customer (O-16).
      const touchMp = state.state !== 'trialing' || mpPauseInTrialVerified();
      if (decision.action === 'hold') {
        if (!row.charge_hold_until) {
          if (touchMp) {
            await getMercadoPago().preapproval.update({
              id: preapprovalId,
              body: { status: 'paused' },
            });
          }
          await notify({
            severity: 'warning',
            title: touchMp
              ? 'Cobro detenido: el aviso previo no se entregó'
              : 'Atención: detener a mano el primer cobro de una prueba (aviso no entregado)',
            body: touchMp
              ? `Suscripción ${preapprovalId} · no se cobra hasta el ${formatFechaLarga(decision.until, 'es')}`
              : `Suscripción ${preapprovalId} · el aviso de cobro no consta como entregado. No debe cobrarse antes del ${formatFechaLarga(decision.until, 'es')}: cancela y vuelve a crear la suscripción con esa fecha, o reembolsa el cobro (Términos de Suscripción §7.2(b)). TODO(owner O-16)`,
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
        if (row.status === 'paused') {
          await getMercadoPago().preapproval.update({
            id: preapprovalId,
            body: { status: 'authorized' },
          });
        }
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

      // 3b. A charge is due and hasn't landed — the trial's annual charge or
      // a renewal: give the profile the deadline as its end (the session
      // lapses it then). Doesn't wait on Mercado Pago: a missing webhook or
      // endless retries can't keep Pro on. The charge landing clears it
      // (the sync re-activates on the new last_charge_at).
      let syncedNow = false;
      let unpaid = unpaidCharge(row);
      const inTrialNow = !!row.trial_ends_at && now.getTime() < Date.parse(row.trial_ends_at);
      if (unpaid && !inTrialNow && now.getTime() >= Date.parse(unpaid.dueAt)) {
        // Our copy may be behind: re-read Mercado Pago first (it backfills a
        // charge whose webhook we missed), then judge on the fresh row.
        await syncSubscription(preapprovalId);
        syncedNow = true;
        stats.synced += 1;
        const { data: fresh } = await admin
          .from('subscriptions')
          .select('last_charge_at')
          .eq('mp_preapproval_id', preapprovalId)
          .maybeSingle();
        unpaid = unpaidCharge({
          ...row,
          last_charge_at: (fresh?.last_charge_at as string | null) ?? row.last_charge_at ?? null,
        });
      }
      if (unpaid && !inTrialNow && now.getTime() >= Date.parse(unpaid.dueAt)) {
        const { data: ended } = await admin
          .from('profiles')
          .update({ tier_ends_at: unpaid.deadline })
          .eq('id', userId)
          .eq('tier', row.tier)
          .is('tier_ends_at', null)
          .select('id');
        if (ended?.length) {
          stats.unpaidCharges += 1;
          await notify({
            severity: 'warning',
            title: row.last_charge_at ? 'Renovación sin cobro' : 'Prueba terminada sin cobro anual',
            body: `Suscripción ${preapprovalId} · ${row.tier} hasta el ${formatFechaLarga(unpaid.deadline, 'es')} si no entra el cobro`,
            href: '/dashboard/dinero',
            source: 'billing.cron',
          });
        }
      }

      // 4. Hourly reconcile with Mercado Pago.
      if (!syncedNow && Date.parse(row.updated_at as string) < now.getTime() - HOUR) {
        await syncSubscription(preapprovalId);
        stats.synced += 1;
      }
    } catch (err) {
      stats.errors += 1;
      console.error('[cron/billing] subscription failed', preapprovalId, err);
    }
  }

  // 5. Chargebacks (WS-8): decide cases whose 10 business days ran out;
  // measures only with CHARGEBACK_MEASURES_ENABLED.
  await sweepChargebacks(now).catch((err) => {
    stats.errors += 1;
    console.error('[cron/billing] chargeback sweep failed', err);
  });

  console.info('[cron/billing]', stats);
  return NextResponse.json({ ok: true, ...stats });
}
