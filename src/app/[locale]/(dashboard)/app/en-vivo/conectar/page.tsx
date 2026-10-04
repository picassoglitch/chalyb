import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { detectOs } from '@/lib/tools/envivo-core';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { PairingSteps } from '@/components/tools/envivo/pairing-steps';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaConnect') };
}

// Conectar (o volver a conectar) la computadora (TOOLS-SPEC §2, mockup 57).
// A person can pair several computers; they all show in Ajustes.

export default async function EnVivoConectarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo/conectar', 'main');
  if ('fallback' in g) return g.fallback;
  const { session, adapter } = g.ready;
  const u = session.user.id;
  const [devices, code] = await Promise.all([
    runTool(SLUG, u, (signal) => adapter.devices(u, signal), { idempotent: true }),
    runTool(SLUG, u, (signal) => adapter.createPairingCode(u, signal)),
  ]);
  if (!devices.ok) return <EnVivoError tab="main" error={devices.error} />;
  if (!code.ok) return <EnVivoError tab="main" error={code.error} />;
  return (
    <ToolShell slug={SLUG} tab="main">
      <PairingSteps
        os={detectOs((await headers()).get('user-agent'))}
        initialCode={code.data}
        initialDevices={devices.data.length}
      />
    </ToolShell>
  );
}
