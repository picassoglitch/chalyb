// What the Señales screens show, from the engine's signals (TOOLS-SPEC
// §5.2–§5.3). Pure, unit-tested: verdict wording, "Nueva", the >7-day band,
// grouping by day, money and the chart geometry. Nothing here reads the
// person: a coin filter is applied after the content is fetched.

import type { PricePoint, Signal, SignalState } from './adapters/tools';

const DAY = 86_400_000;
export const SIGNAL_TZ = 'America/Mexico_City';

/** VerdictPill (Q4: the new wording, Señales 53–56 only). Never green. */
export const VERDICT: Record<
  SignalState,
  { key: 'buy' | 'sell' | 'wait'; tone: 'acc' | 'warn' | 'gray' }
> = {
  buy: { key: 'buy', tone: 'acc' },
  sell: { key: 'sell', tone: 'warn' },
  wait: { key: 'wait', tone: 'gray' },
};

/** A signal older than 7 days gets "Puede que ya no aplique". */
export function isOldSignal(at: string, now: number): boolean {
  return now - Date.parse(at) > 7 * DAY;
}

/** "Nueva": the newest signal on screen, if it's from the last 24 h. */
export function isNewSignal(at: string, now: number): boolean {
  return now - Date.parse(at) < DAY;
}

/** Newest first, one per coin (the home list). */
export function latestPerCoin(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  return [...signals]
    .sort((a, b) => b.at.localeCompare(a.at))
    .filter((s) => (seen.has(s.coin) ? false : (seen.add(s.coin), true)));
}

function dayKey(iso: string, tz = SIGNAL_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** Historial: newest day first, newest signal first inside each day. */
export function groupByDay(signals: Signal[], tz = SIGNAL_TZ): { day: string; items: Signal[] }[] {
  const out: { day: string; items: Signal[] }[] = [];
  for (const s of [...signals].sort((a, b) => b.at.localeCompare(a.at))) {
    const day = dayKey(s.at, tz);
    const last = out.at(-1);
    if (last?.day === day) last.items.push(s);
    else out.push({ day, items: [s] });
  }
  return out;
}

/** 'today' | 'yesterday' | null (then the caller prints the date). */
export function relativeDay(at: string, now: number, tz = SIGNAL_TZ): 'today' | 'yesterday' | null {
  const d = dayKey(at, tz);
  if (d === dayKey(new Date(now).toISOString(), tz)) return 'today';
  if (d === dayKey(new Date(now - DAY).toISOString(), tz)) return 'yesterday';
  return null;
}

/** "$1,186,400 MXN"; cents only below $100. */
export function formatRefPrice(n: number, locale: string): string {
  const big = Math.abs(n) >= 100;
  const num = new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    minimumFractionDigits: big ? 0 : 2,
    maximumFractionDigits: big ? 0 : 2,
  }).format(n);
  return `$${num} MXN`;
}

export interface ChartGeometry {
  line: string;
  area: string;
  /** 3 axis marks, top to bottom. */
  ticks: { y: number; value: number }[];
  /** Where the notice was made, when it falls inside the range. */
  marker: { x: number; y: number; at: string } | null;
}

/** Line + soft area for the past price. No targets, stops or projections:
 *  the line never goes past the last real point. */
export function chartGeometry(
  series: PricePoint[],
  w: number,
  h: number,
  signalAt: string,
  pad = 8,
): ChartGeometry | null {
  if (series.length < 2) return null;
  const vals = series.map((p) => p.priceMXN);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (i / (series.length - 1)) * w;
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p.priceMXN).toFixed(1)}`);
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const ticks = [max, (max + min) / 2, min].map((v) => ({ y: y(v), value: v }));
  const t = Date.parse(signalAt);
  let marker: ChartGeometry['marker'] = null;
  if (t >= Date.parse(series[0]!.at) && t <= Date.parse(series.at(-1)!.at)) {
    let best = 0;
    series.forEach((p, i) => {
      if (Math.abs(Date.parse(p.at) - t) < Math.abs(Date.parse(series[best]!.at) - t)) best = i;
    });
    marker = { x: x(best), y: y(series[best]!.priceMXN), at: signalAt };
  }
  return { line, area, ticks, marker };
}

/** The email as the screen shows it: first 2 letters, then the domain. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes('@')) return '';
  const [user, domain] = email.split('@') as [string, string];
  return `${user.slice(0, 2)}•••@${domain}`;
}
