import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getSiteSettings } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import { SiteForm } from '@/components/tools/clips/engine/site-form';
import { siteCopy } from '@/components/tools/clips/engine/copy';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.admin.site');
  return { title: t('metaTitle') };
}

// Sitio (engine admins): the prices the engine's public landing shows.

export default async function ClipsSiteSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/sitio');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) => getSiteSettings(e, signal));
  if (!res.ok) {
    if (res.error.reason === 'not_found') notFound();
    return <ClipsReadError error={res.error} tab="settings" />;
  }
  const t = await getTranslations('clipsEngine.admin.site');
  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack" style={{ maxWidth: 820 }}>
        <SettingsNav current="/app/clips/ajustes/sitio" admin />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <SiteForm initial={res.data} copy={await siteCopy()} />
      </div>
    </ToolShell>
  );
}
