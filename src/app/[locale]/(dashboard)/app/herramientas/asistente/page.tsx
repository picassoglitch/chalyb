import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireTool } from '@/lib/tools/access';
import { getAsistente } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { AssistantWizard } from '@/components/app/tools/assistant-wizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('assistant');
  return { title: t('metaTitle') };
}

// Asistente (P3-8). The same gate as every tool: plan and hub mode.

export default async function AsistentePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter } = await requireTool(locale, 'chalybbot', '/app/herramientas/asistente', getAsistente);
  const tw = await getTranslations('wizard');
  const [channels, initial] = await Promise.all([adapter.channels(), adapter.getConfig(session.user.id)]);
  return (
    <WizardShell slug="chalybbot" toolName="Asistente" backHref="/app/herramientas" backLabel={tw('back')} closeLabel={tw('close')} narrow>
      <AssistantWizard channels={channels} initial={initial} />
    </WizardShell>
  );
}
