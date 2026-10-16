import type { Metadata, Route } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { runTool } from '@/lib/tools/bff';
import { Link } from '@/i18n/routing';
import { Markup } from '@/components/ui/markup';
import { ToolShell } from '@/components/tools/tool-shell';
import { EnVivoError, SLUG, enVivoGate } from '@/components/tools/envivo/en-vivo-gate';
import { EncoderCard } from '@/components/tools/envivo/encoder-card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('liveTool');
  return { title: t('metaConnect') };
}

// Conecta tu encoder: the engine's "Cómo conectar OBS, vMix, Zoom" guide
// next to the data to paste (server, key on "Mostrar", one-field URL).

const STEPS = ['obs', 'vmix', 'zoom', 'camera'] as const;

export default async function EnVivoConectarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const g = await enVivoGate(locale, '/app/en-vivo/conectar', 'main');
  if ('fallback' in g) return g.fallback;
  const { session, adapter } = g.ready;
  const u = session.user.id;
  const state = await runTool(SLUG, u, (signal) => adapter.state(u, signal), { idempotent: true });
  if (!state.ok) return <EnVivoError tab="main" error={state.error} />;
  const t = await getTranslations('liveTool.connect');
  const b = (c: string) => `<b>${c}</b>`;
  return (
    <ToolShell slug={SLUG} tab="main">
      <div className="ch-ev-guide">
        <div className="ch-card ch-ev-guide__tx">
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-muted">{t('sub')}</p>
          <ol className="ch-ev-guide__steps">
            {STEPS.map((s) => (
              <li key={s}>
                <Markup text={t.markup(s, { b })} />
              </li>
            ))}
          </ol>
          <p className="ch-muted">{t('after')}</p>
          <Link href={'/app/en-vivo' as Route} className="ch-btn ch-btn--primary">
            {t('back')}
          </Link>
        </div>
        <div className="ch-card">
          <EncoderCard rtmpUrl={state.data.rtmpUrl} next="/app/en-vivo/conectar" guide={false} />
        </div>
      </div>
    </ToolShell>
  );
}
