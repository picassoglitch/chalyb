// The engine sources of the one "Hacer clips" page (/app/clips/nuevo, mode
// "a"): upload a file, clips from your live stream, watch a channel. Each is
// what its own page used to show (same components, same states); the page
// reads the engine and renders the one that's picked.

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CloudOff, UserPlus } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { getLive, getSources, getStart } from '@/lib/tools/adapters/clips/engine-api';
import { clipSourceHref, type ClipSource } from '@/lib/tools/clips-sources';
import { Pill, StateBlock } from '@/components/ui/primitives';
import { ClipsSubnav } from './subnav';
import { UploadForm } from './upload-form';
import { LivePanel } from './live-panel';
import { SourcesPanel } from './sources-panel';
import { liveCopy, sourcesCopy, uploadCopy } from './copy';

type Start = Awaited<ReturnType<typeof getStart>>;
type Live = Awaited<ReturnType<typeof getLive>>;
type Sources = Awaited<ReturnType<typeof getSources>>;

/** Enlace · Subir archivo · Desde tu transmisión · Vigilar un canal. Plain
 *  links (?fuente=…), so the back button and shared links keep the pick. */
export async function SourcePicker({ current }: { current: ClipSource }) {
  const t = await getTranslations('clipsEngine.newJob.sources');
  const items: { source: ClipSource; label: string }[] = [
    { source: 'enlace', label: t('link') },
    { source: 'archivo', label: t('upload') },
    { source: 'transmision', label: t('live') },
    { source: 'canal', label: t('channel') },
  ];
  return (
    <div className="ch-ce-picker">
      <ClipsSubnav
        label={t('aria')}
        current={clipSourceHref(current)}
        items={items.map((i) => ({ href: clipSourceHref(i.source), label: i.label }))}
      />
    </div>
  );
}

export async function UploadSource({ start }: { start: Start }) {
  const t = await getTranslations('clipsEngine.upload');
  return (
    <div className="ch-ce-stack ch-ce-source" style={{ maxWidth: 760 }}>
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      {!start.upload.enabled ? (
        <StateBlock
          icon={<CloudOff />}
          title={t('off.title')}
          body={t('off.body')}
          action={{ href: clipSourceHref('enlace'), label: t('off.cta') }}
        />
      ) : !start.has_persona ? (
        <StateBlock
          icon={<CloudOff />}
          title={t('noPersona.title')}
          body={t('noPersona.body')}
          action={{ href: '/app/clips/ajustes/personas', label: t('noPersona.cta') }}
        />
      ) : (
        <section className="ch-card ch-ce-card">
          <UploadForm copy={await uploadCopy()} maxBytes={start.upload.max_bytes} />
        </section>
      )}
    </div>
  );
}

/** The RTMP server and stream key for OBS (with rotation), the En vivo ↔
 *  Clips connection and recent live broadcasts. */
export async function LiveSource({ live }: { live: Live }) {
  const t = await getTranslations('clipsEngine.live');
  const fmt = new Intl.DateTimeFormat(await getLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <div className="ch-ce-stack ch-ce-source">
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{t('sub')}</p>
      </header>
      <div className="ch-ce-video">
        <section className="ch-card ch-ce-card" aria-labelledby="l-obs">
          <h2 id="l-obs" className="ch-h3">
            {t('obsTitle')}
          </h2>
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
          <h2 id="l-envivo" className="ch-h3">
            {t('envivoTitle')}
          </h2>
          <p className="ch-ce-note">{t('envivoBody')}</p>
          {!live.chalybobs.full_access && <p className="ch-ce-note">{t('envivoVip')}</p>}
          <Link href={'/app/en-vivo' as Route} className="ch-btn ch-btn--secondary">
            {t('envivoOpen')}
          </Link>
        </section>
      </div>
      <section className="ch-ce-stack" aria-labelledby="l-recent">
        <h2 id="l-recent" className="ch-ghead">
          {t('recent')}
        </h2>
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
  );
}

/** Channels Clips watches (add, check now, stop watching): every new video
 *  comes in on its own and goes through the whole process. */
export async function ChannelSource({ sources, locale }: { sources: Sources; locale: string }) {
  const t = await getTranslations('clipsEngine.sources');
  const { watches, personas } = sources;
  return (
    <div className="ch-ce-stack ch-ce-source">
      <header>
        <h1 className="ch-h1">{t('title')}</h1>
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
  );
}
