'use client';

// Rendimiento: per-post metrics over 7 or 30 days. Missing numbers read "—"
// (never a fake zero). Ad campaigns next to them when ads are on.

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { publishApi, usePublishErrorText } from './api';
import { PlatformList } from './common';
import type { TabProps } from './publish-center';

type Metrics = {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
};

interface Perf {
  days: number;
  totals: Metrics;
  posts: { content?: string | null; metrics?: Metrics; per_platform?: { platform?: string }[] }[];
}

export function PerformanceTab({ ov }: TabProps) {
  const t = useTranslations('clipsPublish.performance');
  const errText = usePublishErrorText();
  const locale = useLocale();
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<Perf | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ads, setAds] = useState<{ id?: string; name?: string; status?: string }[] | null>(null);

  useEffect(() => {
    let live = true;
    void publishApi<Perf>('rendimiento.json', { query: { days: String(days) } }).then((r) => {
      if (!live) return;
      if (r.ok) {
        setErr(null);
        setData(r.data);
      } else setErr(errText(r.error));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on the toggle only
  }, [days]);

  useEffect(() => {
    if (!ov.feature_ads) return;
    void publishApi<{ campaigns?: { id?: string; name?: string; status?: string }[] }>(
      'ads/campaigns.json',
    ).then((r) => setAds(r.ok ? (r.data.campaigns ?? []) : []));
  }, [ov.feature_ads]);

  const fmt = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : v.toLocaleString(locale === 'en' ? 'en' : 'es-MX');

  return (
    <section className="ch-card ch-pub-sec" aria-labelledby="pub-perf-h">
      <header>
        <h2 id="pub-perf-h">{t('title')}</h2>
        <span className="ch-pub__push ch-pub-chips" role="group" aria-label={t('range')}>
          {([7, 30] as const).map((d) => (
            <button
              key={d}
              type="button"
              className="ch-pub-chip"
              aria-pressed={days === d}
              onClick={() => {
                if (d === days) return;
                setData(null);
                setErr(null);
                setDays(d);
              }}
            >
              {t('days', { n: d })}
            </button>
          ))}
        </span>
      </header>
      {err ? (
        <p className="ch-pub-err">{err}</p>
      ) : !data ? (
        <p className="ch-pub-hint">{t('loading')}</p>
      ) : (
        <>
          <p>
            {t.rich('totals', {
              dias: data.days,
              vistas: fmt(data.totals.views),
              likes: fmt(data.totals.likes),
              comentarios: fmt(data.totals.comments),
              compartidos: fmt(data.totals.shares),
              b: (c) => <b>{c}</b>,
            })}
          </p>
          {data.posts.length === 0 ? (
            <div>
              <p>
                <b>{t('empty.title')}</b>
              </p>
              <p className="ch-pub-hint">{t('empty.body')}</p>
            </div>
          ) : (
            <div className="ch-table-wrap" tabIndex={0} aria-label={t('tableAria')}>
              <table className="ch-table">
                <thead>
                  <tr>
                    <th>{t('col.clip')}</th>
                    <th>{t('col.platforms')}</th>
                    <th className="num">{t('col.views')}</th>
                    <th className="num">{t('col.likes')}</th>
                    <th className="num">{t('col.comments')}</th>
                    <th className="num">{t('col.shares')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posts.map((p, i) => (
                    <tr key={i}>
                      <td className="ch-pub-ellipsis">{p.content || t('noCaption')}</td>
                      <td>
                        <PlatformList
                          ids={(p.per_platform ?? []).map((x) => x.platform ?? '').filter(Boolean)}
                        />
                      </td>
                      <td className="num">{fmt(p.metrics?.views)}</td>
                      <td className="num">{fmt(p.metrics?.likes)}</td>
                      <td className="num">{fmt(p.metrics?.comments)}</td>
                      <td className="num">{fmt(p.metrics?.shares)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {ov.feature_ads && (
        <div className="ch-pub-stack">
          <h3 style={{ fontSize: 18 }}>{t('ads')}</h3>
          {ads === null ? (
            <p className="ch-pub-hint">{t('loading')}</p>
          ) : ads.length === 0 ? (
            <p className="ch-pub-hint">{t('noAds')}</p>
          ) : (
            <ul className="ch-pub-list">
              {ads.map((c, i) => (
                <li key={c.id ?? i} className="ch-pub-item">
                  <span className="ch-pub-item__tx">
                    <b>{c.name || c.id}</b>
                  </span>
                  {c.status && <span className="ch-pill ch-pill--gray">{c.status}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
