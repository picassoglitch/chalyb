import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getPublicKey, mpPayerEmail } from '@/lib/payments/mercadopago';
import { stripeForm } from '@/lib/payments/checkout-ready';
import { isStripeSubscriptionId } from '@/lib/payments/stripe-config';
import { loadBilling } from '@/lib/billing/subscription-store';
import { planPrice } from '@/config/pricing';
import { WizardShell } from '@/components/ui/wizard-shell';
import { PayForm } from '@/components/app/billing/pay-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myplan');
  return { title: t('methodChange') };
}

// "Cambiar tarjeta" / "Actualizar tarjeta": swaps the card on the live
// subscription. No amount or date changes, so no recurring-charge checkbox.

export default async function TarjetaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/billing', locale });
  const billing = await loadBilling(session.user.id);
  const s = billing.primary;
  if (!['trialing', 'pro', 'past_due'].includes(s.state)) return redirect({ href: '/app/billing', locale });
  const t = await getTranslations('myplan');
  const tc = await getTranslations('checkout');
  // The card goes to the gateway that charges this subscription, whatever sells new ones today.
  const onStripe = isStripeSubscriptionId(billing.primaryRow?.mp_preapproval_id as string | undefined);
  const stripe = onStripe ? stripeForm(0, true) : undefined;
  const publicKey = onStripe ? (stripe ? '' : undefined) : getPublicKey();
  return (
    <WizardShell slug="chalybclip" toolName={tc('toolPaid')} backHref="/app/billing" backLabel={tc('back')} closeLabel={tc('close')} narrow>
      <div style={{ display: 'grid', gap: 22 }}>
        <h1 className="ch-h1" style={{ textAlign: 'center' }}>
          {s.state === 'past_due' ? t('updateCard') : t('methodChange')}
        </h1>
        {publicKey !== undefined && (
          <PayForm
            publicKey={publicKey}
            stripe={stripe}
            payerEmail={mpPayerEmail(session.user.email)}
            planKey={s.planKey ?? 'pro_month'}
            amountMajor={planPrice(s.planKey ?? 'pro_month').totalCents / 100}
            buttonLabel={s.state === 'past_due' ? t('updateCard') : t('methodChange')}
            endpoint="/api/billing/card"
            successHref="/app/billing"
            askWhere={false}
          />
        )}
      </div>
    </WizardShell>
  );
}
