'use client';

// Manual trim: two handles over the footage the clip can use (the engine's
// window, in stream seconds). Handles snap to word starts/ends when the
// transcript has them; arrows move 0.1 s (Shift: 1 s). "Aplicar recorte"
// re-cuts on the engine, which validates bounds and length again.

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Scissors, RotateCcw } from 'lucide-react';
import type { EditorPayload } from '@/lib/tools/adapters/clips/editor-types';
import { Markup } from '@/components/ui/markup';
import { clampSelection, mmss, snapToWord } from './presets';

export function TrimEditor({
  trim,
  busy,
  onApply,
  error,
}: {
  trim: EditorPayload['trim'];
  busy: boolean;
  onApply: (startS: number, endS: number) => void;
  /** Engine refusal reason (too_short, outside_window…) to explain. */
  error: string | null;
}) {
  const t = useTranslations('clipsEditor.trim');
  const [lo, hi] = trim.window;
  const [sel, setSel] = useState<[number, number]>([trim.start_s, trim.end_s]);
  const track = useRef<HTMLDivElement>(null);
  const span = Math.max(0.001, hi - lo);
  const pct = (s: number) => ((s - lo) / span) * 100;
  const changed = Math.abs(sel[0] - trim.start_s) > 0.01 || Math.abs(sel[1] - trim.end_s) > 0.01;
  const starts = useMemo(() => trim.words.map((w) => w[0]), [trim.words]);
  const ends = useMemo(() => trim.words.map((w) => w[1]), [trim.words]);

  const move = (which: 0 | 1, s: number, snap: boolean) => {
    const snapped = snap ? snapToWord(s, which === 0 ? starts : ends) : s;
    setSel((cur) => {
      const next: [number, number] = which === 0 ? [snapped, cur[1]] : [cur[0], snapped];
      return clampSelection(next, [lo, hi], trim.min_s, trim.max_s, which);
    });
  };

  const onDrag = (which: 0 | 1, e: PointerEvent<HTMLSpanElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const rect = track.current!.getBoundingClientRect();
    const at = (x: number) => lo + ((x - rect.left) / rect.width) * span;
    const handler = (ev: globalThis.PointerEvent) => move(which, at(ev.clientX), true);
    const up = () => {
      el.removeEventListener('pointermove', handler);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', handler);
    el.addEventListener('pointerup', up);
  };
  const onKey = (which: 0 | 1, e: KeyboardEvent<HTMLSpanElement>) => {
    const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    move(which, sel[which] + d * (e.shiftKey ? 1 : 0.1), false);
  };

  const handle = (which: 0 | 1) => (
    <span
      role="slider"
      tabIndex={0}
      aria-label={which === 0 ? t('start') : t('end')}
      aria-valuemin={Math.round(lo * 10) / 10}
      aria-valuemax={Math.round(hi * 10) / 10}
      aria-valuenow={Math.round(sel[which] * 10) / 10}
      aria-valuetext={mmss(sel[which] - lo)}
      className={`ch-ce__trim-h ch-ce__trim-h--${which === 0 ? 'start' : 'end'}`}
      style={{ left: `${pct(sel[which])}%` }}
      onPointerDown={(e) => onDrag(which, e)}
      onKeyDown={(e) => onKey(which, e)}
    />
  );

  return (
    <section className="ch-card ch-ce__trim" aria-labelledby="ce-trim">
      <header className="ch-ce__pv-head">
        <h2 id="ce-trim" className="ch-ce__h3">
          {t('title')}
        </h2>
        <span className="ch-muted">{t('sub')}</span>
      </header>
      <div className="ch-ce__trim-track" ref={track}>
        {trim.words.map((w, i) => (
          <i
            key={i}
            className="ch-ce__trim-word"
            style={{ left: `${pct(w[0])}%`, width: `${Math.max(0.3, pct(w[1]) - pct(w[0]))}%` }}
            aria-hidden="true"
          />
        ))}
        <span className="ch-ce__trim-dim" style={{ left: 0, width: `${pct(sel[0])}%` }} />
        <span className="ch-ce__trim-dim" style={{ left: `${pct(sel[1])}%`, right: 0 }} />
        <span
          className="ch-ce__trim-sel"
          style={{ left: `${pct(sel[0])}%`, width: `${pct(sel[1]) - pct(sel[0])}%` }}
        />
        {handle(0)}
        {handle(1)}
      </div>
      <p className="ch-muted ch-ce__hint">
        <Markup
          text={t.markup('range', {
            inicio: mmss(sel[0] - lo),
            dura: mmss(sel[1] - sel[0]),
            fin: mmss(sel[1] - lo),
            b: (c) => `<b>${c}</b>`,
          })}
        />{' '}
        {t('limits', { min: trim.min_s, max: trim.max_s })}
      </p>
      {error ? (
        <p className="ch-ce__flash ch-ce__flash--bad" role="alert">
          {t.has(`errors.${error}`)
            ? t(`errors.${error}`, { min: trim.min_s, max: trim.max_s })
            : t('errors.outside_window')}
        </p>
      ) : null}
      <div className="ch-ce__pbtns">
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={!changed || busy}
          onClick={() => onApply(sel[0], sel[1])}
        >
          <Scissors aria-hidden="true" />
          {busy ? t('applying') : t('apply')}
        </button>
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          disabled={!changed || busy}
          onClick={() => setSel([trim.start_s, trim.end_s])}
        >
          <RotateCcw aria-hidden="true" />
          {t('reset')}
        </button>
      </div>
    </section>
  );
}
