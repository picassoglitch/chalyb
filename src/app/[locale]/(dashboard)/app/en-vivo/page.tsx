import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { previewUrlFor } from '@/lib/tools/envivo-bff';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { EnVivoStudio, type ConnectNotice } from '@/components/tools/envivo/envivo-studio';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaTitle') };
}

// En vivo · Transmitir: the engine's dashboard (title, live status, preview,
// encoder data, Clips connection, channels) inside ToolShell. A platform
// sign-in that couldn't use a popup lands back here with ?connected= or
// ?connect_error= (oauth/callback).

export default async function EnVivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo', 'main');
  if ('fallback' in g) return g.fallback;
  const { session, adapter } = g.ready;
  const u = session.user.id;

  const [state, preview] = await Promise.all([
    runTool(SLUG, u, (signal) => adapter.state(u, signal), { idempotent: true }),
    runTool(SLUG, u, (signal) => adapter.previewToken(u, signal), { idempotent: true }),
  ]);
  if (!state.ok) return <EnVivoError tab="main" error={state.error} />;

  const q = await searchParams;
  const ok = typeof q.connected === 'string' ? q.connected.slice(0, 40) : null;
  const err = typeof q.connect_error === 'string' ? q.connect_error.slice(0, 60) : null;
  const notice: ConnectNotice = ok
    ? { kind: 'ok', code: ok }
    : err
      ? { kind: 'error', code: err }
      : null;

  return (
    <ToolShell slug={SLUG} tab="main">
      <EnVivoStudio
        initial={state.data}
        previewUrl={preview.ok ? previewUrlFor(preview.data).url : null}
        notice={notice}
      />
    </ToolShell>
  );
}
