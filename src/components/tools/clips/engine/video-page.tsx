// One video's page in mode "a" (/app/clips/videos/[id]): how the process is
// going (steps, refreshes itself while it runs), what came out (clips with
// their score and why the AI picked them, playable and downloadable), what it
// cost in tokens, and the actions (approve all, download the approved ones,
// run again, delete). Replaces the engine's stream page.

import type { Route } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Check, TriangleAlert, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { EngineStep, EngineStreamDetail } from '@/lib/tools/adapters/clips/engine-api';
import { mmss } from '@/lib/tools/clips-home';
import { ToolShell } from '@/components/tools/tool-shell';
import { AutoRefresh } from '@/components/app/clips/auto-refresh';
import { Pill } from '@/components/ui/primitives';
import { StreamActions } from './stream-actions';
import { streamActionsCopy } from './copy';
import '@/styles/tools-clips.css';
import '@/styles/tools-clips-engine.css';

function stepTime(s: EngineStep, t: (k: string, v?: Record<string, string | number>) => string) {
  if (s.status === 'running' && s.elapsed_s != null)
    return t('step.elapsed', { t: dur(s.elapsed_s) });
  if (s.status === 'done' && s.skipped && s.name !== 'diarize') return t('step.skipped');
  if (s.status === 'done' && s.duration_s != null) return dur(s.duration_s);
  return '';
}

function dur(sec: number): string {
  if (sec < 60) return `${Math.max(0, Math.round(sec))} s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min`;
}

