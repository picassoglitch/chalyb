import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireSenalesReady } from '@/lib/tools/senales-access';
import { WizardShell } from '@/components/ui/wizard-shell';
import { CoinPicker } from '@/components/app/tools/coin-picker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('signals');
  return { title: t('metaTitle') };
}

// Señales · primera activación, paso 1 (SCR-20). The risk notice is
// accepted on /app/senales first (TOOLS-SPEC §5.1).

export default async function SenalesStep1({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter } = await requireSenalesReady(locale, '/app/senales/empezar');
  const tw = await getTranslations('wizard');
  const [coins, prefs] = await Promise.all([adapter.coins(), adapter.getPrefs(session.user.id)]);
  return (
    <WizardShell
      slug="chalybcrypto"
      toolName="Señales"
      step={1}
      stepLabel={tw('step', { n: 1 })}
      backHref="/app/senales"
      backLabel={tw('back')}
      closeLabel={tw('close')}
    >
      <CoinPicker coins={coins} initial={prefs?.coins ?? []} />
    </WizardShell>
  );
}
