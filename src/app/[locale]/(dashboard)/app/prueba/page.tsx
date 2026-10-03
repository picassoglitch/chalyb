import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireTrialFlow } from '@/lib/billing/trial-gate';
import { loadBilling } from '@/lib/billing/subscription-store';
import { billingToggleEnabled } from '@/lib/config/settings';
import { allToolsClaimAllowed } from '@/lib/config/flags';
import { WizardShell } from '@/components/ui/wizard-shell';
import { TrialPicker } from '@/components/app/billing/trial-picker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.trial');
  return { title: t('metaTitle') };
}

// SCR-14 · Paso 2 · Tu prueba.

export default async function TuPruebaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const { locale } = await params;
  const { interval } = await searchParams;
  setRequestLocale(locale);
  const session = await requireTrialFlow(locale, '/app/prueba');
  const billing = await loadBilling(session.user.id);
  // Already on a paid plan or a trial: Mi plan is where changes happen.
  if (billing.primary.state !== 'free') return redirect({ href: '/app/billing', locale });
  const t = await getTranslations('checkout');

  return (
    <WizardShell
      slug="chalybclip"
      toolName={billing.trialUsed ? t('toolPaid') : t('tool')}
      step={2}
      stepLabel={t('step', { n: 2 })}
      backHref="/app"
      backLabel={t('back')}
      closeLabel={t('close')}
      narrow
    >
      <TrialPicker
        choiceEnabled={await billingToggleEnabled()}
        trialUsed={billing.trialUsed}
        cameFrom={interval === 'month' || interval === 'year' ? interval : null}
        allToolsClaim={allToolsClaimAllowed()}
      />
    </WizardShell>
  );
}
