import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireTool } from '@/lib/tools/access';
import { getEnVivo } from '@/lib/tools/registry';
import { WizardShell } from '@/components/ui/wizard-shell';
import { SetupState } from '@/components/ui/setup-state';
import { LiveConsole } from '@/components/app/tools/live-console';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('live');
  return { title: t('metaTitle') };
}

// En vivo (SCR-22). OBS not connected → the named setup step (P0-5).

export default async function EnVivoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { session, adapter } = await requireTool(locale, 'chalybobs', '/app/en-vivo', getEnVivo);
  const tw = await getTranslations('wizard');
  const status = await adapter.status(session.user.id);
  return (
    <WizardShell slug="chalybobs" toolName="En vivo" backHref="/app" backLabel={tw('home')} closeLabel={tw('close')} narrow>
      {status.obsConnected ? <LiveConsole initial={status} /> : <SetupState step="obs" />}
    </WizardShell>
  );
}
