import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireTrialFlow } from '@/lib/billing/trial-gate';
import { loadBilling } from '@/lib/billing/subscription-store';
import { trialPlanChoiceEnabled } from '@/lib/config/flags';
import { WizardShell } from '@/components/ui/wizard-shell';
import { TrialPicker } from '@/components/app/billing/trial-picker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.trial');
  return { title: t('metaTitle') };
}

// SCR-14 · Paso 2 · Tu prueba.

export default async function TuPruebaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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
      <TrialPicker choiceEnabled={trialPlanChoiceEnabled()} trialUsed={billing.trialUsed} />
    </WizardShell>
  );
}
