'use client';

// "Tu publicación": how one post is doing on each network. Polls every 3 s
// until the post settles (published, failed or gone), with "Actualizar" to
// check again by hand.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { publishApi, usePublishErrorText } from './api';
import { PlatformTile, platformName } from './common';
import { isTerminalStatus, normalizePlatforms, type PlatformRow } from './types';

interface StatusJson {
  post_id?: string;
  status?: string;
  platforms?: unknown;
  error?: string;
}

export function JobStatus({ postId }: { postId: string }) {
  const t = useTranslations('clipsPublish.job');
  const errText = usePublishErrorText();
  const [status, setStatus] = useState<string>('UNKNOWN');
  const [rows, setRows] = useState<PlatformRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    return publishApi<StatusJson>(`status/${encodeURIComponent(postId)}.json`).then((r) => {
      setLoaded(true);
      if (!r.ok) {
        if (r.error.status === 404) {
          setNotFound(true);
          setStatus('UNAVAILABLE');
        } else setErr(errText(r.error));
        return;
      }
      setErr(null);
      const st = String(r.data.status ?? 'UNKNOWN').toUpperCase();
      setStatus(st);
      setRows(normalizePlatforms(r.data.platforms));
    });
  }, [errText, postId]);

  useEffect(() => {
    void refresh();
    timer.current = setInterval(() => void refresh(), 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once
  }, []);

  useEffect(() => {
    if ((isTerminalStatus(status) || notFound) && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [notFound, status]);

  const terminal = isTerminalStatus(status) || notFound;
  const kind =
    status === 'PUBLISHED' || status === 'FINISHED' || status === 'SUCCESS'
      ? 'ok'
      : status === 'FAILED' || status === 'ERROR'
        ? 'bad'
        : status === 'UNAVAILABLE'
          ? 'gray'
          : 'acc';

  return (
    <div className="ch-pub">
      <div className="ch-pub__head">
        <div>
          <h2 className="ch-h2">{t('title')}</h2>
          <p className="ch-muted" style={{ fontSize: 14, wordBreak: 'break-all' }}>
            {postId}
          </p>
        </div>
        <div className="ch-pub-row">
          <span className={`ch-pill ch-pill--${kind}`} role="status" aria-live="polite">
            {t.has(`status.${status}`) ? t(`status.${status}`) : status}
            {!terminal && ' …'}
          </span>
          <button
            type="button"
            className="ch-btn ch-btn--gray ch-btn--tiny"
            disabled={busy}
            title={t('refreshHint')}
            onClick={async () => {
              setBusy(true);
              await refresh();
              setBusy(false);
            }}
          >
            <RefreshCw aria-hidden="true" />
            {t('refresh')}
          </button>
        </div>
      </div>
      {err && (
        <div className="ch-bnr ch-bnr--warn" role="alert">
          <span className="ch-bnr__tx">{err}</span>
        </div>
      )}
      {notFound ? (
        <div className="ch-card ch-state">
          <h2 className="ch-h2">{t('gone.title')}</h2>
          <p className="ch-muted">{t('gone.body')}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="ch-card ch-state">
          <h2 className="ch-h2">
            {!loaded || !terminal
              ? t('loading.title')
              : status === 'FAILED' || status === 'ERROR'
                ? t('failed.title')
                : t('noDetail.title')}
          </h2>
          <p className="ch-muted">
            {!loaded || !terminal
              ? t('loading.body')
              : status === 'FAILED' || status === 'ERROR'
                ? t('failed.body')
                : t('noDetail.body')}
          </p>
        </div>
      ) : (
        <div className="ch-pub-fields">
          {rows.map((r, i) => (
            <section key={`${r.platform}-${i}`} className="ch-card ch-pub-sec">
              <header>
                <PlatformTile id={r.platform || '?'} />
                <h3>{r.platform ? platformName(r.platform) : t('network')}</h3>
                <span
                  className={`ch-pill ch-pill--${r.ok ? 'ok' : /FAILED|ERROR/.test(r.status) ? 'bad' : 'acc'} ch-pub__push`}
                >
                  {r.ok
                    ? t('status.PUBLISHED')
                    : /FAILED|ERROR/.test(r.status)
                      ? t('status.FAILED')
                      : t.has(`status.${r.status}`)
                        ? t(`status.${r.status}`)
                        : r.status}
                </span>
              </header>
              {r.url && (
                <a className="ch-lnk" href={r.url}>
                  <ExternalLink aria-hidden="true" style={{ width: 16, height: 16 }} />{' '}
                  {t('seePost')}
                </a>
              )}
              {r.postId && (
                <small className="ch-pub-hint">{t('platformId', { id: r.postId })}</small>
              )}
              {r.error && <p className="ch-pub-err">{r.error}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
