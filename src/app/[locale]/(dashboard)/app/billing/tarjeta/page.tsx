import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { getPublicKey, mpPayerEmail } from '@/lib/payments/mercadopago';
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
  const publicKey = getPublicKey();
  return (
    <WizardShell slug="chalybclip" toolName={tc('toolPaid')} backHref="/app/billing" backLabel={tc('back')} closeLabel={tc('close')} narrow>
      <div style={{ display: 'grid', gap: 22 }}>
        <h1 className="ch-h1" style={{ textAlign: 'center' }}>
          {s.state === 'past_due' ? t('updateCard') : t('methodChange')}
        </h1>
        {publicKey && (
          <PayForm
            publicKey={publicKey}
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
