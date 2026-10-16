import type { Metadata, Route } from 'next';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { getLive, getMe } from '@/lib/tools/adapters/clips/engine-api';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { SettingsNav } from '@/components/tools/clips/engine/mine-nav';
import { LivePanel } from '@/components/tools/clips/engine/live-panel';
import { liveCopy } from '@/components/tools/clips/engine/copy';
import { Pill } from '@/components/ui/primitives';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.live');
  return { title: t('metaTitle') };
}

// Clips · En vivo (mode "a"): the RTMP server and stream key for OBS, key
// rotation, the En vivo ↔ Clips connection, and recent live broadcasts.
// Streaming itself lives in En vivo (/app/en-vivo).

export default async function ClipsLivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/en-vivo');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="settings" />;
  const res = await engineRead(g, (e, signal) =>
    Promise.all([getLive(e, signal), getMe(e, signal)]),
  );
  if (!res.ok) return <ClipsReadError error={res.error} tab="settings" />;
  const [live, me] = res.data;
  const t = await getTranslations('clipsEngine.live');
  const fmt = new Intl.DateTimeFormat(await getLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <ToolShell slug="chalybclip" tab="settings">
      <div className="ch-ce-stack">
        <SettingsNav current="/app/clips/en-vivo" admin={me.is_admin} />
        <header>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-sub">{t('sub')}</p>
        </header>
        <div className="ch-ce-video">
          <section className="ch-card ch-ce-card" aria-labelledby="l-obs">
            <h3 id="l-obs" className="ch-h3">
              {t('obsTitle')}
            </h3>
            {live.configured ? (
              <>
                <p className="ch-ce-note">{t('obsHelp')}</p>
                <LivePanel initial={live} copy={await liveCopy()} />
              </>
            ) : (
              <p className="ch-ce-note">{t('notConfigured')}</p>
            )}
          </section>
          <section className="ch-card ch-ce-card" aria-labelledby="l-envivo">
            <h3 id="l-envivo" className="ch-h3">
              {t('envivoTitle')}
            </h3>
            <p className="ch-ce-note">{t('envivoBody')}</p>
            {!live.chalybobs.full_access && <p className="ch-ce-note">{t('envivoVip')}</p>}
            <Link href={'/app/en-vivo' as Route} className="ch-btn ch-btn--secondary">
              {t('envivoOpen')}
            </Link>
          </section>
        </div>
        <section className="ch-ce-stack" aria-labelledby="l-recent">
          <h3 id="l-recent" className="ch-ghead">
            {t('recent')}
          </h3>
          {live.streams.length === 0 ? (
            <p className="ch-muted">{t('recentEmpty')}</p>
          ) : (
            <ul className="ch-card ch-ce-rows">
              {live.streams.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/app/clips/videos/${encodeURIComponent(s.id)}` as Route}
                    className="ch-ce-row"
                  >
                    <span className="ch-ce-row__tx">
                      <b>{s.title || t('untitled')}</b>
                      <small>
                        {s.live_started_at ? fmt.format(new Date(s.live_started_at)) : '—'}
                        {s.live_ended_at ? ` → ${fmt.format(new Date(s.live_ended_at))}` : ''}
                      </small>
                    </span>
                    <Pill kind={s.status === 'live' ? 'bad' : 'gray'}>
                      {s.status === 'live' ? t('onAir') : t('ended')}
                    </Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ToolShell>
  );
}
