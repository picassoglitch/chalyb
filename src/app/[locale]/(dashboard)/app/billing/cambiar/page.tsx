import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { trialFlowEnabled } from '@/lib/config/flags';
import { getPublicKey } from '@/lib/payments/mercadopago';
import { planPrice, type PlanKey } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { quoteChange } from '@/lib/billing/billing-actions';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ButtonLink, DisclosureBlock } from '@/components/ui/primitives';
import { PayForm } from '@/components/app/billing/pay-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('change');
  return { title: t('metaTitle') };
}

// The confirm step of a plan change (P2-9): what happens and when is said
// BEFORE the card and the checkbox, including the VIP proration.

export default async function CambiarPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ plan?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/billing', locale });
  if (!trialFlowEnabled() || isAdminRole(session.role)) return redirect({ href: '/app/subscription', locale });
  const { plan } = await searchParams;
  const t = await getTranslations('change');
  const tCheckout = await getTranslations('checkout');
  const tb = await getTranslations('billing');
  const tPlan = await getTranslations('myplan.planName');
  const chrome = { slug: 'chalybclip', toolName: tCheckout('toolPaid'), backHref: '/app/billing', backLabel: tCheckout('back'), closeLabel: tCheckout('close'), narrow: true };

  if (plan === 'gratis') {
    return (
      <WizardShell {...chrome}>
        <div className="ch-center-col">
          <h1 className="ch-h1">{t('toFreeTitle')}</h1>
          <p className="ch-sub">{t('toFreeBody')}</p>
          <ButtonLink href="/app/billing" size="xl">
            {t('toFreeCta')}
          </ButtonLink>
        </div>
      </WizardShell>
    );
  }
  const to: PlanKey = plan === 'pro_month' || plan === 'vip_month' ? plan : 'pro_year';
  const quote = await quoteChange(session, to);
  // The free month is Anual-only: a trial can't turn into Mensual.
  if (quote.timing === 'trial_annual_only') {
    return (
      <WizardShell {...chrome}>
        <div className="ch-center-col">
          <h1 className="ch-h1">{t('trialAnnualOnlyTitle')}</h1>
          <p className="ch-sub">{t('trialAnnualOnlyBody')}</p>
          <ButtonLink href="/app/billing" size="xl">
            {t('trialAnnualOnlyCta')}
          </ButtonLink>
        </div>
      </WizardShell>
    );
  }
  const price = planPrice(to);
  const monto = formatMXN(price.totalCents);
  const fromName = quote.billing.primary.planKey ? tPlan(quote.billing.primary.planKey) : '';
  const effective = quote.effectiveAt ? formatFechaLarga(quote.effectiveAt, locale) : formatFechaLarga(new Date(), locale);
  const periodo = price.interval === 'year' ? tb('vars.cadaPeriodo.year') : tb('vars.cadaPeriodo.month');

  const what =
    quote.timing === 'now'
      ? quote.refundCents > 0
        ? t('whenNow', { monto, credito: formatMXN(quote.refundCents), mensual: monto })
        : t('whenNowNoRefund', { monto, mensual: monto })
      : quote.timing === 'trial_end'
        ? t('trialSwitch', { fecha: effective, monto, periodo })
        : quote.timing === 'reactivate' && !quote.effectiveAt
          ? t('whenNowNoRefund', { monto, mensual: monto })
          : t('whenLater', { fecha: effective, plan: fromName || tPlan(to) });

  const consentText = t.markup('consent', {
    monto,
    renovacion_corta: tb(price.interval === 'year' ? 'vars.renovacionCorta.year' : 'vars.renovacionCorta.month'),
    fecha: effective,
    b: (c) => `<b>${c}</b>`,
    terms: (c) => `<terms>${c}</terms>`,
  });
  const publicKey = getPublicKey();

  return (
    <WizardShell {...chrome}>
      <div style={{ display: 'grid', gap: 22 }}>
        <h1 className="ch-h1" style={{ textAlign: 'center' }}>
          {t('title', { plan: tPlan(to) })}
        </h1>
        <DisclosureBlock>
          <p>{what}</p>
          <p className="ch-muted" style={{ marginTop: 8 }}>
            {t('card')}
          </p>
        </DisclosureBlock>
        {publicKey && (
          <PayForm
            publicKey={publicKey}
            payerEmail={session.user.email ?? null}
            planKey={to}
            amountMajor={price.totalCents / 100}
            consentText={consentText}
            buttonLabel={t('cta')}
            endpoint="/api/billing/change"
            successHref="/app/billing"
            askWhere={false}
          />
        )}
        <p className="ch-muted" style={{ textAlign: 'center', fontSize: 16 }}>
          {tb('price.tax')}
        </p>
      </div>
    </WizardShell>
  );
}
