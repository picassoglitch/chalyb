import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getMe, getPersonas } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import { PersonasPanel } from '@/components/tools/clips/engine/personas-panel';
import { personasCopy } from '@/components/tools/clips/engine/copy';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.personas');
  return { title: t('metaTitle') };
}

// Personas (mode "a"): the voice and languages Clips writes captions in.

export default async function ClipsPersonasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/personas');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) =>
    Promise.all([getPersonas(e, signal), getMe(e, signal)]),
  );
  if (!res.ok) return <ClipsReadError error={res.error} tab="settings" />;
  const [{ personas }, me] = res.data;
  const t = await getTranslations('clipsEngine.personas');
  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/ajustes/personas" admin={me.is_admin} />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <PersonasPanel initial={personas} copy={await personasCopy()} />
      </div>
    </ToolShell>
  );
}
