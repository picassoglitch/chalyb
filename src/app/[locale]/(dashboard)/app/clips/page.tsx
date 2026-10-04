import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { SetupState } from '@/components/ui/setup-state';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Inicio de Clips (TOOLS-SPEC §4.1, mockup 50). TODO(WS-11 Clips): the home.

export default async function ClipsHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybclip', '/app/clips', getClipsAdapter);
  if (gate.kind === 'locked')
    return (
      <ToolShell slug="chalybclip" tab={null} plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}>
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  return (
    <ToolShell slug="chalybclip" tab="main">
      {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
      {gate.kind === 'setup' && <SetupState step={gate.step} />}
    </ToolShell>
  );
}
