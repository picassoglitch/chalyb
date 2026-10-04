// "En proceso" row (TOOLS-SPEC §3 JobProgressRow, §4.1): what's being made,
// which step, about how long (only when the engine says), and "Ver avance".
// A failed job turns amber with the reason, "No se usaron créditos." when
// the adapter confirms it, and "Intentar otra vez".

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { manualRetryAllowed, type ClipJob } from '@/lib/tools/adapters/types';
import { jobProgress, thumbFor } from '@/lib/tools/clips-home';
import { platformName } from '@/lib/tools/clips-copy';
import { retryClipJob } from '@/lib/tools/clips-actions';
import { failureBody } from './failure-copy';

export async function JobProgressRow({ job, noCharge }: { job: ClipJob; noCharge: boolean }) {
  const t = await getTranslations('clipsTool.home.row');
  const ts = await getTranslations('clipsTool.home.steps');
  const locale = await getLocale();
  const titulo = job.title ?? platformName(job.sourceUrl) ?? 'Clips';

  if (job.state === 'failed') {
    return (
      <li className="ch-jobrow ch-jobrow--failed">
        <span
          className="ch-jobrow__thumb"
          style={{ background: thumbFor(job.id) }}
          aria-hidden="true"
        />
        <div className="ch-jobrow__tx" role="alert">
          <b>{t('failed', { titulo })}</b>
          <span className="ch-muted">
            {await failureBody(job.reason ?? 'unknown', job.sourceUrl, locale)}
            {noCharge && <> {t('noCharge')}</>}
          </span>
        </div>
        {manualRetryAllowed(job) && (
          <form action={retryClipJob}>
            <input type="hidden" name="jobId" value={job.id} />
            <button type="submit" className="ch-btn ch-btn--gray ch-btn--compact">
              {t('retry')}
            </button>
          </form>
        )}
      </li>
    );
  }

  const p = jobProgress(job.state);
  return (
    <li className="ch-jobrow">
      <span
        className="ch-jobrow__thumb"
        style={{ background: thumbFor(job.id) }}
        aria-hidden="true"
      />
      <div className="ch-jobrow__tx">
        <b>{t('title', { titulo })}</b>
        <span className="ch-muted">
          {t('step', { paso: ts(p.key) })}
          {job.etaMinutes ? <> {t('eta', { n: job.etaMinutes })}</> : null}
        </span>
      </div>
      <div className="ch-jobrow__bar">
        <div
          className="ch-jobrow__track"
          role="progressbar"
          aria-valuenow={p.pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('progress', { titulo })}
        >
          <span style={{ width: `${p.pct}%` }} />
        </div>
        <span className="ch-jobrow__meta">
          <span>{t('stepOf', { n: p.step })}</span>
          <b>{p.pct}%</b>
        </span>
      </div>
      <Link
        href={`/app/clips/trabajo/${encodeURIComponent(job.id)}` as Route}
        className="ch-btn ch-btn--gray ch-btn--compact"
      >
        {t('see')}
      </Link>
    </li>
  );
}
