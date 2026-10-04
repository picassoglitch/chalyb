import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { LiveSettingsForm } from '@/components/tools/envivo/live-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaSettings') };
}

// Ajustes de En vivo (TOOLS-SPEC §6.3, mockup 59). The stream key never
// renders here: StreamKey fetches it only on "Mostrar".

export default async function EnVivoAjustesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo/ajustes', 'settings');
  if ('fallback' in g) return g.fallback;
  const { session, adapter } = g.ready;
  const u = session.user.id;
  const [settings, devices] = await Promise.all([
    runTool(SLUG, u, () => adapter.settings(u), { idempotent: true }),
    runTool(SLUG, u, () => adapter.devices(u), { idempotent: true }),
  ]);
  if (!settings.ok) return <EnVivoError tab="settings" error={settings.error} />;
  if (!devices.ok) return <EnVivoError tab="settings" error={devices.error} />;
  const ta = await getTranslations('toolShell.advanced');
  const ts = await getTranslations('toolShell');
  return (
    <ToolShell slug={SLUG} tab="settings">
      <LiveSettingsForm
        initial={settings.data}
        devices={devices.data}
        supportsConnect={adapter.capabilities().supportsConnect}
        advanced={{ title: ta('title'), sub: ta('sub') }}
        autosave={{ idle: ts('autosave'), saving: ts('saving'), saved: ts('saved') }}
      />
    </ToolShell>
  );
}
