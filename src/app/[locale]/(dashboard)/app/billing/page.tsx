// /app/billing — Mi plan (SCR-30 / SCR-18; BUILD-SPEC §6.10). One fixed
// structure for every state: the "Tu plan" card, Próximo cobro, Cambiar de
// plan, Facturas and the Cancelar row. Everything comes from the billing
// state and the payments ledger; nothing is sample data. No "MP #id", no
// route paths, no "tier".
//
// The history reads the same payments ledger (and the same settled-status
// rule) as the owner panel's Dinero, so the two can't disagree
// (docs/payments/money-truth.md).

import type { Metadata } from 'next';
import type { Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Coins, CreditCard, FileText } from 'lucide-react';
import { Link, redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getEntitlements } from '@/lib/billing/entitlement';
import { loadBilling } from '@/lib/billing/subscription-store';
import { loadPayments, paymentKind } from '@/lib/billing/payments-data';
import { trialDaysLeft } from '@/lib/billing/trial-dates';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { annualMath, planPrice, type PlanKey } from '@/config/pricing';
import { cfdiEnabled, trialFlowEnabled } from '@/lib/config/flags';
import { ButtonLink, Group, Row } from '@/components/ui/primitives';
import { CancelSheet } from '@/components/app/billing/cancel-sheet';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myplan');
  return { title: t('title') };
}

