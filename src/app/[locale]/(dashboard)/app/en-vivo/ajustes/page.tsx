import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { EnVivoSettings } from '@/components/tools/envivo/envivo-settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaSettings') };
}

// Ajustes de En vivo: the Clips connection and the stream key (shown only on
// "Mostrar", regenerated behind a confirmation). Channels live in Transmitir,
// like in the engine.

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
  const state = await runTool(SLUG, u, (signal) => adapter.state(u, signal), { idempotent: true });
  if (!state.ok) return <EnVivoError tab="settings" error={state.error} />;
  return (
    <ToolShell slug={SLUG} tab="settings">
      <EnVivoSettings initial={state.data} />
    </ToolShell>
  );
}
