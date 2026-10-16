'use client';

// "Descargar": the engine renders the edited clip (overlays + captions
// burned in) at the chosen quality, we wait with the person, then the file
// downloads in the same tab. 2K/4K only when the plan includes them (the
// engine falls back to 1080p otherwise, so we say so up front).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, RotateCcw } from 'lucide-react';
import {
  EXPORT_QUALITIES,
  type ExportQuality,
  type RenderStatus,
} from '@/lib/tools/adapters/clips/editor-types';
import { BFF, call, clipPath, EditorCallError } from './api';
import { ErrorLine } from './error-line';

const POLL_MS = 1500;

export function ExportPanel({
  clipId,
  allowed,
  beforeRender,
  autoStart,
}: {
  clipId: string;
  /** Qualities the plan includes (from the engine). */
  allowed: string[];
  /** Save unsaved changes first, so the file matches the preview. */
  beforeRender: () => Promise<boolean>;
  /** ?export=… : start right away (a download link that wasn't ready). */
  autoStart: ExportQuality | null;
}) {
  const t = useTranslations('clipsEditor.export');
  const [quality, setQuality] = useState<ExportQuality>(
    autoStart && allowed.includes(autoStart) ? autoStart : '1080',
  );
  const [status, setStatus] = useState<RenderStatus | null>(null);
  const [error, setError] = useState<EditorCallError | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef<AbortController | null>(null);
  const started = useRef(false);
  useEffect(() => () => alive.current?.abort(), []);

  const download = useCallback(
    (q: ExportQuality) => {
      // Same tab: the BFF answers Content-Disposition: attachment.
      window.location.assign(`${BFF}/${clipPath(clipId, `download?quality=${q}`)}`);
    },
    [clipId],
  );

  /** Wait for a render in flight, polling its status. */
  const waitFor = useCallback(
    async (q: ExportQuality, signal: AbortSignal): Promise<RenderStatus | null> => {
      for (;;) {
        await new Promise((r) => window.setTimeout(r, POLL_MS));
        if (signal.aborted) return null;
        const s = await call<RenderStatus>(clipPath(clipId, `render-status?quality=${q}`), {
          signal,
        });
        setStatus(s);
        if (s.state !== 'rendering') return s;
      }
    },
    [clipId],
  );

  const start = useCallback(
    async (q: ExportQuality) => {
      alive.current?.abort();
      const ctl = new AbortController();
      alive.current = ctl;
      setError(null);
      setBusy(true);
      try {
        if (!(await beforeRender())) return;
        let s = await call<RenderStatus>(clipPath(clipId, `render?quality=${q}`), {
          method: 'POST',
          signal: ctl.signal,
        });
        setStatus(s);
        if (s.state === 'rendering') s = (await waitFor(q, ctl.signal)) ?? s;
        if (s.state === 'ready' && !ctl.signal.aborted) download(q);
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError'))
          setError(err instanceof EditorCallError ? err : new EditorCallError(0, null));
      } finally {
        if (alive.current === ctl) setBusy(false);
      }
    },
    [beforeRender, clipId, download, waitFor],
  );

  const retry = async () => {
    setError(null);
    setBusy(true);
    try {
      await call<RenderStatus>(clipPath(clipId, `render-retry?quality=${quality}`), {
        method: 'POST',
      });
      await start(quality);
    } catch (err) {
      setBusy(false);
      setError(err instanceof EditorCallError ? err : new EditorCallError(0, null));
    }
  };

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void start(allowed.includes(autoStart) ? autoStart : '1080');
    }
  }, [autoStart, allowed, start]);

  const locked = EXPORT_QUALITIES.some((q) => !allowed.includes(q));
  const rendering = busy || status?.state === 'rendering';
  return (
    <section className="ch-card ch-ce__export" aria-labelledby="ce-export">
      <h2 id="ce-export" className="ch-ce__h3">
        {t('title')}
      </h2>
      <fieldset className="ch-ce__qual">
        <legend className="ch-sr">{t('quality')}</legend>
        <div className="ch-seg">
          {EXPORT_QUALITIES.map((q) => (
            <label key={q}>
              <input
                type="radio"
                name="ce-quality"
                value={q}
                checked={quality === q}
                disabled={!allowed.includes(q) || rendering}
                onChange={() => {
                  setQuality(q);
                  setStatus(null);
                }}
              />
              <span className="ch-chip ch-chip--sm">{t(`qualities.${q}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {locked ? <p className="ch-muted ch-ce__hint">{t('qualityLocked')}</p> : null}

      {status?.state === 'failed' && !rendering ? (
        <div className="ch-ce__flash ch-ce__flash--bad" role="alert">
          <p>
            <b>{t('failed')}</b>
            {status.error ? <span className="ch-ce__err-detail"> {status.error}</span> : null}
          </p>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            onClick={retry}
          >
            <RotateCcw aria-hidden="true" />
            {t('retry')}
          </button>
        </div>
      ) : null}

      {rendering ? (
        <div className="ch-ce__progress" role="status" aria-live="polite">
          <div className="ch-progress">
            <span style={{ width: `${Math.max(4, status?.progress_pct ?? 0)}%` }} />
          </div>
          <p className="ch-muted">{t('rendering', { n: status?.progress_pct ?? 0 })}</p>
        </div>
      ) : (
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-ce__dl"
          onClick={() => (status?.state === 'ready' ? download(quality) : start(quality))}
        >
          <Download aria-hidden="true" />
          {t('download')}
        </button>
      )}
      {status?.state === 'ready' && !rendering ? (
        <p className="ch-muted" role="status">
          {t('ready')}
        </p>
      ) : null}
      {error ? <ErrorLine error={error} /> : null}
    </section>
  );
}
