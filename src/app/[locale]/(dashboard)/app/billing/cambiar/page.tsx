import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { paidCheckoutEnabled, vipYearEnabled } from '@/lib/config/flags';
import { getPublicKey, mpPayerEmail } from '@/lib/payments/mercadopago';
import { planPrice, type PlanKey } from '@/config/pricing';
import { formatFechaLarga, formatMXN } from '@/lib/billing/format';
import { quoteChange } from '@/lib/billing/billing-actions';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ButtonLink, DisclosureBlock } from '@/components/ui/primitives';
import { PayForm } from '@/components/app/billing/pay-form';
import { Markup } from '@/components/ui/markup';
import { paidConsentSentence, paidParagraphs, type Translate } from '@/lib/billing/billing-copy';
import { addInterval } from '@/lib/billing/trial-dates';

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
  if (!paidCheckoutEnabled() || isAdminRole(session.role))
    return redirect({ href: '/app/subscription', locale });
  const { plan } = await searchParams;
  const t = await getTranslations('change');
  const tCheckout = await getTranslations('checkout');
  const tb = await getTranslations('billing');
  const tPlan = await getTranslations('myplan.planName');
  const chrome = {
    slug: 'chalybclip',
    toolName: tCheckout('toolPaid'),
    backHref: '/app/billing',
    backLabel: tCheckout('back'),
    closeLabel: tCheckout('close'),
    narrow: true,
  };

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
  const to: PlanKey =
    plan === 'pro_month' || plan === 'vip_month' || (plan === 'vip_year' && vipYearEnabled())
      ? plan
      : 'pro_year';
  const quote = await quoteChange(session, to);
  const price = planPrice(to);
  const monto = formatMXN(price.totalCents);
  const fromName = quote.billing.primary.planKey ? tPlan(quote.billing.primary.planKey) : '';
  const effective = quote.effectiveAt
    ? formatFechaLarga(quote.effectiveAt, locale)
    : formatFechaLarga(new Date(), locale);
  const periodo =
    price.interval === 'year' ? tb('vars.cadaPeriodo.year') : tb('vars.cadaPeriodo.month');

  // A change that charges today (an upgrade, monthly → annual, or buying a
  // plan from Gratis) shows Law's paid block and checkbox (VIP anual: Q4,
  // verbatim); a later change, its date; a trial switch, the trial's checkbox.
  const chargedToday =
    quote.timing === 'now' || (quote.timing === 'reactivate' && !quote.effectiveAt);
  const billingT: Translate = (key, values) =>
    tb.markup(
      key as never,
      {
        ...(values ?? {}),
        b: (c: string) => `<b>${c}</b>`,
        terms: (c: string) => `<terms>${c}</terms>`,
      } as never,
    );
  const paidInput = {
    planKey: to,
    renewalAt: addInterval(new Date(), price.interval),
    cardLast4: null,
    locale,
  };
  const paidBlock = chargedToday ? paidParagraphs(billingT, paidInput) : [];

  const what = chargedToday
    ? quote.refundCents > 0
      ? t('credit', { credito: formatMXN(quote.refundCents) })
      : null
    : quote.timing === 'trial_end'
      ? t('trialSwitch', { fecha: effective, monto, periodo })
      : t('whenLater', { fecha: effective, plan: fromName || tPlan(to) });

  // Switching during the trial is consent to the trial's charge with the new
  // amount: Law's trial checkbox, with the same charge date (T-6).
  const consentText =
    quote.timing === 'trial_end'
      ? tb.markup('pay.consent', {
          fecha_cobro: effective,
          monto,
          renovacion_corta: tb(
            price.interval === 'year' ? 'vars.renovacionCorta.year' : 'vars.renovacionCorta.month',
          ),
          b: (c) => `<b>${c}</b>`,
          terms: (c) => `<terms>${c}</terms>`,
        })
      : chargedToday
        ? paidConsentSentence(billingT, paidInput)
        : t.markup('consent', {
            monto,
            renovacion_corta: tb(
              price.interval === 'year'
                ? 'vars.renovacionCorta.year'
                : 'vars.renovacionCorta.month',
            ),
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
          {paidBlock.map((p, i) => (
            <p key={i}>
              <Markup text={p} />
            </p>
          ))}
          {what && <p>{what}</p>}
          <p className="ch-muted" style={{ marginTop: 8 }}>
            {t('card')}
          </p>
        </DisclosureBlock>
        {publicKey && (
          <PayForm
            publicKey={publicKey}
            payerEmail={mpPayerEmail(session.user.email)}
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
