// Señales · Mercado and Estrategias: input rules and small calculations the
// BFF routes and the screens share. Pure, unit-tested.

import type { BookLevel, MarketVenueId, OrderBook } from './adapters/tools';

export const MARKET_VENUES: readonly MarketVenueId[] = ['bitunix', 'lbank', 'binance'];

/** Chart timeframes the engine's price source accepts (the old panel's list). */
export const CHART_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const;
export type ChartInterval = (typeof CHART_INTERVALS)[number];

/** Backtest timeframes: same list, minus the weekly bar. */
export const BACKTEST_INTERVALS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

export const BACKTEST_BARS = { min: 100, max: 5000, default: 1500 } as const;

/** Quick picks (the old panel's majors). */
export const QUICK_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT'];

export const DEFAULT_PAIR = 'BTCUSDT';

const PAIR = /^[A-Z0-9]{2,20}$/;

export function parseVenue(v: unknown): MarketVenueId {
  return MARKET_VENUES.includes(v as MarketVenueId) ? (v as MarketVenueId) : 'bitunix';
}

/** An upper-cased pair, or null when it isn't one. */
export function parsePair(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const p = v.trim().toUpperCase();
  return PAIR.test(p) ? p : null;
}

export function parseInterval(v: unknown, fallback: ChartInterval = '5m'): ChartInterval {
  return CHART_INTERVALS.includes(v as ChartInterval) ? (v as ChartInterval) : fallback;
}

/** The coin a pair is quoted in, for news and derivatives ("BTCUSDT" → "BTC"). */
export function baseOf(pair: string): string {
  for (const q of ['USDT', 'USDC', 'USD'])
    if (pair.endsWith(q) && pair.length > q.length) return pair.slice(0, -q.length);
  return pair;
}

export type BacktestCheck =
  | { ok: true; value: { strategy: string; pair: string; timeframe: string; bars: number } }
  | { ok: false; field: 'strategy' | 'pair' | 'timeframe' | 'bars' };

export function validateBacktest(
  body: Record<string, unknown>,
  strategies: Set<string>,
): BacktestCheck {
  const strategy = typeof body.strategy === 'string' ? body.strategy : '';
  if (!strategies.has(strategy)) return { ok: false, field: 'strategy' };
  const pair = parsePair(body.pair);
  if (!pair) return { ok: false, field: 'pair' };
  const timeframe = body.timeframe;
  if (!BACKTEST_INTERVALS.includes(timeframe as (typeof BACKTEST_INTERVALS)[number]))
    return { ok: false, field: 'timeframe' };
  const bars = Number(body.bars);
  if (!Number.isInteger(bars) || bars < BACKTEST_BARS.min || bars > BACKTEST_BARS.max)
    return { ok: false, field: 'bars' };
  return { ok: true, value: { strategy, pair, timeframe: timeframe as string, bars } };
}

/** Usage refusals from the hub admission the engine runs (consumption
 *  contract): grouped into what the person can do about it. */
export type UsageRefusalKind = 'credits' | 'busy' | 'cap' | 'too_big';

export function usageRefusalKind(reason: string | undefined): UsageRefusalKind {
  switch (reason) {
    case 'concurrency':
      return 'busy';
    case 'jobs_cap':
    case 'minutes_cap':
    case 'streams_cap':
      return 'cap';
    case 'upload_too_large':
    case 'video_too_long':
    case 'storage_full':
      return 'too_big';
    default:
      // no_tokens, boost_unavailable and anything new: the conservative one.
      return 'credits';
  }
}

/** Mid price and spread (basis points) from the top of the book. */
export function bookTop(
  book: Pick<OrderBook, 'bids' | 'asks'>,
): { mid: number; spreadBps: number } | null {
  const bid = book.bids[0]?.price;
  const ask = book.asks[0]?.price;
  if (!bid || !ask || ask < bid) return null;
  const mid = (bid + ask) / 2;
  return { mid, spreadBps: ((ask - bid) / mid) * 10_000 };
}

/** Depth bar width per level, against the deeper side's total. */
export function depthWidths(
  bids: BookLevel[],
  asks: BookLevel[],
): { bids: number[]; asks: number[] } {
  const max = Math.max(
    bids.at(-1)?.cumulative ?? 0,
    asks.at(-1)?.cumulative ?? 0,
    Number.MIN_VALUE,
  );
  const w = (l: BookLevel) => Math.min(100, (l.cumulative / max) * 100);
  return { bids: bids.map(w), asks: asks.map(w) };
}

/** Linear scale from [d0, d1] to [r0, r1]; a flat domain maps to the middle. */
export function scale(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  if (!(d1 > d0)) return () => (r0 + r1) / 2;
  const k = (r1 - r0) / (d1 - d0);
  return (v) => r0 + (v - d0) * k;
}

/** min/max over values, padded by `pad` (fraction of the range). */
export function extent(values: number[], pad = 0.05): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === Infinity) return [0, 1];
  if (lo === hi) return [lo - Math.abs(lo || 1) * 0.01, hi + Math.abs(hi || 1) * 0.01];
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

/** A compact price: more decimals for small prices (0.000123), grouping for big ones. */
export function formatPrice(v: number, locale: string): string {
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    maximumFractionDigits: digits,
  }).format(v);
}

/** 1.2 mil millones / 1.2B style compact numbers for USD amounts and sizes. */
export function formatCompact(v: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-MX' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(v);
}
