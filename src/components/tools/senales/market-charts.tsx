'use client';

// Señales · Mercado charts: candles plus RSI, MACD, ADX and volume delta,
// stacked on one time axis (the old panel's Lightweight Charts layout, in
// plain SVG with the app's tokens; no chart library). Moving over any panel
// moves one shared cursor and every panel's readout follows it.

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { extent, formatPrice, scale } from '@/lib/tools/senales-market-core';
import type { Candle, MarketIndicators, SeriesPoint } from '@/lib/tools/adapters/tools';

const W = 1000;

interface Axis {
  times: number[];
  x: (i: number) => number;
  slot: number;
  index: Map<number, number>;
}

function useAxis(candles: Candle[]): Axis {
  return useMemo(() => {
    const times = candles.map((c) => c.time);
    const slot = W / Math.max(times.length, 1);
    const index = new Map(times.map((t, i) => [t, i]));
    return { times, slot, index, x: (i: number) => slot * i + slot / 2 };
  }, [candles]);
}

function valueAt(points: SeriesPoint[], time: number | undefined): number | null {
  if (time === undefined) return points.at(-1)?.value ?? null;
  for (let i = points.length - 1; i >= 0; i--) if (points[i]!.time <= time) return points[i]!.value;
  return null;
}

function Panel({
  title,
  readout,
  help,
  height,
  children,
  cursorX,
  onMove,
  onLeave,
  ticks,
}: {
  title: string;
  readout: string;
  help?: string;
  height: number;
  children: React.ReactNode;
  cursorX: number | null;
  onMove: (e: PointerEvent<SVGSVGElement>) => void;
  onLeave: () => void;
  ticks: { y: number; label: string }[];
}) {
  return (
    <figure className="ch-mkt-panel">
      <figcaption className="ch-mkt-panel__h">
        <b>{title}</b>
        <span className="ch-mkt-panel__val">{readout}</span>
        {help && <small className="ch-muted">{help}</small>}
      </figcaption>
      <div className="ch-mkt-panel__plot" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title}: ${readout}`}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
        >
          {ticks.map((t) => (
            <line
              key={t.y}
              x1={0}
              x2={W}
              y1={t.y}
              y2={t.y}
              className="ch-mkt-grid"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {children}
          {cursorX !== null && (
            <line
              x1={cursorX}
              x2={cursorX}
              y1={0}
              y2={height}
              className="ch-mkt-cursor"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <ul className="ch-mkt-ticks" aria-hidden="true">
          {ticks.map((t) => (
            <li key={t.y} style={{ top: `${(t.y / height) * 100}%` }}>
              {t.label}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function linePath(points: SeriesPoint[], axis: Axis, y: (v: number) => number): string {
  let d = '';
  for (const p of points) {
    const i = axis.index.get(p.time);
    if (i === undefined) continue;
    d += `${d ? 'L' : 'M'}${axis.x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  }
  return d;
}