export async function EngineVideoPage({
  d,
  editorReady,
}: {
  d: EngineStreamDetail;
  editorReady: boolean;
}) {
  const t = await getTranslations('clipsEngine.video');
  const locale = await getLocale();
  const nf = new Intl.NumberFormat(locale);
  const { stream, overview, progress, cost } = d;
  const kind = overview.status_kind;
  const live = kind === 'running' || kind === 'pending';
  const failed = progress.has_failed || progress.is_abandoned;
  const showSteps = live || failed || overview.total_clips === 0;
  const defaultPersona = d.personas[0]?.id ?? null;
  const title = stream.title || stream.channel || t('untitled');

  return (
    <ToolShell slug="chalybclip" tab="history">
      {live && !failed && <AutoRefresh everyMs={4000} />}
      <div className="ch-ce-stack">
        <Link href={'/app/clips/videos' as Route} className="ch-lnk">
          {t('back')}
        </Link>
        <header className="ch-ce-head">
          <div>
            <h2 className="ch-h2">{title}</h2>
            <p className="ch-muted">
              {stream.duration_s > 0 && `${mmss(stream.duration_s)} · `}
              {t(`status.${failed ? 'failed' : kind}`)}
            </p>
          </div>
        </header>

        {kind === 'complete' && (
          <section className="ch-card ch-ce-card" aria-labelledby="v-sum">
            <h3 id="v-sum" className="ch-h3">
              {overview.total_clips > 0 ? t('done.title') : t('done.none')}
            </h3>
            <div className="ch-ce-kpis">
              <div className="ch-ce-kpi">
                <b>{overview.total_clips}</b>
                <small>{t('kpi.clips')}</small>
              </div>
              <div className="ch-ce-kpi">
                <b>{overview.ready_count}</b>
                <small>{t('kpi.ready')}</small>
              </div>
              <div className="ch-ce-kpi">
                <b>{overview.moments_detected}</b>
                <small>{t('kpi.moments')}</small>
              </div>
              <div className="ch-ce-kpi">
                <b>{t('kpi.minutes', { n: overview.time_saved_min })}</b>
                <small>{t('kpi.saved')}</small>
              </div>
            </div>
            {overview.best_score != null && (
              <p className="ch-muted">
                {t('best', { n: overview.best_score })} · {t('platforms')}{' '}
                {overview.suggested_platforms.join(' · ')}
              </p>
            )}
          </section>
        )}

        <div className="ch-ce-video">
          <div className="ch-ce-stack">
            {showSteps && (
              <section className="ch-card ch-ce-card" aria-labelledby="v-prog">
                <h3 id="v-prog" className="ch-h3">
                  {progress.is_done
                    ? t('progress.done')
                    : failed
                      ? progress.is_abandoned
                        ? t('progress.abandoned')
                        : t('progress.failed')
                      : t('progress.working')}
                </h3>
                <p className="ch-ce-note">
                  {t('progress.counts', {
                    m: progress.candidate_count,
                    c: progress.clip_count,
                  })}
                </p>
                <ol className="ch-ce-steps">
                  {progress.steps.map((s) => (
                    <li key={s.name} className="ch-ce-step" data-s={s.status}>
                      <span className="ch-ce-step__dot" aria-hidden="true">
                        {s.status === 'done' && <Check />}
                        {s.status === 'failed' && <X />}
                        {s.status === 'abandoned' && <TriangleAlert />}
                      </span>
                      <span>
                        {t(`steps.${s.name}`)}
                        <span className="ch-sr">{` · ${t(`stepStatus.${s.status}`)}`}</span>
                      </span>
                      <span className="ch-ce-step__time">{stepTime(s, t)}</span>
                    </li>
                  ))}
                </ol>
                {progress.steps.some(
                  (s) => s.status === 'running' && (s.elapsed_s ?? 0) > 3600,
                ) && <p className="ch-ce-note">{t('progress.long')}</p>}
                {failed && (
                  <p className="ch-ce-err" role="alert">
                    {t(
                      `failure.${progress.failure?.kind ?? progress.steps.find((s) => s.error_kind)?.error_kind ?? 'other'}`,
                    )}
                  </p>
                )}
                {progress.failure?.error && (
                  <p className="ch-ce-note">
                    <b>{t('adminError')}</b> {progress.failure.error_type}: {progress.failure.error}
                  </p>
                )}
              </section>
            )}

            {d.clips.length > 0 && (
              <section className="ch-ce-stack" aria-labelledby="v-clips">
                <h3 id="v-clips" className="ch-ghead">
                  {t('clipsTitle', { n: d.clips.length })}
                </h3>
                <div className="ch-ce-timeline" aria-hidden="true">
                  {d.clips.map((c) => (
                    <span
                      key={c.id}
                      style={{
                        left: `${c.timeline_left_pct ?? 0}%`,
                        width: `${c.timeline_width_pct ?? 1}%`,
                      }}
                    />
                  ))}
                </div>
                <ul className="ch-ce-clips">
                  {d.clips.map((c, i) => (
                    <li
                      key={c.id}
                      className={`ch-ce-clip${c.id === overview.best_clip_id ? ' ch-ce-clip--best' : ''}`}
                    >
                      {c.media_url && (
                        <video
                          src={c.media_url}
                          poster={c.thumb_url ?? undefined}
                          controls
                          preload="none"
                          playsInline
                          aria-label={t('clipN', { n: i + 1 })}
                        />
                      )}
                      <b>{c.title || t('clipN', { n: i + 1 })}</b>
                      <div className="ch-ce-clip__meta">
                        {c.id === overview.best_clip_id && <Pill kind="acc">{t('topPick')}</Pill>}
                        <Pill
                          kind={
                            c.status === 'approved' || c.status === 'published'
                              ? 'ok'
                              : c.status === 'rejected'
                                ? 'bad'
                                : 'gray'
                          }
                        >
                          {t(
                            `clipStatus.${['cut', 'ready_for_review', 'approved', 'published', 'rejected'].includes(c.status) ? c.status : 'cut'}`,
                          )}
                        </Pill>
                        {c.viral_score != null && <span>{t('score', { n: c.viral_score })}</span>}
                        <span className="ch-muted">
                          {mmss(c.start_s)}–{mmss(c.end_s)}
                        </span>
                      </div>
                      {c.why && (
                        <ul className="ch-ce-clip__signals" aria-label={t('why')}>
                          <li>{t(`reason.${c.why.reason}`)}</li>
                          {c.why.phrase && <li>{t('said', { frase: c.why.phrase })}</li>}
                          {c.why.speaker && <li>{t('speaker', { nombre: c.why.speaker })}</li>}
                          {c.why.confirmed && <li>{t('confirmed')}</li>}
                        </ul>
                      )}
                      <div className="ch-ce-actions">
                        {editorReady && (
                          <Link
                            href={`/app/clips/${encodeURIComponent(c.id)}` as Route}
                            className="ch-btn ch-btn--secondary ch-btn--compact"
                          >
                            {t('edit')}
                          </Link>
                        )}
                        {c.download_url && (
                          <a
                            href={c.download_url}
                            className="ch-btn ch-btn--secondary ch-btn--compact"
                          >
                            {t('download')}
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="ch-ce-stack">
            <section className="ch-card ch-ce-card" aria-labelledby="v-act">
              <h3 id="v-act" className="ch-h3">
                {t('actionsTitle')}
              </h3>
              <StreamActions
                streamId={stream.id}
                copy={await streamActionsCopy()}
                pendingApproval={d.pending_approval_count}
                readyCount={overview.ready_count}
                canRerun={(failed || kind === 'complete') && d.can_rerun && !progress.in_flight}
                personas={d.personas.map((p) => ({ id: p.id, name: p.name }))}
                defaultPersona={defaultPersona}
              />
            </section>
            <section className="ch-card ch-ce-card" aria-labelledby="v-cost">
              <h3 id="v-cost" className="ch-h3">
                {t('cost.title')}
              </h3>
              {cost.tokens_used != null ? (
                <>
                  <p>
                    <b>{t('cost.used', { n: nf.format(cost.tokens_used) })}</b>
                  </p>
                  <ul className="ch-ce-clip__signals">
                    {cost.tokens_by_source.map((s) => (
                      <li key={s.label}>
                        {s.label === 'base' ? t('cost.base') : s.label}: {nf.format(s.tokens)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="ch-muted">{t('cost.none')}</p>
              )}
              <p className="ch-ce-note">
                {t('cost.estimate', { n: nf.format(cost.estimate_tokens) })}
                {cost.unlimited
                  ? ` · ${t('cost.unlimited')}`
                  : cost.runs_available == null
                    ? ''
                    : cost.runs_available > 0
                      ? ` · ${t('cost.runs', { n: cost.runs_available })}`
                      : ` · ${t('cost.runsNone')}`}
              </p>
              {cost.usd_micros != null && (
                <p className="ch-ce-note">
                  {t('cost.usd', { n: (cost.usd_micros / 1_000_000).toFixed(4) })}
                </p>
              )}
            </section>
            <section className="ch-card ch-ce-card ch-ce-source" aria-labelledby="v-src">
              <h3 id="v-src" className="ch-h3">
                {t('source.title')}
              </h3>
              {d.source_url ? (
                <video
                  src={d.source_url}
                  controls
                  preload="none"
                  playsInline
                  aria-label={t('source.title')}
                />
              ) : (
                <p className="ch-ce-note">{t('source.gone')}</p>
              )}
              {stream.vod_url && /^https?:\/\//i.test(stream.vod_url) && (
                <a href={stream.vod_url} className="ch-lnk" rel="noopener noreferrer">
                  {t('source.link')}
                </a>
              )}
            </section>
          </aside>
        </div>
      </div>
    </ToolShell>
  );
}
