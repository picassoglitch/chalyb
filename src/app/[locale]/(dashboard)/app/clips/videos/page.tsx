import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Film } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { engineRead, loadClipsEngine } from '@/lib/tools/clips-engine';
import { listStreams } from '@/lib/tools/adapters/clips/engine-api';
import { mmss, relativeDay, thumbFor } from '@/lib/tools/clips-home';
import { ToolShell } from '@/components/tools/tool-shell';
import { ClipsGateView, ClipsReadError } from '@/components/tools/clips/engine/gate';
import { MineNav } from '@/components/tools/clips/engine/mine-nav';
import { AutoRefresh } from '@/components/app/clips/auto-refresh';
import { Pill, StateBlock } from '@/components/ui/primitives';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsEngine.videos');
  return { title: t('metaTitle') };
}

// Mis videos (mode "a"): every video the person gave Clips — link, upload,
// live or a watched channel — newest first, with its state and clip count.
// Each row opens the video's page (/app/clips/videos/[id]).

const KIND: Record<string, 'ok' | 'acc' | 'bad' | 'gray'> = {
  complete: 'ok',
  running: 'acc',
  pending: 'acc',
  failed: 'bad',
};

export default async function ClipsVideosPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await loadClipsEngine(locale, '/app/clips/videos');
  if (g.kind !== 'ready') return <ClipsGateView gate={g} tab="history" />;
  const res = await engineRead(g, (e, signal) => listStreams(e, 200, signal));
  if (!res.ok) return <ClipsReadError error={res.error} tab="history" />;
  const t = await getTranslations('clipsEngine.videos');
  const streams = res.data;
  const now = new Date();
  const working = streams.some((s) => s.status_kind === 'running' || s.status_kind === 'pending');

  return (
    <ToolShell slug="chalybclip" tab="history">
      {working && <AutoRefresh everyMs={8000} />}
      <div className="ch-ce-stack">
        <MineNav current="/app/clips/videos" />
        {streams.length === 0 ? (
          <StateBlock
            icon={<Film />}
            title={t('empty.title')}
            body={t('empty.body')}
            action={{ href: '/app/clips/nuevo', label: t('empty.cta') }}
          />
        ) : (
          <ul className="ch-card ch-ce-rows" aria-label={t('listAria')}>
            {streams.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/app/clips/videos/${encodeURIComponent(s.id)}` as Route}
                  className="ch-ce-row"
                >
                  <span
                    className="ch-ce-row__thumb"
                    aria-hidden="true"
                    style={
                      s.thumb_url
                        ? { backgroundImage: `url(${JSON.stringify(s.thumb_url)})` }
                        : { background: thumbFor(s.id) }
                    }
                  />
                  <span className="ch-ce-row__tx">
                    <b>{s.title || s.channel || t(`source.${sourceKey(s.platform)}`)}</b>
                    <small>
                      {t(`source.${sourceKey(s.platform)}`)} ·{' '}
                      {relativeDay(s.created_at, now, locale)}
                      {s.duration_s > 0 ? ` · ${mmss(s.duration_s)}` : ''} ·{' '}
                      {t('clips', { n: s.clip_count })}
                    </small>
                  </span>
                  <Pill kind={KIND[s.status_kind ?? 'pending'] ?? 'gray'}>
                    {t(`status.${s.status_kind ?? 'pending'}`)}
                  </Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ToolShell>
  );
}

function sourceKey(platform: string): string {
  return ['youtube', 'twitch', 'kick', 'upload', 'live', 'live_ended'].includes(platform)
    ? platform === 'live_ended'
      ? 'live'
      : platform
    : 'other';
}
