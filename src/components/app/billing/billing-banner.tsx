// The single top banner (SCR-17). Server-rendered from the billing state;
// a closable one is wrapped so "close" lasts for the browser session.

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Info, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { loadBilling } from '@/lib/billing/subscription-store';
import { selectBanner } from '@/lib/billing/banner';
import { priceIncreaseNoAnswer, trialDay6ReminderEnabled } from '@/lib/config/flags';
import { pendingIncrease, type PendingIncrease } from '@/lib/billing/price-change-server';
import { PLAN_NAMES } from '@/lib/billing/plan-names';
import { PriceChangeModal, type PriceChangeView } from './price-change-modal';
import { formatFechaCorta, formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { lealtadSchedule, planPrice } from '@/config/pricing';
import { recordConsent, UI_VERSION } from '@/lib/billing/consent';
import { Markup } from '@/components/ui/markup';
import { ClosableBanner } from './closable-banner';

export async function BillingBanner({ session }: { session: SessionUser }) {
  const billing = await loadBilling(session.user.id).catch(() => null);
  const renderNow = new Date().getTime();
  if (!billing) return null;
  // WS-6 · a pending price increase: the notice modal (mockup 89) on every
  // app page until it is answered.
  const increase = await pendingIncrease(session.user.id, billing.primaryRow).catch(() => null);
  const modal =
    increase && !increase.answer && renderNow >= increase.schedule.noticeAt.getTime() ? (
      <PriceChangeModal v={await priceChangeView(increase)} />
    ) : null;
  const banner = await renderBanner(session, billing, renderNow);
  return modal ? (
    <>
      {banner}
      {modal}
    </>
  ) : (
    banner
  );
}

async function priceChangeView(p: PendingIncrease): Promise<PriceChangeView> {
  const locale = await getLocale();
  const year = planPrice(p.increase.planKey).interval === 'year';
  return {
    plan: PLAN_NAMES[p.increase.planKey].split(' ')[0]!,
    oldPrice: formatMXN(p.increase.oldCents),
    newPrice: formatMXN(p.increase.newCents),
    pct: p.increase.pct,
    periodKey: year ? 'periodYear' : 'periodMonth',
    noticeDate: formatFechaLarga(p.schedule.noticeAt, locale),
    renewalDate: formatFechaLarga(p.schedule.renewalAt, locale),
    renewalShort: formatFechaCorta(p.schedule.renewalAt, locale),
    reminderDate: formatFechaLarga(p.schedule.reminderAt, locale),
    keepOld: priceIncreaseNoAnswer() === 'keep_old',
  };
}

async function renderBanner(
  session: SessionUser,
  billing: NonNullable<Awaited<ReturnType<typeof loadBilling>>>,
  renderNow: number,
) {
  const s = billing.primary;
  const choice = selectBanner(s, billing.trialUsed, renderNow, {
    day6Enabled: trialDay6ReminderEnabled(),
  });
  if (!choice) return null;

  const locale = await getLocale();
  const t = await getTranslations('banner');
  const tPlan = await getTranslations('myplan.planName');
  const monto = s.planKey ? formatMXN(planPrice(s.planKey).totalCents) : '';
  const date = (iso: string | null) => (iso ? formatFechaLarga(iso, locale) : '');
  const b = (c: string) => `<b>${c}</b>`;
  const text = (() => {
    switch (choice.kind) {
      case 'pastDue':
        return t.markup('pastDue', { fecha_gracia: date(s.graceEndsAt), b });
      case 'noticeHold':
        return t.markup('noticeHold', { correo: session.user.email ?? '', b });
      case 'trialTomorrow':
        return t.markup('trialTomorrow', { fecha_cobro: date(s.nextChargeAt), monto, b });
      case 'trial':
        return t.markup('trial', {
          fecha_cobro: date(s.nextChargeAt),
          monto,
          plan: s.planKey && planPrice(s.planKey).tier === 'VIP' ? 'VIP' : 'Pro',
          b,
        });
      case 'renew':
        if (s.planKey === 'pro_lealtad') {
          // Mockup 87: that month's amount, step and %.
          const step = (billing.primaryRow?.loyalty_step as number | undefined) ?? 0;
          const sched = lealtadSchedule()[Math.min(step, 6)]!;
          return t.markup('lealtad', {
            fecha_cobro: date(s.nextChargeAt),
            monto: formatMXN(sched.cents),
            n: step + 1,
            pct: sched.pct,
            b,
          });
        }
        return t.markup('renew', {
          plan: s.planKey ? tPlan(s.planKey) : '',
          fecha_cobro: date(s.nextChargeAt),
          monto,
          b,
        });
      case 'ended':
        return t('ended');
    }
  })();

  // The in-app copy of a mandatory notice IS an effective notice (the
  // bounce rule's alternate channel): record it once per charge.
  if (choice.mandatoryNotice && !s.reminderDeliveredAt && billing.primaryRow) {
    void markInAppNotice(session, billing.primaryRow.mp_preapproval_id as string, text);
  }

  const href =
    choice.cta === 'return'
      ? '/app/planes'
      : choice.cta === 'card'
        ? '/app/billing/tarjeta'
        : choice.cta === 'email'
          ? '/app/settings'
          : '/app/billing';
  const content = (
    <div
      className={`ch-bnr ch-bnr--${choice.tone}`}
      role={choice.tone === 'bad' ? 'alert' : 'status'}
    >
      <span className="ch-bnr__ic" aria-hidden="true">
        {choice.tone === 'trial' ? <Info /> : <TriangleAlert />}
      </span>
      <span className="ch-bnr__tx">
        <Markup text={text} />
      </span>
      <Link href={href as Route} className="ch-btn ch-btn--white ch-btn--compact">
        {t(`cta.${choice.cta}`)}
      </Link>
    </div>
  );
  return choice.closable ? (
    <ClosableBanner id={`${choice.kind}`}>{content}</ClosableBanner>
  ) : (
    content
  );
}

async function markInAppNotice(session: SessionUser, preapprovalId: string, text: string) {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data } = await admin
      .from('subscriptions')
      .update({ reminder_delivered_at: now })
      .eq('mp_preapproval_id', preapprovalId)
      .is('reminder_delivered_at', null)
      .select('id');
    if (!data?.length) return; // someone else recorded it first
    await recordConsent({
      event_type: 'charge_notice_sent',
      user_id: session.user.id,
      account_email: session.user.email ?? null,
      documents: [],
      client_timezone: null,
      ip_address: null,
      user_agent: null,
      locale: 'es-MX',
      surface: 'in_app_banner',
      ui_version: UI_VERSION,
      disclosure_text: text.replace(/<\/?b>/g, ''),
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
      details: { channel: 'in_app', mp_preapproval_id: preapprovalId },
    });
  } catch (err) {
    console.error('[banner] in-app notice not recorded', err);
  }
}
