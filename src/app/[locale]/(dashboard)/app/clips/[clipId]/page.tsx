import type { Metadata, Route } from 'next';
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { loadTool } from '@/lib/tools/access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { CLIP_FORMATS } from '@/lib/tools/adapters/types';
import { clipNeighbours } from '@/lib/tools/clips-home';
import { socialsAllowed } from '@/lib/tools/clips-bff';
import { ToolShell } from '@/components/tools/tool-shell';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ToolLockedState, lockedOffer } from '@/components/tools/tool-locked-state';
import { ClipEditor } from '@/components/tools/clips/clip-editor';
import { PublishButton } from '@/components/tools/clips/publish-button';
import { ConnectAccount } from '@/components/tools/clips/connect-account';
import { ButtonLink } from '@/components/ui/primitives';
import { SetupState } from '@/components/ui/setup-state';
import '@/styles/tools-clips.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clipsTool');
  return { title: t('metaDetail') };
}

// Detalle del clip (TOOLS-SPEC §4.2, mockup 51), under the "Mis clips" tab.
// "Publicar en TikTok" shows only when TikTok is connected, or when the
// engine can connect it (then it opens ConnectAccountSheet and comes back).

export default async function ClipDetailPage({
  params,
}: {
  params: Promise<{ locale: string; clipId: string }>;
}) {
  const { locale, clipId } = await params;
  setRequestLocale(locale);
  const path = `/app/clips/${clipId}`;
  const gate = await loadTool(locale, 'chalybclip', path, getClipsAdapter);
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
  const td = await getTranslations('clipsTool.detail');
  const userId = gate.session.user.id;
  const { adapter } = gate;
  const [all, settings, accounts] = await Promise.all([
    adapter.listClips(userId),
    adapter.getSettings(userId),
    adapter.accounts(userId),
  ]);
  const clip = all.find((c) => c.id === clipId) ?? null;

  if (!clip)
    return (
      <ToolShell slug="chalybclip" tab="history">
        <section className="ch-card ch-state" aria-labelledby="clip-404">
          <span className="ch-state__ic" aria-hidden="true">
            <SearchX />
          </span>
          <h2 id="clip-404" className="ch-h2">
            {td('notFound.title')}
          </h2>
          <ButtonLink href="/app/clips/mis-clips" size="xl">
            {td('notFound.cta')}
          </ButtonLink>
        </section>
      </ToolShell>
    );

  const pos = clipNeighbours(all, clip.id)!;
  const caps = adapter.capabilities();
  const tiktok = accounts.find((a) => a.platform === 'tiktok' && a.connected);
  const tc = await getTranslations('consents.connect');
  const tx = await getTranslations('clipsTool.connect');
  const publishLabel = td('publish', { plataforma: 'TikTok' });
  // Publishing and connecting need a plan with social accounts (TIER_CAPS).
  const socials = socialsAllowed(gate.entitlements.plan);
  const publish = !socials ? null : tiktok ? (
    <PublishButton
      clipId={clip.id}
      platform="tiktok"
      labels={{
        cta: publishLabel,
        done: td('published', { plataforma: 'TikTok' }),
        error: td('publishError', { plataforma: 'TikTok' }),
      }}
    />
  ) : caps.supportsConnect ? (
    <ConnectAccount
      platform="tiktok"
      returnTo={path}
      locale={await getLocale()}
      className="ch-btn ch-btn--gray"
      copy={{
        open: publishLabel,
        title: tx('title', { plataforma: 'TikTok' }),
        body: tc.markup('body', { plataforma: 'TikTok', b: (c) => `<b>${c}</b>` }),
        cta: tc('cta', { plataforma: 'TikTok' }),
        close: tx('close'),
        error: tx('error'),
      }}
    />
  ) : undefined;

  return (
    <ToolShell slug="chalybclip" tab="history">
      <div className="ch-clipnav">
        <Link href={'/app/clips/mis-clips' as Route} className="ch-back">
          <ChevronLeft aria-hidden="true" />
          <span>{td('back')}</span>
        </Link>
        <div className="ch-clipnav__pos">
          {pos.prev ? (
            <Link
              href={`/app/clips/${encodeURIComponent(pos.prev)}` as Route}
              className="ch-round"
              aria-label={td('prev')}
            >
              <ChevronLeft aria-hidden="true" />
            </Link>
          ) : (
            <span className="ch-round ch-round--off" aria-hidden="true">
              <ChevronLeft />
            </span>
          )}
          <span className="ch-muted">{td('position', { n: pos.n, total: pos.total })}</span>
          {pos.next ? (
            <Link
              href={`/app/clips/${encodeURIComponent(pos.next)}` as Route}
              className="ch-round"
              aria-label={td('next')}
            >
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span className="ch-round ch-round--off" aria-hidden="true">
              <ChevronRight />
            </span>
          )}
        </div>
      </div>
      <ClipEditor
        key={clip.id}
        clip={clip}
        publish={caps.editClips ? publish : undefined}
        copy={{
          title: td('title'),
          titleHint: td('titleHint'),
          captions: td('captions'),
          captionsSub: td('captionsSub', {
            idioma: t(`langs.${settings.captionLang}`),
            estilo: t(`presets.${settings.captionPreset}`),
          }),
          captionSample: t('presets.sample'),
          trim: td('trim'),
          trimHint: td('trimHint'),
          trimStart: td.raw('trimStart') as string,
          trimLength: td.raw('trimLength') as string,
          trimEnd: td.raw('trimEnd') as string,
          trimStartHandle: td('trimStartHandle'),
          trimEndHandle: td('trimEndHandle'),
          format: td('format'),
          formats: Object.fromEntries(CLIP_FORMATS.map((f) => [f, t(`format.${f}`)])) as Record<
            (typeof CLIP_FORMATS)[number],
            string
          >,
          download: td('download'),
          preparing: td('preparing'),
          share: td('share'),
          copied: td('copied'),
          autosave: td('autosave'),
          saving: td('saving'),
          saved: td('saved'),
          saveError: td('saveError'),
          player: td('player', { titulo: clip.title }),
        }}
      />
    </ToolShell>
  );
}
