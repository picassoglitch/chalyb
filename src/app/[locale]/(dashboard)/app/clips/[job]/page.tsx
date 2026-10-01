import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link, redirect } from '@/i18n/routing';
import { requireClipsAccess } from '@/lib/tools/clips-access';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { loadClipJob } from '@/lib/tools/clips-jobs';
import type { ClipJobState } from '@/lib/tools/adapters/types';
import { WizardHeader } from '@/components/app/clips/wizard-header';
import { ClipError } from '@/components/app/clips/clip-error';
import { AutoRefresh } from '@/components/app/clips/auto-refresh';

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

  if (job.state === 'failed') {
    return (
      <div className="cc-scroll" style={{ maxWidth: 760 }}>
        <WizardHeader step={3} backHref="/app/clips" />
        <ClipError reason={job.reason ?? 'unknown'} sourceUrl={job.sourceUrl} />
      </div>
    );
  }

  if (job.state === 'ready') {
    return (
      <div className="cc-scroll" style={{ maxWidth: 1040 }}>
        <h1 style={h1}>{t('done.title')}</h1>
        <p style={sub}>{t('done.sub', { n: job.clips.length })}</p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'grid',
            gap: 16,
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          }}
        >
          {job.clips.map((clip) => (
            <li key={clip.id} style={card}>
              <p style={{ fontWeight: 600, fontSize: 18 }}>{clip.title}</p>
              <p style={{ color: 'var(--cc-txt-2)', fontSize: 15 }}>
                {t('done.duration', { seconds: clip.durationSec })}
              </p>
              <a
                href={clip.downloadUrl}
                download
                aria-label={t('done.downloadClip', { title: clip.title })}
                style={download}
              >
                {t('done.download')}
              </a>
            </li>
          ))}
        </ul>
        <p style={{ ...sub, fontSize: 16, marginTop: 24 }}>
          {t('done.saved')}{' '}
          <Link href={'/app/history' as Route} style={{ color: 'var(--cc-green)' }}>
            {t('done.results')}
          </Link>
        </p>
        <Link href={'/app/clips' as Route} style={secondary}>
          {t('done.more')}
        </Link>
      </div>
    );
  }

  const current = STEPS.indexOf(job.state);
  return (
    <div className="cc-scroll" style={{ maxWidth: 760 }}>
      <WizardHeader step={3} backHref="/app/clips" />
      <AutoRefresh />
      <h1 style={h1}>{t('wait.title')}</h1>
      <p style={sub}>{t('wait.sub')}</p>
      <ol
        aria-label={t('wait.progress')}
        style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 14 }}
      >
        {STEPS.map((step, i) => {
          const status = i < current ? 'done' : i === current ? 'run' : 'wait';
          return (
            <li
              key={step}
              aria-current={status === 'run' ? 'step' : undefined}
              style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 18 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: status === 'wait' ? 'var(--cc-line-2)' : 'var(--cc-green)',
                  opacity: status === 'run' ? 0.6 : 1,
                }}
              />
              <span style={{ color: status === 'wait' ? 'var(--cc-txt-3)' : 'var(--cc-txt)' }}>
                {step === 'finding_moments' && job.momentsFound
                  ? t('wait.found', { n: job.momentsFound })
                  : t(`wait.steps.${step}`)}
                <span className="sr-only">{` · ${t(`wait.status.${status}`)}`}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const h1 = { fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 } as const;
const sub = { fontSize: 18, color: 'var(--cc-txt-2)', lineHeight: 1.5, marginBottom: 20 } as const;
const card = {
  padding: 18,
  borderRadius: 20,
  border: '1px solid var(--cc-line-2)',
  background: 'var(--cc-panel)',
  display: 'grid',
  gap: 8,
} as const;
const download = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 52,
  borderRadius: 16,
  background: 'var(--cc-green)',
  color: '#070809',
  fontWeight: 600,
  textDecoration: 'none',
} as const;
const secondary = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 56,
  padding: '0 24px',
  borderRadius: 16,
  border: '1px solid var(--cc-line-2)',
  color: 'var(--cc-txt)',
  textDecoration: 'none',
  fontSize: 17,
} as const;
