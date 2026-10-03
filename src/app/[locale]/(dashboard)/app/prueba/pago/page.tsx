import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Lock } from 'lucide-react';
import { redirect, Link } from '@/i18n/routing';
import type { Route } from 'next';
import { requirePaidCheckout } from '@/lib/billing/trial-gate';
import { trialFlowEnabled } from '@/lib/config/flags';
import { loadBilling } from '@/lib/billing/subscription-store';

import { getPublicKey, mpPayerEmail } from '@/lib/payments/mercadopago';
import { ivaPortion, planHasTrial, planPrice, type PlanKey } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { addInterval, trialDates } from '@/lib/billing/trial-dates';
import {
  consentSentence,
  paidConsentSentence,
  paidParagraphs,
  trialVars,
  type Translate,
} from '@/lib/billing/billing-copy';
import { billingToggleEnabled } from '@/lib/config/settings';
import { WizardShell } from '@/components/ui/wizard-shell';
import { Markup } from '@/components/ui/markup';
import { PayForm } from '@/components/app/billing/pay-form';
import { SellerSheet } from '@/components/app/billing/seller';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.pay');
  return { title: t('metaTitle') };
}

// SCR-15 · Paso 3 · Pago.

export default async function PagoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Paid path and trial path share this page; the trial only with its flag.
  const session = await requirePaidCheckout(locale, '/app/prueba');
  const billing = await loadBilling(session.user.id);
  if (billing.primary.state !== 'free') return redirect({ href: '/app/billing', locale });
  const { plan } = await searchParams;
  const monthlyOffered = await billingToggleEnabled();
  // Never a default plan here (C9): the plan comes from the picker.
  if (plan !== 'pro_year' && !(plan === 'pro_month' && monthlyOffered)) {
    return redirect({ href: '/app/prueba', locale });
  }
  const planKey: PlanKey = plan;
  // 7 days free on Pro mensual and Pro anual, once per account.
  const trial = trialFlowEnabled() && !billing.trialUsed && planHasTrial(planKey);

  const t = await getTranslations('checkout');
  const tbRaw = await getTranslations('billing');
  const tb: Translate = (key, values) =>
    tbRaw.markup(
      key as never,
      {
        ...(values ?? {}),
        b: (c: string) => `<b>${c}</b>`,
        terms: (c: string) => `<terms>${c}</terms>`,
      } as never,
    );
  const price = planPrice(planKey);
  const dates = trialDates(new Date());
  const vars = trialVars(tb, { planKey, dates, cardLast4: null, locale });
  // Paid (trial used, or the trial flow off): Law's paid charge block and
  // checkbox; the server renders the same text as evidence.
  const paidInput = {
    planKey,
    renewalAt: addInterval(new Date(), price.interval),
    cardLast4: null,
    locale,
  };
  const consentText = trial
    ? consentSentence(tb, { planKey, dates, cardLast4: null, locale })
    : paidConsentSentence(tb, paidInput);
  const paidBlock = trial ? [] : paidParagraphs(tb, paidInput);
  const other: PlanKey = planKey === 'pro_year' ? 'pro_month' : 'pro_year';
  const publicKey = getPublicKey();

  return (
    <WizardShell
      slug="chalybclip"
      toolName={trial ? t('tool') : t('toolPaid')}
      step={3}
      stepLabel={t('step', { n: 3 })}
      backHref="/app/prueba"
      backLabel={t('back')}
      closeLabel={t('close')}
    >
      <div style={{ display: 'grid', gap: 22 }}>
        <header style={{ textAlign: 'center', display: 'grid', gap: 10 }}>
          <h1 className="ch-h1">{t('pay.title')}</h1>
          <p className="ch-sub">
            <Markup
              text={
                trial
                  ? t.markup('pay.oneLine', {
                      monto: vars.monto,
                      fecha_cobro: vars.fecha_cobro,
                      periodo: t(price.interval === 'year' ? 'pay.periodYear' : 'pay.periodMonth'),
                      b: (c) => `<b>${c}</b>`,
                    })
                  : t.markup('pay.oneLinePaid', {
                      monto: vars.monto,
                      cada_periodo: vars.cada_periodo,
                      b: (c) => `<b>${c}</b>`,
                    })
              }
            />
          </p>
        </header>

        <div className="ch-pay">
          <div style={{ display: 'grid', gap: 16 }}>
            {paidBlock.map((p, i) => (
              <p key={i} className="ch-disc">
                <Markup text={p} />
              </p>
            ))}
            {publicKey ? (
              <PayForm
                publicKey={publicKey}
                payerEmail={mpPayerEmail(session.user.email)}
                planKey={planKey}
                amountMajor={price.totalCents / 100}
                consentText={consentText}
                buttonLabel={trial ? t('pay.cta') : t('paid.cta')}
                endpoint="/api/billing/trial"
                successHref="/app/prueba/listo"
                askWhere
              />
            ) : (
              <p role="alert" className="ch-muted">
                {t('pay.unavailable')}
              </p>
            )}
            <p
              className="ch-muted"
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                fontSize: 16,
              }}
            >
              <Lock aria-hidden="true" width={18} height={18} />
              {t('pay.secure')} <SellerSheet label={t('pay.seller')} />
            </p>
          </div>

          <aside className="ch-card ch-summary" aria-labelledby="summary-title">
            <h2 id="summary-title" className="ch-h2">
              {t('summary.title')}
            </h2>
            <dl>
              {trial && (
                <>
                  <dt>{t('summary.planAfter')}</dt>
                  <dd>{planKey === 'pro_year' ? t('trial.year') : t('trial.month')}</dd>
                  <dt>{t('summary.trialEnds')}</dt>
                  <dd>{formatFechaLarga(dates.trialEndsAt, locale)}</dd>
                  <dt>{t('summary.remind')}</dt>
                  <dd>{formatFechaLarga(dates.reminderAt, locale)}</dd>
                  <dt>{t('summary.first')}</dt>
                  <dd>{t('summary.firstValue', { monto: vars.monto, fecha: vars.fecha_cobro })}</dd>
                </>
              )}
              <dt>{t('summary.after')}</dt>
              <dd>
                {t('summary.afterValue', { monto: vars.monto, cada_periodo: vars.cada_periodo })}
              </dd>
              <dt>{t('summary.ivaLabel')}</dt>
              <dd>{formatMXN(ivaPortion(price.totalCents))}</dd>
              <dt>
                <b>{t('summary.totalToday')}</b>
              </dt>
              <dd>{trial ? '$0' : `${vars.monto} MXN`}</dd>
            </dl>
            {monthlyOffered && (
              <Link href={`/app/prueba/pago?plan=${other}` as Route} className="ch-lnk">
                {other === 'pro_month'
                  ? t('summary.switchMonth', {
                      monto: formatMXN(planPrice('pro_month').totalCents),
                    })
                  : t('summary.switchYear', { monto: formatMXN(planPrice('pro_year').totalCents) })}
              </Link>
            )}
          </aside>
        </div>
      </div>
    </WizardShell>
  );
}
