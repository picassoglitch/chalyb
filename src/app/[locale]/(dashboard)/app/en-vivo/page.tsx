import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { detectOs } from '@/lib/tools/envivo-core';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { PairingSteps } from '@/components/tools/envivo/pairing-steps';
import { LiveRoom } from '@/components/tools/envivo/live-room';
import { DeviceOffline } from '@/components/tools/envivo/device-offline';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaTitle') };
}

// En vivo · Transmitir (TOOLS-SPEC §6.1–§6.2): no computer yet → Conectar
// (57); paired but offline → "no está conectada"; otherwise the live room
// (22 off air, 58 live).

export default async function EnVivoPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo', 'main');
  if ('fallback' in g) return g.fallback;
  const { session, entitlements, adapter } = g.ready;
  const u = session.user.id;

  const status = await runTool(SLUG, u, (signal) => adapter.status(u, signal), {
    idempotent: true,
  });
  if (!status.ok) return <EnVivoError tab="main" error={status.error} />;

  if (!status.data.paired) {
    const code = await runTool(SLUG, u, (signal) => adapter.createPairingCode(u, signal));
    if (!code.ok) return <EnVivoError tab="main" error={code.error} />;
    return (
      <ToolShell slug={SLUG} tab="main">
        <PairingSteps
          os={detectOs((await headers()).get('user-agent'))}
          initialCode={code.data}
          initialDevices={0}
        />
      </ToolShell>
    );
  }

  if (!status.data.obsConnected && !status.data.liveSince)
    return (
      <ToolShell slug={SLUG} tab="main">
        <DeviceOffline />
      </ToolShell>
    );

  const settings = await runTool(SLUG, u, (signal) => adapter.settings(u, signal), {
    idempotent: true,
  });
  if (!settings.ok) return <EnVivoError tab="main" error={settings.error} />;
  const ta = await getTranslations('toolShell.advanced');
  return (
    <ToolShell slug={SLUG} tab="main">
      <LiveRoom
        initial={status.data}
        quality={settings.data.quality}
        saveRecording={settings.data.saveRecording}
        clipsReady={!!getClipsAdapter() && entitlements.tools.chalybclip?.state === 'included'}
        advanced={{ title: ta('title'), sub: ta('sub') }}
      />
    </ToolShell>
  );
}
