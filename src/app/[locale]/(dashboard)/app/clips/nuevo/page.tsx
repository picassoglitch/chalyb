import type { Metadata, Route } from 'next';
import { Link } from '@/i18n/routing';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter, getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { createClipJob } from '@/lib/tools/clips-actions';
import { CLIP_FAILURE_REASONS, type ClipFailureReason } from '@/lib/tools/adapters/types';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ClipError } from '@/components/app/clips/clip-error';
import { PasteButton } from '@/components/app/clips/paste-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('s1.metaTitle') };
}

// Clips · Paso 1 (SCR-02): paste a link. With TOOL_HUB_MODE_CHALYBCLIP=off
// (no engine job API yet) it hands off to the Clips app over SSO (P0-14).
// Connect / upload alternatives show only when the adapter supports them
// (none does yet); "Pegar" only where the Clipboard API can read.

export default async function ClipsStep1Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; link?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireClipsAccess(locale, '/app/clips/nuevo');
  const t = await getTranslations('clips');
  const tc = await getTranslations('clipsTool');
  const { error, link } = await searchParams;
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

  const caps = getClipsAdapter()!.capabilities();
  const list = new Intl.ListFormat(locale === 'es' ? 'es' : 'en', { type: 'conjunction' });

  const reason = (CLIP_FAILURE_REASONS as readonly string[]).includes(error ?? '')
    ? (error as ClipFailureReason)
    : null;

  if (reason) {
    return (
      <WizardShell {...chrome} narrow>
        <ClipError reason={reason} sourceUrl={link} noCharge />
      </WizardShell>
    );
  }

  // Mode "a": the engine decides shape and how many clips a video gives, so
  // there is no step 2 — the link (and the optional Boost) starts the job.
  const engine = !!getClipsEngineAdapter();
  const te = await getTranslations('clipsEngine');

  return (
    <WizardShell
      {...chrome}
      step={engine ? undefined : 1}
      stepLabel={engine ? undefined : t('step', { n: 1 })}
      narrow
    >
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
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--xl">
          {engine ? te('newJob.cta') : t('s1.cta')}
        </button>
        {engine && (
          <p className="ch-muted" style={{ fontSize: 16 }}>
            {te('newJob.other')}{' '}
            <Link href={'/app/clips/subir' as Route} className="ch-lnk">
              {te('newJob.upload')}
            </Link>
          </p>
        )}
      </form>
    </WizardShell>
  );
}