export default async function MiPlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/billing', locale });

  const t = await getTranslations('myplan');
  const tb = await getTranslations('billing');
  const tc = await getTranslations('cancel');
  const [entitlements, billing, payments] = await Promise.all([
    getEntitlements(session),
    loadBilling(session.user.id).catch(() => null),
    loadPayments({ userId: session.user.id, limit: 24, logTag: '/app/billing' }),
  ]);
  const s = billing?.primary ?? null;
  const renderNow = new Date().getTime();
  const date = (iso: string | null | undefined) => (iso ? formatFechaLarga(iso, locale) : '');
  const flow = trialFlowEnabled();
  // Plan changes create charges: they go through the new flow only when it
  // is live; otherwise the existing subscription page keeps handling them.
  const changeHref = (to: PlanKey) =>
    flow ? `/app/billing/cambiar?plan=${to}` : '/app/subscription';

  const planKey: PlanKey | null = s && s.state !== 'free' ? (s.planKey ?? 'pro_month') : null;
  const planName = planKey ? t(`planName.${planKey}`) : '';
  const price = planKey ? planPrice(planKey) : null;
  const monto = price ? formatMXN(price.totalCents) : '';
  const yearly = price?.interval === 'year';
  const math = annualMath();

  // ── "Tu plan" card ────────────────────────────────────────────────
  let status = t('status.free');
  let heading = t('heading.free');
  const lines: string[] = [];
  let cta: { href: string; label: string } | null = {
    href: flow ? '/app/planes' : '/app/subscription',
    label: t('freeCta'),
  };
  let tone: 'plan' | 'bad' = 'plan';

  if (entitlements.isAdmin) {
    status = t('status.active');
    heading = t('heading.vip_month');
    lines.push(t('adminNote'));
    cta = null;
  } else if (s?.state === 'trialing') {
    status = t('status.trial');
    heading = t('heading.trial');
    lines.push(
      t('trialLeft', {
        n: s.trialEndsAt ? trialDaysLeft(s.trialEndsAt, renderNow) : 0,
        fecha: date(s.trialEndsAt),
      }),
    );
    lines.push(
      t('trialAfter', {
        plan: planName,
        monto,
        periodo: yearly ? t('periodYear') : t('periodMonth'),
      }),
    );
    // An Anual trial can't turn into Mensual (the 7-day trial is Anual-only).
    cta = flow && !yearly ? { href: changeHref('pro_year'), label: t('changeCta') } : null;
  } else if (s?.state === 'pro') {
    status = t('status.active');
    heading = t(`heading.${planKey!}`);
    lines.push(
      `${yearly ? t('renewYear') : t('renewMonth')} ${t('nextCharge', { fecha: date(s.nextChargeAt) })}`,
    );
    lines.push(yearly ? t('priceYear', { monto }) : t('priceMonth', { monto }));
    cta = null;
  } else if (s?.state === 'cancelled_active') {
    status = t('status.cancelled');
    heading = t('cancelledUntil', { plan: planName, fecha: date(s.accessUntil) });
    lines.push(t('noMoreCharges'));
    cta = { href: changeHref(planKey!), label: t('reactivate', { plan: planName }) };
  } else if (s?.state === 'past_due') {
    status = t('status.pastDue');
    heading = t('pastDueAmount', { monto });
    lines.push(t('pastDueBody', { fecha: date(s.graceEndsAt), plan: planName }));
    cta = { href: '/app/billing/tarjeta', label: t('updateCard') };
    tone = 'bad';
  }

  // ── Cambiar de plan rows ─────────────────────────────────────────
  type ChangeRow = { to: PlanKey | 'gratis'; title: string; value: string; detail: string };
  const changes: ChangeRow[] = [];
  const short = (k: PlanKey) =>
    planPrice(k).interval === 'year'
      ? t('change.priceYearShort', { monto: formatMXN(planPrice(k).totalCents) })
      : t('change.priceMonthShort', { monto: formatMXN(planPrice(k).totalCents) });
  if (!entitlements.isAdmin && s && (s.state === 'pro' || s.state === 'past_due')) {
    if (planKey === 'pro_month') {
      changes.push({
        to: 'pro_year',
        title: t('change.toYear'),
        value: short('pro_year'),
        detail: t('change.toYearSub', { ahorro: formatMXN(math.yearSavingsCents) }),
      });
      changes.push({
        to: 'vip_month',
        title: t('change.toVip'),
        value: short('vip_month'),
        detail: t('change.toVipSub'),
      });
      changes.push({
        to: 'gratis',
        title: t('change.toFree'),
        value: '$0',
        detail: t('change.toFreeSubMonth'),
      });
    } else if (planKey === 'pro_year') {
      changes.push({
        to: 'pro_month',
        title: t('change.toMonth'),
        value: short('pro_month'),
        detail: t('change.toMonthSubYear'),
      });
      changes.push({
        to: 'vip_month',
        title: t('change.toVip'),
        value: short('vip_month'),
        detail: t('change.toVipSub'),
      });
      changes.push({
        to: 'gratis',
        title: t('change.toFree'),
        value: '$0',
        detail: t('change.toFreeSubYear'),
      });
    } else {
      changes.push({
        to: 'pro_month',
        title: t('change.downMonth'),
        value: short('pro_month'),
        detail: t('change.nextDate'),
      });
      changes.push({
        to: 'pro_year',
        title: t('change.downYear'),
        value: short('pro_year'),
        detail: t('change.nextDate'),
      });
      changes.push({
        to: 'gratis',
        title: t('change.toFree'),
        value: '$0',
        detail: t('change.toFreeSubMonth'),
      });
    }
  } else if (s?.state === 'trialing' && !yearly) {
    // Only toward Anual: the 7-day trial doesn't carry over to Mensual.
    changes.push({
      to: 'pro_year',
      title: t('change.trialSwitch', { plan: t('planName.pro_year') }),
      value: short('pro_year'),
      detail: '',
    });
  }

  // ── Movements ────────────────────────────────────────────────────
  const statusLabel = (st: string) =>
    ['approved', 'accredited', 'processed'].includes(st)
      ? t('movement.approved')
      : st === 'refunded' || st === 'charged_back'
        ? t('movement.refunded')
        : st === 'rejected' || st === 'cancelled'
          ? t('movement.rejected')
          : t('movement.pending');
  const movementName = (p: (typeof payments.rows)[number]) => {
    const kind = paymentKind(p);
    if (kind === 'pack') return t('movement.pack');
    const pk = (p as { plan_key?: string | null }).plan_key as PlanKey | null;
    if (pk) return t(`planName.${pk}`);
    return p.tier === 'VIP' ? 'VIP' : 'Pro';
  };

  const cancellable =
    !entitlements.isAdmin && s && ['trialing', 'pro', 'past_due'].includes(s.state);
  const accessEnd =
    s?.state === 'trialing'
      ? s.trialEndsAt
      : s?.state === 'past_due'
        ? s.graceEndsAt
        : s?.nextChargeAt;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 760 }}>
      <header>
        <Link href={'/app/settings' as Route} className="ch-muted" style={{ fontSize: 17 }}>
          {t('crumb')} ›
        </Link>
        <h1 className="ch-h1">{t('title')}</h1>
      </header>

      <section
        className="ch-plan"
        aria-labelledby="myplan-heading"
        style={
          tone === 'bad' ? { background: 'linear-gradient(135deg,#e5484d,#c41e2a)' } : undefined
        }
      >
        <p className="ch-plan__k">{status}</p>
        <h2 id="myplan-heading" className="ch-plan__h">
          {heading}
        </h2>
        {lines.map((l) => (
          <p
            key={l}
            style={{ fontSize: 18, opacity: 0.95, marginTop: 6, position: 'relative', zIndex: 1 }}
          >
            {l}
          </p>
        ))}
        {cta && (
          <div className="ch-plan__foot">
            <span />
            <ButtonLink href={cta.href} variant="white" size="compact">
              {cta.label}
            </ButtonLink>
          </div>
        )}
      </section>
      <p className="ch-muted" style={{ fontSize: 16, marginTop: -16 }}>
        {tb('price.tax')}
      </p>

      {s &&
        (s.state === 'trialing' || s.state === 'pro' || s.state === 'past_due') &&
        !entitlements.isAdmin && (
          <Group title={t('next.title')}>
            <Row
              icon={<CreditCard />}
              iconColor="#5B4BFF"
              title={s.state === 'past_due' ? t('pastDueAmount', { monto }) : date(s.nextChargeAt)}
              detail={
                s.state === 'past_due'
                  ? t('next.retry')
                  : s.state === 'trialing' && s.nextChargeAt
                    ? t('next.noticeOn', {
                        fecha: date(
                          new Date(Date.parse(s.nextChargeAt) - 7 * 86_400_000).toISOString(),
                        ),
                      })
                    : yearly
                      ? t('next.notice30')
                      : t('next.notice7')
              }
              value={`${monto} MXN`}
            />
            <Row
              icon={<CreditCard />}
              iconColor="#34C759"
              title={t('method')}
              detail={s.card?.exp ? t('methodSub', { exp: s.card.exp }) : undefined}
              value={
                s.card?.last4
                  ? `${(s.card.brand ?? '').toUpperCase()} ••${s.card.last4}`
                  : undefined
              }
              href="/app/billing/tarjeta"
            />
            {/* Q13: credit numbers stay hidden until PRICING.credits is set. */}
            <Row icon={<Coins />} iconColor="#FF9F0A" title={t('credits')} href="/app/usage" />
          </Group>
        )}

      {s?.state === 'cancelled_active' && (
        <p className="ch-card" style={{ padding: 20, fontSize: 17 }}>
          {t('next.afterCancel', { fecha: date(s.accessUntil) })}
        </p>
      )}

      {changes.length > 0 && (
        <Group title={t('change.title')}>
          {changes.map((c) => (
            <Row
              key={c.to}
              title={c.title}
              detail={c.detail || undefined}
              value={c.value}
              href={c.to === 'gratis' ? '/app/billing/cambiar?plan=gratis' : changeHref(c.to)}
            />
          ))}
        </Group>
      )}

      <Group title={t('invoices')}>
        {payments.failure ? (
          <Row title={t('loadError')} />
        ) : payments.rows.length === 0 ? (
          <Row icon={<FileText />} iconColor="#8E8E93" title={t('invoicesEmpty')} />
        ) : (
          payments.rows.map((p) => (
            <Row
              key={p.id}
              icon={<FileText />}
              iconColor="#8E8E93"
              title={t('invoiceRow', {
                fecha: date(p.created_at),
                plan: movementName(p),
                monto: `${formatMXN(p.amount_cents)}${cfdiEnabled() ? ' · CFDI' : ''}`,
              })}
              value={statusLabel(p.status)}
            />
          ))
        )}
      </Group>

      {cancellable && accessEnd && (
        <div className="ch-group">
          <CancelSheet
            trial={s!.state === 'trialing'}
            planName={planName}
            accessDate={date(accessEnd)}
            email={session.user.email ?? ''}
            reactivateHref={changeHref(planKey!)}
            offer={
              // No "switch to Mensual" during the 7-day trial: it's Anual-only.
              yearly && flow && s!.state !== 'trialing'
                ? {
                    href: changeHref('pro_month'),
                    label: tc('offerCta', { monto: formatMXN(planPrice('pro_month').totalCents) }),
                  }
                : null
            }
            triggerLabel={s!.state === 'trialing' ? t('cancelTrial') : t('cancelSub')}
            triggerSub={
              s!.state === 'trialing'
                ? t('cancelTrialSub')
                : t('cancelSubSub', { plan: planName, fecha: date(accessEnd) })
            }
          />
        </div>
      )}
    </div>
  );
}
