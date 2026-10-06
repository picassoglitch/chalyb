import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireTool } from '@/lib/tools/access';
import { getInmuebles } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { PropertyWizard } from '@/components/app/tools/property-wizard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('homes');
  return { title: t('metaTitle') };
}

// Inmuebles (P3-12). The same gate as every tool: plan and hub mode.

export default async function InmueblesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireTool(locale, 'chalybrealtor', '/app/herramientas/inmuebles', getInmuebles);
  const tw = await getTranslations('wizard');
  return (
    <WizardShell slug="chalybrealtor" toolName="Inmuebles" backHref="/app/herramientas" backLabel={tw('back')} closeLabel={tw('close')} narrow>
      <PropertyWizard />
    </WizardShell>
  );
}
