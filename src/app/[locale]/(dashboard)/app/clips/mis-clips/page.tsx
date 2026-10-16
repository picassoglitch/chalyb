import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Scissors } from 'lucide-react';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter, getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { runTool } from '@/lib/tools/bff';
import { MineNav } from '@/components/tools/clips/engine/mine-nav';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { ClipCard } from '@/components/tools/clips/clip-card';
import { MineBrowser } from '@/components/tools/clips/mine-browser';
import { ButtonLink } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsTool');
  return { title: t('metaMine') };
}

// Mis clips (TOOLS-SPEC §2): every finished clip, with a search box and
// Todos / Vertical / Horizontal / Cuadrado. Every filter has its own URL
// (?f=…&q=…); MineBrowser applies it in the browser from the clips already
// here, and without JavaScript the links and the GET form still work.

export default async function MisClipsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const gate = await loadTool(locale, 'chalybclip', '/app/clips/mis-clips', getClipsAdapter);
  if (gate.kind === 'locked')
    return (
      <ToolShell
        slug="chalybclip"
        tab={null}
        plan={lockedOffer(gate.entitlements).trial ? 'offer' : 'pro'}
      >
        <ToolLockedState slug="chalybclip" entitlements={gate.entitlements} />
      </ToolShell>
    );
  if (gate.kind !== 'ready')
    return (
      <ToolShell slug="chalybclip" tab="history">
        {gate.kind === 'error' && <ToolErrorState slug="chalybclip" error={gate.error} />}
        {gate.kind === 'setup' && (
          <SetupState step={gate.step} alternativeHref="/app/clips/nuevo" />
        )}
      </ToolShell>
    );

  const t = await getTranslations('clipsTool');
  const loaded = await runTool(
    'chalybclip',
    gate.session.user.id,
    (signal) => gate.adapter.listClips(gate.session.user.id, undefined, signal),
    { idempotent: true, adapterErrorsOnly: true },
  );
  if (!loaded.ok)
    return (
      <ToolShell slug="chalybclip" tab="history">
        <ToolErrorState slug="chalybclip" error={loaded.error} savedWork />
      </ToolShell>
    );
  const all = loaded.data;
  const engineMode = !!getClipsEngineAdapter();
  const now = new Date();

  return (
    <ToolShell slug="chalybclip" tab="history">
      {engineMode && <MineNav current="/app/clips/mis-clips" />}
      {all.length === 0 ? (
        <section className="ch-card ch-state" aria-labelledby="mine-empty">
          <span className="ch-state__ic" aria-hidden="true">
            <Scissors />
          </span>
          <h2 id="mine-empty" className="ch-h2">
            {t('mine.empty.title')}
          </h2>
          <p className="ch-muted">{t('mine.empty.body')}</p>
          <ButtonLink href="/app/clips/nuevo" size="xl">
            {t('home.hero.cta')}
          </ButtonLink>
        </section>
      ) : (
        <MineBrowser
          action="/app/clips/mis-clips"
          items={all.map((c) => ({
            id: c.id,
            format: c.format,
            title: c.title,
            card: <ClipCard clip={c} now={now} />,
          }))}
        />
      )}
    </ToolShell>
  );
}
