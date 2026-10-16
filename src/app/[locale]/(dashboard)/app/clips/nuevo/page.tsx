import type { Metadata, Route } from 'next';
import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter, getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { engineRead, loadClipsEngine, type ClipsEngineGate } from '@/lib/tools/clips-engine';
import { getLive, getSources, getStart } from '@/lib/tools/adapters/clips/engine-api';
import { createClipJob } from '@/lib/tools/clips-actions';
import { clipSourceHref, parseClipSource, type ClipSource } from '@/lib/tools/clips-sources';
import { CLIP_FAILURE_REASONS, type ClipFailureReason } from '@/lib/tools/adapters/types';
import type { ToolError } from '@/lib/tools/bff-core';
import { WizardShell } from '@/components/ui/wizard-shell';
import { SubmitButton } from '@/components/ui/submit-button';
import { ToolErrorState } from '@/components/tools/tool-error-state';
import { ClipError } from '@/components/app/clips/clip-error';
import { PasteButton } from '@/components/app/clips/paste-button';
import {
  ChannelSource,
  LiveSource,
  SourcePicker,
  UploadSource,
} from '@/components/tools/clips/engine/start-sources';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

type Search = Promise<{ error?: string; link?: string; fuente?: string | string[] }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const source = getClipsEngineAdapter() ? parseClipSource((await searchParams).fuente) : 'enlace';
  if (source === 'archivo')
    return { title: (await getTranslations('clipsEngine.upload'))('metaTitle') };
  if (source === 'transmision')
    return { title: (await getTranslations('clipsEngine.live'))('metaTitle') };
  if (source === 'canal')
    return { title: (await getTranslations('clipsEngine.sources'))('metaTitle') };
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Hacer clips: every way to start clips on one page. Paso 1 (SCR-02) is the
// link; with the engine (mode "a") a picker at the top adds "Subir archivo",
// "Desde tu transmisión" and "Vigilar un canal", each rendered inline here
// (?fuente=…). The old one-source pages redirect here. With
// TOOL_HUB_MODE_CHALYBCLIP=off (no engine job API yet) it hands off to the
// Clips app over SSO (P0-14); without the engine only the link exists.
// "Pegar" only where the Clipboard API can read.

export default async function ClipsStep1Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Search;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error, link, fuente } = await searchParams;
  const engine = !!getClipsEngineAdapter();
  // Without the engine the link is the only source.
  const source: ClipSource = engine ? parseClipSource(fuente) : 'enlace';
  const here = clipSourceHref(source);
  await requireClipsAccess(locale, here);
  const t = await getTranslations('clips');
  const tc = await getTranslations('clipsTool');
  const chrome = {
    slug: 'chalybclip',
    toolName: 'Clips',
    backHref: '/app/clips',
    backLabel: t('home'),
    closeLabel: tc('close'),
    closeHref: '/app/clips',
  };

  // No engine API yet: Clips' home shows ToolErrorState (never a hand-off).
  if (!getClipsAdapter()) return redirect({ href: '/app/clips', locale });

  if (source !== 'enlace') {
    const g = await loadClipsEngine(locale, here);
    const frame = (body: ReactNode) => (
      <WizardShell {...chrome}>
        <SourcePicker current={source} />
        {body}
      </WizardShell>
    );
    const failed = (err: ToolError, savedWork?: boolean) =>
      frame(<ToolErrorState slug="chalybclip" error={err} savedWork={savedWork} />);
    if (g.kind !== 'ready') {
      // Locked / setup / risk: Clips' home explains them.
      if (g.kind !== 'error') return redirect({ href: '/app/clips', locale });
      return failed(g.error);
    }
    const ready = g as Extract<ClipsEngineGate, { kind: 'ready' }>;
    if (source === 'archivo') {
      const res = await engineRead(ready, (e, signal) => getStart(e, signal));
      return res.ok ? frame(<UploadSource start={res.data} />) : failed(res.error, true);
    }
    if (source === 'transmision') {
      const res = await engineRead(ready, (e, signal) => getLive(e, signal));
      return res.ok ? frame(<LiveSource live={res.data} />) : failed(res.error, true);
    }
    const res = await engineRead(ready, (e, signal) => getSources(e, signal));
    return res.ok
      ? frame(<ChannelSource sources={res.data} locale={locale} />)
      : failed(res.error, true);
  }

  const caps = getClipsAdapter()!.capabilities();
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });

  const reason = (CLIP_FAILURE_REASONS as readonly string[]).includes(error ?? '')
    ? (error as ClipFailureReason)
    : null;

  if (reason) {
    return (
      <WizardShell {...chrome} narrow={!engine}>
        {engine && <SourcePicker current="enlace" />}
        <ClipError reason={reason} sourceUrl={link} noCharge />
      </WizardShell>
    );
  }

  // Mode "a": the engine decides shape and how many clips a video gives, so
  // there is no step 2 — the link (and the optional Boost) starts the job.
  const te = await getTranslations('clipsEngine');

  return (
    <WizardShell
      {...chrome}
      step={engine ? undefined : 1}
      stepLabel={engine ? undefined : t('step', { n: 1 })}
      narrow={!engine}
    >
      {engine && <SourcePicker current="enlace" />}
      <form
        action={engine ? createClipJob : '/app/clips/nuevo/formato'}
        method={engine ? undefined : 'get'}
        className="ch-center-col"
      >
        <h1 className="ch-h1">
          <label htmlFor="clip-link">{t('s1.title')}</label>
        </h1>
        <p className="ch-sub" id="clip-link-sub">
          {t('s1.sub')}
        </p>
        <div className="ch-paste">
          <input
            id="clip-link"
            name="link"
            type="url"
            inputMode="url"
            required
            autoComplete="off"
            defaultValue={link ?? ''}
            placeholder={t('s1.placeholder')}
            aria-describedby="clip-link-sub clip-link-works"
            className="ch-input"
          />
          <PasteButton targetId="clip-link" label={t('s1.paste')} />
        </div>
        <p id="clip-link-works" className="ch-muted" style={{ fontSize: 17 }}>
          {t('s1.works', { plataformas: list.format(caps.sources) })}
        </p>
        {engine && (
          <label className="ch-check" style={{ fontSize: 17 }}>
            <input type="checkbox" name="boost" value="1" />
            <span>
              {te('boost.label')} <span className="ch-muted">{te('boost.hint')}</span>
            </span>
          </label>
        )}
        <SubmitButton className="ch-btn ch-btn--primary ch-btn--xl">
          {engine ? te('newJob.cta') : t('s1.cta')}
        </SubmitButton>
        {engine && (
          <p className="ch-muted" style={{ fontSize: 16 }}>
            {te('newJob.other')}{' '}
            <Link href={clipSourceHref('archivo') as Route} className="ch-lnk">
              {te('newJob.upload')}
            </Link>
          </p>
        )}
      </form>
    </WizardShell>
  );
}
