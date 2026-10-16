import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Radio } from 'lucide-react';
import { runTool } from '@/lib/tools/bff';
import { formatDuration } from '@/lib/tools/envivo-core';
import { ToolShell } from '@/components/tools/tool-shell';
import { Pill, StateBlock } from '@/components/ui/primitives';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaStreams') };
}

// Mis transmisiones: every stream the relay received (engine
// chalybobs_streams), newest first, with when and how long.

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
                <b>{date.format(new Date(st.startedAt))}</b>
                {st.endedAt === null ? (
                  <Pill kind="bad">{t('ongoing')}</Pill>
                ) : (
                  st.durationSec !== null && (
                    <span className="ch-muted">
                      {t('duration', { duracion: formatDuration(st.durationSec) })}
                    </span>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ToolShell>
  );
}
