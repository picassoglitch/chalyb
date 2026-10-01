import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Check, Download } from 'lucide-react';
import type { Route } from 'next';
import { Link, redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { loadClipJob } from '@/lib/tools/clips-jobs';
import type { ClipJobState } from '@/lib/tools/adapters/types';
import { WizardShell } from '@/components/ui/wizard-shell';
import { ButtonLink } from '@/components/ui/primitives';
import { ClipError } from '@/components/app/clips/clip-error';
import { AutoRefresh } from '@/components/app/clips/auto-refresh';
import { ShareButton } from '@/components/app/clips/share-button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return { title: t('wait.metaTitle') };
}

// Clips · Creando (SCR-04) → Listos (SCR-05), or the error state (SCR-24).
// Every read re-applies the job policy on the server: automatic retries,
// credits charged once on success, failures logged.

const STEPS: Exclude<ClipJobState, 'failed'>[] = [
  'received',
  'finding_moments',
  'adding_captions',
  'ready',
];

/** Thumbnail frames: gradients, never photos (BUILD-SPEC §1.6 Thumb). */
const THUMBS = [
  'linear-gradient(160deg,#7B6CFF,#2A1E7A)',
  'linear-gradient(160deg,#30B0C7,#0B3B49)',
  'linear-gradient(160deg,#FF7A45,#6B1A0A)',
  'linear-gradient(160deg,#5B8DEF,#14245C)',
];

export default async function ClipJobPage({
  params,
}: {
  params: Promise<{ locale: string; job: string }>;
}) {
  const { locale, job: jobId } = await params;
  setRequestLocale(locale);
  const { session } = await requireClipsAccess(locale, `/app/clips/${jobId}`);
  if (!getClipsAdapter()) return redirect({ href: '/app/clips', locale });

  const job = await loadClipJob(session.user.id, jobId);
  if (!job) notFound();
  const t = await getTranslations('clips');
  const chrome = {
    slug: 'chalybclip',
    toolName: 'Clips',
    backHref: '/app/clips',
    backLabel: t('back'),
    closeLabel: t('close'),
  };

  if (job.state === 'failed') {
    return (
      <WizardShell {...chrome} narrow>
        <ClipError
          reason={job.reason ?? 'unknown'}
          sourceUrl={job.sourceUrl}
          noCharge={getClipsAdapter()?.capabilities().confirmsNoChargeOnFailure ?? false}
        />
      </WizardShell>
    );
  }

  if (job.state === 'ready') {
    return (
      <WizardShell {...chrome} backHref="/app" backLabel={t('home')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 className="ch-h1">{t('done.title')}</h1>
              <p className="ch-sub">{t('done.sub', { n: job.clips.length })}</p>
            </div>
            <ButtonLink href="/app/clips" variant="secondary">
              {t('done.more')}
            </ButtonLink>
          </header>
          <ul className="ch-clips">
            {job.clips.map((clip, i) => (
              <li key={clip.id} className="ch-card ch-clip">
                <div
                  className="ch-clip__thumb"
                  role="img"
                  aria-label={t('done.thumbAlt', { title: clip.title })}
                  style={{ background: THUMBS[i % THUMBS.length] }}
                >
                  <span className="ch-clip__dur">
                    {t('done.duration', { seconds: clip.durationSec })}
                  </span>
                </div>
                <p style={{ fontWeight: 600 }}>{clip.title}</p>
                <a
                  href={clip.downloadUrl}
                  download
                  aria-label={t('done.downloadClip', { title: clip.title })}
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                >
                  <Download aria-hidden="true" />
                  {t('done.download')}
                </a>
                <ShareButton
                  url={clip.downloadUrl}
                  title={clip.title}
                  label={t('done.share')}
                  ariaLabel={t('done.shareClip', { title: clip.title })}
                  copiedLabel={t('done.copied')}
                />
              </li>
            ))}
          </ul>
          <p className="ch-muted">
            {t('done.saved')}{' '}
            <Link href={'/app/history' as Route} className="ch-lnk">
              {t('done.results')}
            </Link>
          </p>
        </div>
      </WizardShell>
    );
  }

  const current = STEPS.indexOf(job.state);
  const pct = Math.round(((current + 0.5) / STEPS.length) * 100);
  return (
    <WizardShell {...chrome} step={3} stepLabel={t('step', { n: 3 })} narrow>
      <AutoRefresh />
      <div className="ch-center-col">
        <div
          className="ch-ring"
          style={{ ['--p' as string]: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('wait.progress')}
        >
          <span>{pct}%</span>
        </div>
        <h1 className="ch-h1">{t('wait.title')}</h1>
        <p className="ch-sub">{t('wait.sub')}</p>
        <ol className="ch-card ch-status" aria-label={t('wait.progress')}>
          {STEPS.map((step, i) => {
            const status = i < current ? 'done' : i === current ? 'run' : 'wait';
            return (
              <li
                key={step}
                className={`ch-status__i ch-status__i--${status}`}
                aria-current={status === 'run' ? 'step' : undefined}
              >
                <span className="ch-status__dot" aria-hidden="true">
                  {status === 'done' && <Check />}
                </span>
                <span>
                  {step === 'finding_moments' && job.momentsFound
                    ? t('wait.found', { n: job.momentsFound })
                    : t(`wait.steps.${step}`)}
                  <span className="ch-sr">{` · ${t(`wait.status.${status}`)}`}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </WizardShell>
  );
}