export interface ChartLabels {
  price: string;
  rsi: string;
  rsiHelp: string;
  macd: string;
  macdHelp: string;
  adx: string;
  adxHelp: string;
  vd: string;
  vdHelp: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

export function MarketCharts({
  data,
  locale,
  labels,
}: {
  data: MarketIndicators;
  locale: string;
  labels: ChartLabels;
}) {
  const axis = useAxis(data.candles);
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const time = hover !== null ? axis.times[hover] : undefined;
  const cursorX = hover !== null ? axis.x(hover) : null;
  const fmt = (v: number | null, digits = 2) =>
    v === null
      ? '—'
      : new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
          maximumFractionDigits: digits,
        }).format(v);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / Math.max(r.width, 1);
    const i = Math.floor(f * axis.times.length);
    setHover(i >= 0 && i < axis.times.length ? i : null);
  };
  const onLeave = () => setHover(null);
  const common = { cursorX, onMove, onLeave };

  // Price
  const PH = 300;
  const [plo, phi] = extent(data.candles.flatMap((c) => [c.low, c.high]));
  const py = scale(plo, phi, PH - 6, 6);
  const ptick = [0, 1, 2, 3].map((k) => {
    const v = plo + ((phi - plo) * (k + 0.5)) / 4;
    return { y: py(v), label: formatPrice(v, locale) };
  });
  const c = hover !== null ? data.candles[hover] : data.candles.at(-1);
  const bodyW = Math.max(1, axis.slot * 0.62);

  // Oscillators
  const IH = 110;
  const rsiY = scale(0, 100, IH - 4, 4);
  const adxHi = Math.max(50, ...data.adx.map((p) => p.value));
  const adxY = scale(0, adxHi, IH - 4, 4);
  const [mlo, mhi] = extent([
    ...data.macd.line.map((p) => p.value),
    ...data.macd.signal.map((p) => p.value),
    ...data.macd.hist.map((p) => p.value),
    0,
  ]);
  const macdY = scale(mlo, mhi, IH - 4, 4);
  const vdMax = Math.max(...data.volumeDelta.map((p) => Math.abs(p.value)), Number.MIN_VALUE);
  const vdY = scale(-vdMax, vdMax, IH - 4, 4);
  const bars = (points: SeriesPoint[], y: (v: number) => number) =>
    points.map((p) => {
      const i = axis.index.get(p.time);
      if (i === undefined) return null;
      const y0 = y(0);
      const y1 = y(p.value);
      return (
        <rect
          key={p.time}
          x={axis.x(i) - bodyW / 2}
          width={bodyW}
          y={Math.min(y0, y1)}
          height={Math.max(0.5, Math.abs(y1 - y0))}
          className={p.value >= 0 ? 'ch-mkt-up' : 'ch-mkt-down'}
        />
      );
    });

  return (
    <div className="ch-mkt-charts" ref={ref}>
      <Panel
        title={labels.price}
        readout={
          c
            ? `${labels.open} ${formatPrice(c.open, locale)} · ${labels.high} ${formatPrice(c.high, locale)} · ${labels.low} ${formatPrice(c.low, locale)} · ${labels.close} ${formatPrice(c.close, locale)}`
            : '—'
        }
        height={PH}
        ticks={ptick}
        {...common}
      >
        {data.candles.map((k, i) => {
          const x = axis.x(i);
          const up = k.close >= k.open;
          const top = py(Math.max(k.open, k.close));
          const bot = py(Math.min(k.open, k.close));
          return (
            <g key={k.time} className={up ? 'ch-mkt-up' : 'ch-mkt-down'}>
              <line
                x1={x}
                x2={x}
                y1={py(k.high)}
                y2={py(k.low)}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={x - bodyW / 2} width={bodyW} y={top} height={Math.max(0.8, bot - top)} />
            </g>
          );
        })}
      </Panel>
      <Panel
        title={labels.rsi}
        help={labels.rsiHelp}
        readout={fmt(valueAt(data.rsi, time), 1)}
        height={IH}
        ticks={[70, 30].map((v) => ({ y: rsiY(v), label: String(v) }))}
        {...common}
      >
        <path
          d={linePath(data.rsi, axis, rsiY)}
          className="ch-mkt-line"
          vectorEffect="non-scaling-stroke"
        />
      </Panel>
      <Panel
        title={labels.macd}
        help={labels.macdHelp}
        readout={`${fmt(valueAt(data.macd.line, time), 4)} / ${fmt(valueAt(data.macd.signal, time), 4)}`}
        height={IH}
        ticks={[{ y: macdY(0), label: '0' }]}
        {...common}
      >
        {bars(data.macd.hist, macdY)}
        <path
          d={linePath(data.macd.line, axis, macdY)}
          className="ch-mkt-line"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={linePath(data.macd.signal, axis, macdY)}
          className="ch-mkt-line2"
          vectorEffect="non-scaling-stroke"
        />
      </Panel>
      <Panel
        title={labels.adx}
        help={labels.adxHelp}
        readout={fmt(valueAt(data.adx, time), 1)}
        height={IH}
        ticks={[{ y: adxY(25), label: '25' }]}
        {...common}
      >
        <path
          d={linePath(data.adx, axis, adxY)}
          className="ch-mkt-line"
          vectorEffect="non-scaling-stroke"
        />
      </Panel>
      <Panel
        title={labels.vd}
        help={labels.vdHelp}
        readout={fmt(valueAt(data.volumeDelta, time), 2)}
        height={IH}
        ticks={[{ y: vdY(0), label: '0' }]}
        {...common}
      >
        {bars(data.volumeDelta, vdY)}
      </Panel>
    </div>
  );
}

/** A small line for the derivatives panel (open interest, funding). */
export function Spark({
  points,
  label,
  zero = false,
}: {
  points: SeriesPoint[];
  label: string;
  zero?: boolean;
}) {
  const H = 64;
  const n = points.length;
  if (n < 2) return null;
  const [lo, hi] = extent([...points.map((p) => p.value), ...(zero ? [0] : [])]);
  const y = scale(lo, hi, H - 3, 3);
  const x = (i: number) => (i / (n - 1)) * W;
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join('');
  return (
    <svg
      className="ch-mkt-spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {zero && lo < 0 && hi > 0 && (
        <line
          x1={0}
          x2={W}
          y1={y(0)}
          y2={y(0)}
          className="ch-mkt-grid"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={d} className="ch-mkt-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Paired bars (liquidations: longs up, shorts down). */
export function PairBars({
  rows,
  label,
}: {
  rows: { time: number; up: number; down: number }[];
  label: string;
}) {
  const H = 64;
  const n = rows.length;
  if (!n) return null;
  const max = Math.max(...rows.flatMap((r) => [r.up, r.down]), Number.MIN_VALUE);
  const y = scale(-max, max, H - 2, 2);
  const w = (W / n) * 0.7;
  return (
    <svg
      className="ch-mkt-spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {rows.map((r, i) => {
        const x = (W / n) * i + (W / n - w) / 2;
        return (
          <g key={r.time}>
            <rect
              x={x}
              width={w}
              y={y(r.up)}
              height={Math.max(0.5, y(0) - y(r.up))}
              className="ch-mkt-up"
            />
            <rect
              x={x}
              width={w}
              y={y(0)}
              height={Math.max(0.5, y(-r.down) - y(0))}
              className="ch-mkt-down"
            />
          </g>
        );
      })}
    </svg>
  );
}
