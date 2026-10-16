import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { UserPlus } from 'lucide-react';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getMe, getSources } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import { SourcesPanel } from '@/components/tools/clips/engine/sources-panel';
import { sourcesCopy } from '@/components/tools/clips/engine/copy';
import { StateBlock } from '@/components/ui/primitives';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.sources');
  return { title: t('metaTitle') };
}

// Clips · Canales (mode "a"): channels Clips watches; every new video comes
// in on its own and goes through the whole process.

export default async function ClipsChannelsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/canales');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) =>
    Promise.all([getSources(e, signal), getMe(e, signal)]),
  );
  if (!res.ok) return <ClipsReadError error={res.error} tab="settings" />;
  const [{ watches, personas }, me] = res.data;
  const t = await getTranslations('clipsEngine.sources');

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/canales" admin={me.is_admin} />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        {personas.length === 0 ? (
          <StateBlock
            icon={<UserPlus />}
            title={t('noPersona.title')}
            body={t('noPersona.body')}
            action={{ href: '/app/clips/ajustes/personas', label: t('noPersona.cta') }}
          />
        ) : (
          <SourcesPanel
            initial={watches}
            personas={personas}
            copy={await sourcesCopy()}
            locale={locale}
          />
        )}
      </div>
    </ToolShell>
  );
}
