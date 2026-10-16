import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Palette } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getMe, listKits } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import { ButtonLink, Pill, StateBlock } from '@/components/ui/primitives';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.styles');
  return { title: t('metaTitle') };
}

// Tus estilos (brand kits, mode "a"): your accounts, caption style and the
// phrases that cut clips, one per style; one is the default.

export default async function ClipsStylesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/ajustes/estilos');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) =>
    Promise.all([listKits(e, signal), getMe(e, signal)]),
  );
  if (!res.ok) return <ClipsReadError error={res.error} tab="settings" />;
  const [{ kits }, me] = res.data;
  const t = await getTranslations('clipsEngine.styles');

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/ajustes/estilos" admin={me.is_admin} />
        <header className="ch-ce-head">
          <div>
            <h2 className="ch-h2">{t('title')}</h2>
            <p className="ch-sub">{t('sub')}</p>
          </div>
          <ButtonLink href="/app/clips/ajustes/estilos/nuevo">{t('new')}</ButtonLink>
        </header>
        {kits.length === 0 ? (
          <StateBlock icon={<Palette />} title={t('empty.title')} body={t('empty.body')} />
        ) : (
          <ul className="ch-card ch-ce-rows">
            {kits.map((k) => (
              <li key={k.id}>
                <Link
                  href={`/app/clips/ajustes/estilos/${encodeURIComponent(k.id)}` as Route}
                  className="ch-ce-row"
                >
                  <span className="ch-ce-row__tx">
                    <b>{k.name}</b>
                    <small>
                      <span className="ch-ce-swatch" style={{ background: k.primary_color }} />{' '}
                      <span className="ch-ce-swatch" style={{ background: k.accent_color }} /> ·{' '}
                      {t('phrases', { a: k.forward_count, b: k.retroactive_count })}
                    </small>
                  </span>
                  {k.is_default && <Pill kind="ok">{t('default')}</Pill>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolShell>
  );
}
