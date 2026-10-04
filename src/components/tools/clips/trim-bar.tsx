'use client';

// TrimBar (TOOLS-SPEC §3, mockup 51): a frame strip with two purple handles;
// outside the cut is dimmed. Each handle is a slider: drag it, or ← → for
// 0.1 s and Shift for 1 s. The cut never goes under 5 s.

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import type { ClipTrim } from '@/lib/tools/adapters/types';
import { clampTrim, mmss, nudge, THUMBS } from '@/lib/tools/clips-home';

export function TrimBar({
  trim,
  durationS,
  onChange,
  labels,
}: {
  trim: ClipTrim;
  durationS: number;
  onChange: (t: ClipTrim) => void;
  labels: { start: string; end: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const pct = (s: number) => (durationS > 0 ? (s / durationS) * 100 : 0);

  function move(which: 'start' | 'end', seconds: number) {
    const next = which === 'start' ? { ...trim, startS: seconds } : { ...trim, endS: seconds };
    onChange(clampTrim(next, durationS, which));
  }

  function onKey(which: 'start' | 'end', e: KeyboardEvent<HTMLSpanElement>) {
    const d = nudge(e.key, e.shiftKey);
    if (d === 0) return;
    e.preventDefault();
    move(which, (which === 'start' ? trim.startS : trim.endS) + d);
  }

  function onDrag(which: 'start' | 'end', e: PointerEvent<HTMLSpanElement>) {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = track.current!.getBoundingClientRect();
    const at = (x: number) => ((x - rect.left) / rect.width) * durationS;
    const handler = (ev: globalThis.PointerEvent) => move(which, at(ev.clientX));
    const up = () => {
      el.removeEventListener('pointermove', handler);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', handler);
    el.addEventListener('pointerup', up);
  }

  const handle = (which: 'start' | 'end') => {
    const value = which === 'start' ? trim.startS : trim.endS;
    return (
      <span
        role="slider"
        tabIndex={0}
        aria-label={which === 'start' ? labels.start : labels.end}
        aria-valuemin={0}
        aria-valuemax={durationS}
        aria-valuenow={value}
        aria-valuetext={mmss(value)}
        className={`ch-trim__h ch-trim__h--${which}`}
        style={{ left: `${pct(value)}%` }}
        onKeyDown={(e) => onKey(which, e)}
        onPointerDown={(e) => onDrag(which, e)}
      />
    );
  };

  return (
    <div className="ch-trim" ref={track}>
      <div className="ch-trim__strip" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ background: THUMBS[i % THUMBS.length] }} />
        ))}
      </div>
      <span
        className="ch-trim__dim"
        style={{ left: 0, width: `${pct(trim.startS)}%` }}
        aria-hidden="true"
      />
      <span
        className="ch-trim__dim"
        style={{ left: `${pct(trim.endS)}%`, right: 0 }}
        aria-hidden="true"
      />
      <span
        className="ch-trim__sel"
        style={{ left: `${pct(trim.startS)}%`, width: `${pct(trim.endS - trim.startS)}%` }}
        aria-hidden="true"
      />
      {handle('start')}
      {handle('end')}
    </div>
  );
}
