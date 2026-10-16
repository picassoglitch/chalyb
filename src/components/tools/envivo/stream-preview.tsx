'use client';

// The live preview (HLS) through the hub's proxy. Before the first frame the
// encoder card sits inside the player; once video arrives it takes its place.
// Transient errors after a signal keep the last frame ("Reconectando…");
// only sustained failure raises "Se perdió la señal". A refused preview
// address (the 30-minute token ran out) is renewed and the player restarts.
// Same behaviour as the engine's player (ChalyOBS StreamPreview).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type Hls from 'hls.js';

type State = 'connecting' | 'live' | 'reconnecting' | 'error' | 'unavailable';

const MAX_FATAL_BEFORE_ALERT = 6;

async function freshUrl(): Promise<string | null> {
  try {
    const res = await fetch('/api/tools/chalybobs/preview-url', { cache: 'no-store' });
    const json = (await res.json()) as { ok: boolean; data?: { url: string | null } };
    return json.ok ? (json.data?.url ?? null) : null;
  } catch {
    return null;
  }
}

export function StreamPreview({
  initialUrl,
  offline,
}: {
  /** Null: the engine has no preview to show (the card stays). */
  initialUrl: string | null;
  offline: ReactNode;
}) {
  const t = useTranslations('liveTool.room');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [state, setState] = useState<State>(initialUrl ? 'connecting' : 'unavailable');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!url || !video) return;
    let cancelled = false;
    let hls: Hls | null = null;
    let fatal = 0;
    let hadSignal = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let detach: (() => void) | null = null;
    const live = () => {
      if (cancelled) return;
      hadSignal = true;
      fatal = 0;
      setState('live');
    };
    const renew = () => {
      void freshUrl().then((next) => {
        if (cancelled) return;
        if (next) setUrl(next);
        else setState('unavailable');
      });
    };

    void import('hls.js').then(({ default: HlsCtor }) => {
      if (cancelled) return;
      // Safari / iOS play HLS natively. An error there says nothing about
      // why, so ask the proxy: a refused (expired) address gets renewed.
      if (!HlsCtor.isSupported() && video.canPlayType('application/vnd.apple.mpegurl')) {
        const onError = () => {
          if (cancelled) return;
          setState(hadSignal ? 'reconnecting' : 'connecting');
          void fetch(url, { cache: 'no-store' })
            .then((r) => {
              if (cancelled) return;
              if (r.status === 401 || r.status === 403) renew();
              else timer = setTimeout(() => !cancelled && video.load(), 3000);
            })
            .catch(() => {
              if (!cancelled) timer = setTimeout(() => !cancelled && video.load(), 3000);
            });
        };
        video.addEventListener('playing', live);
        video.addEventListener('error', onError);
        detach = () => {
          video.removeEventListener('playing', live);
          video.removeEventListener('error', onError);
          video.removeAttribute('src');
          video.load();
        };
        video.src = url;
        video.play().catch(() => {});
        return;
      }
      if (!HlsCtor.isSupported()) return;
      hls = new HlsCtor({
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 6,
        fragLoadingMaxRetry: 8,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        if (!cancelled) video.play().catch(() => {});
      });
      hls.on(HlsCtor.Events.FRAG_BUFFERED, live);
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (cancelled || !data.fatal) return;
        const code = data.response?.code;
        if (code === 401 || code === 403) {
          hls?.destroy();
          renew();
          return;
        }
        fatal += 1;
        if (!hadSignal) {
          // "No publisher yet": stay calm and keep asking for the manifest.
          setState('connecting');
          if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
          return;
        }
        if (fatal < MAX_FATAL_BEFORE_ALERT) {
          setState('reconnecting');
          if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) hls?.startLoad();
          else if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError();
          else timer = setTimeout(() => !cancelled && setAttempt((a) => a + 1), 3000);
          return;
        }
        setState('error');
        hls?.destroy();
      });
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      hls?.destroy();
      detach?.();
    };
  }, [url, attempt]);

  const showVideo = state === 'live' || state === 'reconnecting';
  return (
    <div className={`ch-ev-player${showVideo ? ' ch-ev-player--video' : ''}`}>
      <video
        ref={videoRef}
        className="ch-ev-player__v"
        muted
        playsInline
        controls={state === 'live'}
        hidden={!showVideo}
        aria-label={t('previewLabel')}
      />
      {state === 'live' && <span className="ch-ev-player__tag">{t('live')}</span>}
      {state === 'reconnecting' && (
        <span className="ch-ev-player__tag ch-ev-player__tag--warn" role="status">
          {t('reconnecting')}
        </span>
      )}
      {state === 'error' && (
        <div className="ch-ev-player__lost" role="alert">
          <b>{t('lost')}</b>
          <p className="ch-muted">{t('lostBody')}</p>
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            onClick={() => {
              setState('connecting');
              setAttempt((a) => a + 1);
            }}
          >
            {t('retry')}
          </button>
        </div>
      )}
      {(state === 'connecting' || state === 'unavailable') && (
        <div className="ch-ev-player__off">
          <p className="ch-ev-player__wait" role="status">
            {state === 'connecting' && <span className="ch-spin" aria-hidden="true" />}
            <span>{state === 'connecting' ? t('waiting') : t('noPreview')}</span>
          </p>
          {offline}
        </div>
      )}
    </div>
  );
}
