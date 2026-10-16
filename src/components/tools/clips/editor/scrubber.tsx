'use client';

// Under the preview: the audio waveform (tap to jump), a draggable
// scrubber, and the AI's timeline of moments (voice trigger, audio peaks,
// scene cuts, reactions, chat heat…), each one tap away.

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { TimelineMarker } from '@/lib/tools/adapters/clips/editor-types';
import { mmss } from './presets';

const W = 200;
const H = 36;

export function Scrubber({
  t,
  duration,
  peaks,
  markers,
  markersLoaded,
  onSeek,
}: {
  t: number;
  duration: number;
  /** null while loading; [] when the clip has no audio. */
  peaks: number[] | null;
  markers: TimelineMarker[];
  markersLoaded: boolean;
  onSeek: (seconds: number) => void;
}) {
  const tr = useTranslations('clipsEditor.preview');
  const bar = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const frac = duration > 0 ? Math.max(0, Math.min(1, t / duration)) : 0;
  const played = peaks ? Math.floor(frac * peaks.length) : 0;

  const seekFromX = (el: Element, clientX: number) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || duration <= 0) return;
    onSeek(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * duration);
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromX(e.currentTarget, e.clientX);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) seekFromX(e.currentTarget, e.clientX);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') onSeek(Math.max(0, t - step));
    else if (e.key === 'ArrowRight') onSeek(Math.min(duration, t + step));
    else if (e.key === 'Home') onSeek(0);
    else if (e.key === 'End') onSeek(duration);
    else return;
    e.preventDefault();
  };

  return (
    <div className="ch-ce__scrub">
      <svg
        className="ch-ce__wave"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        onClick={(e) => seekFromX(e.currentTarget, e.clientX)}
        aria-hidden="true"
      >
        {peaks === null || peaks.length === 0 ? (
          <text x={W / 2} y={22} textAnchor="middle" className="ch-ce__wave-empty">
            {peaks === null ? tr('loadingAudio') : tr('noAudio')}
          </text>
        ) : (
          peaks.map((p, i) => {
            const bw = W / peaks.length;
            const bh = Math.max(1, p * H * 0.95);
            return (
              <rect
                key={i}
                className={i < played ? 'is-played' : undefined}
                x={i * bw}
                y={(H - bh) / 2}
                width={Math.max(0.5, bw - 0.3)}
                height={bh}
              />
            );
          })
        )}
        {peaks && peaks.length > 0 ? (
          <line className="ch-ce__wave-head" x1={frac * W} x2={frac * W} y1={0} y2={H} />
        ) : null}
      </svg>
      <div
        ref={bar}
        className="ch-ce__bar"
        role="slider"
        tabIndex={0}
        aria-label={tr('scrubber')}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(t)}
        aria-valuetext={mmss(t)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onKey}
      >
        <span className="ch-ce__bar-fill" style={{ width: `${(frac * 100).toFixed(2)}%` }} />
        <span className="ch-ce__bar-handle" style={{ left: `${(frac * 100).toFixed(2)}%` }} />
      </div>
      <div className="ch-ce__times">
        <span>{mmss(t)}</span>
        <span>{mmss(duration)}</span>
      </div>

      <section className="ch-ce__timeline" aria-label={tr('timeline')}>
        <div className="ch-ce__rail">
          {markers.map((m, i) => (
            <button
              key={i}
              type="button"
              className={`ch-ce__mark ch-ce__mark--${m.kind}`}
              style={{
                left: `${duration > 0 ? Math.max(0, Math.min(100, (m.ts / duration) * 100)) : 0}%`,
              }}
              title={`${mmss(m.ts)} · ${m.label}`}
              aria-label={tr('seekTo', { label: m.label, t: mmss(m.ts) })}
              onClick={() => onSeek(m.ts)}
            />
          ))}
        </div>
        {markersLoaded && markers.length === 0 ? (
          <p className="ch-muted ch-ce__timeline-empty">{tr('timelineEmpty')}</p>
        ) : (
          <ul className="ch-ce__legend">
            {markers.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="ch-ce__legend-row"
                  title={tr('seekHint')}
                  onClick={() => onSeek(m.ts)}
                >
                  <span className="ch-ce__legend-ts">{mmss(m.ts)}</span>
                  <span className={`ch-ce__legend-dot ch-ce__mark--${m.kind}`} aria-hidden="true" />
                  <span className="ch-ce__legend-label">{m.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
