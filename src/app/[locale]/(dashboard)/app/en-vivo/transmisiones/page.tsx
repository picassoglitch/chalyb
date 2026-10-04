import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Play, Radio, Scissors } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { runTool } from '@/lib/tools/bff';
import { formatDuration } from '@/lib/tools/envivo-core';
import { ToolShell } from '@/components/tools/tool-shell';
import { StateBlock } from '@/components/ui/primitives';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaStreams') };
}

// Mis transmisiones (TOOLS-SPEC §2; cards like mockup 19): watch the
// recording (same tab) or make clips from it.

export default async function EnVivoTransmisionesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo/transmisiones', 'history');
  if ('fallback' in g) return g.fallback;
  const { session, adapter } = g.ready;
  const u = session.user.id;
  const streams = await runTool(SLUG, u, (signal) => adapter.streams(u, signal), {
    idempotent: true,
  });
  if (!streams.ok) return <EnVivoError tab="history" error={streams.error} />;
  const t = await getTranslations('liveTool.streams');
  const date = new Intl.DateTimeFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Mexico_City',
  });

  return (
    <ToolShell slug={SLUG} tab="history">
      <h2 className="ch-h2">{t('title')}</h2>
      {streams.data.length === 0 ? (
        <StateBlock
          icon={<Radio />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={{ href: '/app/en-vivo', label: t('emptyCta') }}
        />
      ) : (
        <ul className="ch-ev-streams">
          {streams.data.map((st) => (
            <li key={st.id} className="ch-card ch-ev-stream">
              <span className="ch-ev-stream__thumb" aria-hidden="true">
                <Radio />
              </span>
              <div className="ch-ev-stream__tx">
                <b>{st.title}</b>
                <span className="ch-muted">
                  {date.format(new Date(st.startedAt))} ·{' '}
                  {t('duration', { duracion: formatDuration(st.durationSec) })}
                </span>
                <span className="ch-muted">{st.platforms.join(' · ')}</span>
              </div>
              <div className="ch-ev-stream__btns">
                {st.recordingUrl ? (
                  <>
                    <a href={st.recordingUrl} className="ch-btn ch-btn--gray ch-btn--compact">
                      <Play aria-hidden="true" />
                      {t('watch')}
                    </a>
                    <Link
                      href={`/app/clips/nuevo?link=${encodeURIComponent(st.recordingUrl)}` as Route}
                      className="ch-btn ch-btn--secondary ch-btn--compact"
                    >
                      <Scissors aria-hidden="true" />
                      {t('clips')}
                    </Link>
                  </>
                ) : (
                  <span className="ch-muted">{t('noRecording')}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ToolShell>
  );
}
