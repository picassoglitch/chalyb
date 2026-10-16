'use client';

// The "why" behind the verdict, closed by default: the four AI scores with
// their evidence, the detection breakdown, and the publishing results per
// app once a clip is out.

import { useTranslations } from 'next-intl';
import { ChartLine, Rocket, SearchCheck } from 'lucide-react';
import type { EditorPayload } from '@/lib/tools/adapters/clips/editor-types';

const f3 = (n: number) => n.toFixed(3);
const f2 = (n: number) => n.toFixed(2);
const pct = (n: number) => `${Math.round(n * 100)}%`;
const sign3 = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(3)}`;
const num = (n: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('es-MX'));

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="ch-ce__ev">
      <span className="ch-ce__ev-k">{k}</span>
      <span className="ch-ce__ev-v">{children}</span>
    </div>
  );
}

export function Analysis({ payload }: { payload: EditorPayload }) {
  const t = useTranslations('clipsEditor.analysis');
  const s = payload.ai_scores;
  const b = payload.breakdown;
  const lvl = (v: string) => (t.has(`levels.${v}`) ? t(`levels.${v}`) : v);
  return (
    <div className="ch-ce__analysis">
      {s ? (
        <details className="ch-card ch-ce__details">
          <summary>
            <ChartLine aria-hidden="true" />
            <b>{t('why')}</b>
            <span className="ch-muted">· {t('whySub')}</span>
          </summary>
          <div className="ch-ce__scores">
            <article className="ch-ce__score">
              <h4>{t('viral')}</h4>
              <p className="ch-ce__score-big">
                {s.viral_score}
                <small> / 100</small>
              </p>
              <div className="ch-progress">
                <span style={{ width: `${s.viral_score}%` }} />
              </div>
              <Row k={t('trigger')}>
                <code>{b.heuristic_reason}</code>{' '}
                <span className="ch-muted">{f3(b.heuristic_score)}</span>
              </Row>
              {b.reaction_confidence !== null ? (
                <Row k={t('visionCheck')}>
                  {f3(b.reaction_confidence)}
                  {b.rescore_delta !== null ? (
                    <span className="ch-muted"> Δ {sign3(b.rescore_delta)}</span>
                  ) : null}
                </Row>
              ) : null}
              {b.face_presence !== null ? (
                <Row k={t('face')}>
                  {pct(b.face_presence)} <span className="ch-muted">{t('faceUnit')}</span>
                </Row>
              ) : null}
              {b.motion_score !== null ? (
                <Row k={t('motion')}>
                  {f3(b.motion_score)} <span className="ch-muted">{t('motionUnit')}</span>
                </Row>
              ) : null}
              <p className="ch-muted ch-ce__score-why">{s.viral_why}</p>
            </article>
            <article className="ch-ce__score">
              <h4>{t('hook')}</h4>
              <span className={`ch-pill ch-ce__lvl ch-ce__lvl--${s.hook_strength.toLowerCase()}`}>
                {lvl(s.hook_strength)}
              </span>
              <Row k={t('viral')}>{s.viral_score} / 100</Row>
              <p className="ch-muted ch-ce__score-why">{s.hook_why}</p>
            </article>
            <article className="ch-ce__score">
              <h4>{t('readability')}</h4>
              <span
                className={`ch-pill ch-ce__lvl ch-ce__lvl--${s.caption_readability.toLowerCase()}`}
              >
                {lvl(s.caption_readability)}
              </span>
              {b.speaking_intensity !== null ? (
                <>
                  <Row k={t('pace')}>
                    {f2(b.speaking_intensity)} <span className="ch-muted">{t('paceUnit')}</span>
                  </Row>
                  <Row k={t('sweet')}>0.8 – 2.2</Row>
                </>
              ) : (
                <p className="ch-muted">{t('noTranscript')}</p>
              )}
              <p className="ch-muted ch-ce__score-why">{s.readability_why}</p>
            </article>
            <article className="ch-ce__score">
              <h4>{t('deadAir')}</h4>
              <span
                className={`ch-pill ch-ce__lvl ch-ce__lvl--risk-${s.dead_air_risk.toLowerCase()}`}
              >
                {lvl(s.dead_air_risk)}
              </span>
              {b.speaking_intensity !== null ? (
                <>
                  <Row k={t('talk')}>
                    {f2(b.speaking_intensity)} <span className="ch-muted">{t('paceUnit')}</span>
                  </Row>
                  <Row k={t('riskLevels')}>{t('riskScale')}</Row>
                </>
              ) : null}
              <p className="ch-muted ch-ce__score-why">{s.dead_air_why}</p>
            </article>
          </div>
        </details>
      ) : null}

      <details className="ch-card ch-ce__details">
        <summary>
          <SearchCheck aria-hidden="true" />
          <b>{t('breakdown')}</b>
          <span className="ch-muted">· {t('breakdownSub')}</span>
        </summary>
        <div className="ch-table-wrap">
          <table className="ch-table ch-ce__table">
            <tbody>
              <tr>
                <th scope="row">{t('trigger')}</th>
                <td>
                  <code>{b.heuristic_reason}</code> {f3(b.heuristic_score)}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('motion')}</th>
                <td>
                  {b.motion_score !== null ? (
                    <>
                      {f3(b.motion_score)} <span className="ch-muted">{t('motionAvg')}</span>
                    </>
                  ) : (
                    <span className="ch-muted">{t('notAnalyzed')}</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('face')}</th>
                <td>
                  {b.face_presence !== null ? (
                    <>
                      {pct(b.face_presence)} <span className="ch-muted">{t('faceSecs')}</span>
                    </>
                  ) : (
                    <span className="ch-muted">{t('na')}</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('talk')}</th>
                <td>
                  {b.speaking_intensity !== null ? (
                    <>
                      {f2(b.speaking_intensity)} <span className="ch-muted">{t('paceUnit')}</span>
                    </>
                  ) : (
                    <span className="ch-muted">{t('naTranscript')}</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">{t('reaction')}</th>
                <td>
                  {b.reaction_confidence !== null ? (
                    <>
                      {f3(b.reaction_confidence)}{' '}
                      <span className="ch-muted">{t('reactionNote')}</span>
                    </>
                  ) : (
                    <span className="ch-muted">{t('notReviewed')}</span>
                  )}
                </td>
              </tr>
              {b.rescore_delta !== null ? (
                <tr>
                  <th scope="row">{t('delta')}</th>
                  <td>
                    <span
                      className={`ch-pill ${b.rescore_delta >= 0 ? 'ch-pill--ok' : 'ch-pill--bad'}`}
                    >
                      {sign3(b.rescore_delta)}
                    </span>
                  </td>
                </tr>
              ) : null}
              {b.rescore_reason ? (
                <tr>
                  <th scope="row">{t('deltaWhy')}</th>
                  <td>
                    <em>“{b.rescore_reason}”</em>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </details>

      {payload.outcomes.length > 0 ? (
        <details className="ch-card ch-ce__details">
          <summary>
            <Rocket aria-hidden="true" />
            <b>{t('outcomes')}</b>
            <span className="ch-muted">· {t('outcomesSub')}</span>
          </summary>
          <div className="ch-table-wrap">
            <table className="ch-table ch-ce__table">
              <thead>
                <tr>
                  <th scope="col">{t('app')}</th>
                  <th scope="col">{t('link')}</th>
                  <th scope="col">{t('state')}</th>
                  <th scope="col">{t('views')}</th>
                  <th scope="col">{t('likes')}</th>
                  <th scope="col">{t('comments')}</th>
                  <th scope="col">{t('measured')}</th>
                </tr>
              </thead>
              <tbody>
                {payload.outcomes.map((o, i) => (
                  <tr key={i}>
                    <td>{o.platform}</td>
                    <td>
                      {o.external_url && /^https:\/\//.test(o.external_url) ? (
                        <a className="ch-lnk" href={o.external_url} rel="noopener noreferrer">
                          {o.external_url.slice(0, 40)}…
                        </a>
                      ) : (
                        <span className="ch-muted">{o.external_id ?? '—'}</span>
                      )}
                    </td>
                    <td>{o.status}</td>
                    <td>{num(o.views)}</td>
                    <td>{num(o.likes)}</td>
                    <td>{num(o.comments)}</td>
                    <td>
                      {o.fetched_at ? (
                        new Date(o.fetched_at).toLocaleString()
                      ) : (
                        <span className="ch-muted">{t('notMeasured')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}
