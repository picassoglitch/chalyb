import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireTool } from '@/lib/tools/access';
import { getInversiones } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { createAdminClient } from '@/lib/supabase/admin';
import { RiskGate } from '@/components/app/tools/risk-gate';
import { InvestWizard } from '@/components/app/tools/invest-wizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invest');
  return { title: t('metaTitle') };
}

// Inversiones (P3-11). The same gate as every tool (plan, hub mode) plus
// the risk notice, which blocks the screen until it is accepted.

export default async function InversionesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter, riskPending } = await requireTool(locale, 'chalybtrade', '/app/herramientas/inversiones', getInversiones);
  const tw = await getTranslations('wizard');
  const [exchanges, rules, conn] = await Promise.all([
    adapter.exchanges(),
    adapter.rules(session.user.id),
    createAdminClient().from('exchange_connections').select('exchange').eq('user_id', session.user.id).limit(1).maybeSingle(),
  ]);
  return (
    <WizardShell slug="chalybtrade" toolName="Inversiones" backHref="/app/herramientas" backLabel={tw('back')} closeLabel={tw('close')} narrow>
      {riskPending && <RiskGate slug="chalybtrade" toolName="Inversiones" />}
      <InvestWizard exchanges={exchanges} connected={conn.data?.exchange ?? null} initialRules={rules} />
    </WizardShell>
  );
}
