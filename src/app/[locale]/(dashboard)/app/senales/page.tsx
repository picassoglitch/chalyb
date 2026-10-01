import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireTool } from '@/lib/tools/access';
import { getSenales } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { RiskGate } from '@/components/app/tools/risk-gate';
import { CoinPicker } from '@/components/app/tools/coin-picker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signals');
  return { title: t('metaTitle') };
}

// Señales · paso 1 (SCR-20). The risk notice comes first (P3-4).

export default async function SenalesStep1({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter, riskPending } = await requireTool(locale, 'chalybcrypto', '/app/senales', getSenales);
  const tw = await getTranslations('wizard');
  const [coins, prefs] = await Promise.all([adapter.coins(), adapter.getPrefs(session.user.id)]);
  return (
    <WizardShell slug="chalybcrypto" toolName="Señales" step={1} stepLabel={tw('step', { n: 1 })} backHref="/app" backLabel={tw('home')} closeLabel={tw('close')}>
      {riskPending && <RiskGate slug="chalybcrypto" toolName="Señales" />}
      <CoinPicker coins={coins} initial={prefs?.coins ?? []} />
    </WizardShell>
  );
}
