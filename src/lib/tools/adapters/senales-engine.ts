// Señales mode "a" (TOOL_HUB_MODE_CHALYBCRYPTO=a): the hub's server calls
// the ChalyCrypto engine's /api/hub/v1 JSON API with a short-lived Bearer
// token per request (engines/hub-api-token.ts). The browser never talks to
// the engine.
//
// Engine base URL: CHALYBCRYPTO_API_URL, else engines.external_url for the
// chalybcrypto row (the same host the SSO hand-off uses).
//
// Signal CONTENT (getSignals/getSignal) takes the plan only (REVISION-LEGAL
// C1): it is the engine's shared feed (/api/hub/v1/feed), one general reading
// per coin computed from market data, the same for every user. The call is
// made as the hub's service principal (no user), so no user id can reach it.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { signHubApiToken } from '@/lib/engines/hub-api-token';
import { ToolRequestError, ToolUsageRefusedError } from '../bff-core';
import { SENALES_COINS } from '../senales-coins';
import type {
  BacktestResult,
  DerivativesContext,
  EngineStrategy,
  MarketIndicators,
  MarketList,
  MarketVenue,
  MarketVenueId,
  NewsItem,
  OrderBook,
  PricePoint,
  SenalesAdapter,
  SeriesPoint,
  Signal,
  SignalChannel,
  SignalPrefs,
  ToolCapabilities,
} from './tools';

const SLUG = 'chalybcrypto';
/** The token subject for calls that belong to no user (the shared feed, the
 *  health probe). The engine's feed and market routes never look it up. */
export const HUB_SERVICE_PRINCIPAL = '00000000-0000-0000-0000-000000000000';
const CAPS: ToolCapabilities = { supportsConnect: false, likenessOptions: [] };
/** The engine delivers nothing by WhatsApp or email today: in-app only. */
const CHANNELS: SignalChannel[] = ['app'];

export class EngineHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** The engine's machine-readable detail.error, if any (never shown). */
    readonly detailError: string | null = null,
  ) {
    super(`engine answered ${status}`);
  }
}

// ── base URL ───────────────────────────────────────────────────────────
const g = globalThis as unknown as { __chalybCryptoBase?: { url: string; at: number } };
const BASE_TTL_MS = 5 * 60_000;

export function validEngineBase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.origin;
  } catch {
    return null;
  }
}

async function engineBase(): Promise<string> {
  const fromEnv = validEngineBase(process.env.CHALYBCRYPTO_API_URL);
  if (fromEnv) return fromEnv;
  const cached = g.__chalybCryptoBase;
  if (cached && Date.now() - cached.at < BASE_TTL_MS) return cached.url;
  const { data } = await createAdminClient()
    .from('engines')
    .select('external_url')
    .eq('slug', SLUG)
    .maybeSingle();
  const url = validEngineBase((data as { external_url?: string | null } | null)?.external_url);
  if (!url) throw new Error('chalybcrypto engine URL not configured');
  g.__chalybCryptoBase = { url, at: Date.now() };
  return url;
}

// ── one call ───────────────────────────────────────────────────────────
type FetchLike = typeof fetch;

export interface EngineCallOpts {
  method?: 'GET' | 'PUT' | 'POST';
  query?: Record<string, string | number>;
  body?: unknown;
  signal?: AbortSignal;
}

/** Map an engine error response to the BFF's error codes. Never passes the
 *  engine's text on. */
export function engineError(status: number, body: unknown): Error {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const d = detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : {};
  if ((status === 402 || status === 413 || status === 429) && d.error === 'usage_refused')
    return new ToolUsageRefusedError(typeof d.reason === 'string' ? d.reason : 'no_tokens');
  if (status === 404) return new EngineHttpError(status, 'NOT_FOUND');
  if (status === 400 || status === 422)
    return new ToolRequestError(`engine refused input (${status})`);
  // A backtest whose price source didn't answer: not charged, not an outage.
  if (status === 502 && d.error === 'backtest_data_unavailable')
    return new EngineHttpError(status, 'NO_DATA', 'backtest_data_unavailable');
  // 401/403 (secret mismatch), 5xx, anything else: the tool is unwell.
  return new EngineHttpError(status, 'ENGINE_ERROR', typeof d.error === 'string' ? d.error : null);
}

export function createEngineCaller(
  base: () => Promise<string>,
  fetchImpl: FetchLike = (...a) => fetch(...a),
) {
  return async function call<T>(userId: string, path: string, o: EngineCallOpts = {}): Promise<T> {
    const url = new URL(`/api/hub/v1${path}`, await base());
    for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, String(v));
    const res = await fetchImpl(url, {
      method: o.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${signHubApiToken(SLUG, { userId })}`,
        Accept: 'application/json',
        ...(o.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      signal: o.signal,
      cache: 'no-store',
      redirect: 'error',
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw engineError(res.status, json);
    return json as T;
  };
}

// ── wire → hub shapes ──────────────────────────────────────────────────
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const pts = (v: unknown): SeriesPoint[] =>
  Array.isArray(v)
    ? v.map((p: { time?: unknown; value?: unknown }) => ({
        time: num(p.time),
        value: num(p.value),
      }))
    : [];

const VENUE_IDS = new Set<MarketVenueId>(['bitunix', 'lbank', 'binance']);

export function toMarketList(raw: Record<string, unknown>, venue: MarketVenueId): MarketList {
  const venues: MarketVenue[] = (Array.isArray(raw.venues) ? raw.venues : [])
    .filter((v: { id?: unknown }) => VENUE_IDS.has(v.id as MarketVenueId))
    .map((v: { id: MarketVenueId; name?: unknown; data_only?: unknown }) => ({
      id: v.id,
      name: typeof v.name === 'string' ? v.name : v.id,
      dataOnly: v.data_only === true,
    }));
  const symbols = (Array.isArray(raw.symbols) ? raw.symbols : [])
    .filter((s: { symbol?: unknown }) => typeof s.symbol === 'string')
    .map((s: { symbol: string; base?: unknown; quote?: unknown }) => ({
      symbol: s.symbol,
      base: typeof s.base === 'string' ? s.base : '',
      quote: typeof s.quote === 'string' ? s.quote : '',
    }));
  return { venues, venue, symbols, degraded: raw.error != null };
}

export function toIndicators(raw: Record<string, unknown>): MarketIndicators {
  const macd = (raw.macd ?? {}) as Record<string, unknown>;
  return {
    candles: (Array.isArray(raw.candles) ? raw.candles : []).map((c: Record<string, unknown>) => ({
      time: num(c.time),
      open: num(c.open),
      high: num(c.high),
      low: num(c.low),
      close: num(c.close),
    })),
    rsi: pts(raw.rsi),
    macd: { line: pts(macd.line), signal: pts(macd.signal), hist: pts(macd.hist) },
    adx: pts(raw.adx),
    volumeDelta: pts(raw.volume_delta),
  };
}

const levels = (v: unknown) =>
  (Array.isArray(v) ? v : []).map((l: Record<string, unknown>) => ({
    price: num(l.price),
    size: num(l.size),
    cumulative: num(l.cumulative),
  }));

export function toDerivatives(raw: Record<string, unknown>): DerivativesContext {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  return {
    symbol: String(raw.symbol ?? ''),
    interval: String(raw.interval ?? ''),
    openInterest: pts(raw.oi),
    funding: pts(raw.funding),
    liquidations: arr(raw.liquidations).map((r) => ({
      time: num(r.time),
      longUsd: num(r.long_usd),
      shortUsd: num(r.short_usd),
    })),
    longShort: arr(raw.long_short).map((r) => ({
      time: num(r.time),
      longPct: num(r.long_pct),
      shortPct: num(r.short_pct),
    })),
    heatmap: arr(raw.heatmap).map((r) => ({ price: num(r.price), amountUsd: num(r.amount_usd) })),
  };
}

const STATES = new Set(['buy', 'sell', 'wait']);
const CONFIDENCES = new Set(['high', 'medium', 'none']);

/** A feed entry as a hub Signal; null for anything malformed. */
export function toSignal(r: Record<string, unknown>): Signal | null {
  const why = (r.why ?? {}) as { short?: unknown; bullets?: unknown };
  if (typeof r.id !== 'string' || typeof r.coin !== 'string') return null;
  if (!STATES.has(String(r.state)) || !CONFIDENCES.has(String(r.confidence))) return null;
  const mxn = r.ref_price_mxn;
  return {
    id: r.id,
    coin: r.coin,
    state: r.state as Signal['state'],
    confidence: r.confidence as Signal['confidence'],
    explanation: typeof r.explanation === 'string' ? r.explanation : '',
    at: String(r.at ?? ''),
    ...(typeof mxn === 'number' && Number.isFinite(mxn) ? { refPriceMXN: mxn } : {}),
    why: {
      short: typeof why.short === 'string' ? why.short : '',
      bullets: Array.isArray(why.bullets) ? why.bullets.map(String).slice(0, 3) : [],
    },
  };
}

export function toBacktest(r: Record<string, unknown>): BacktestResult {
  const m = (r.metrics ?? null) as Record<string, unknown> | null;
  const a = (r.assumptions ?? null) as Record<string, unknown> | null;
  const opt = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  return {
    jobId: String(r.job_id ?? ''),
    status: r.status === 'failed' ? 'failed' : 'done',
    ...(typeof r.error === 'string' ? { error: r.error } : {}),
    strategy: String(r.strategy ?? ''),
    pair: String(r.pair ?? ''),
    timeframe: String(r.timeframe ?? ''),
    bars: num(r.bars ?? r.bars_requested),
    barsRequested: num(r.bars_requested),
    dataSource: typeof r.data_source === 'string' ? r.data_source : undefined,
    from: typeof r.from === 'string' ? r.from : undefined,
    to: typeof r.to === 'string' ? r.to : undefined,
    startingEquity: opt(r.starting_equity),
    endingEquity: opt(r.ending_equity),
    netReturnBps: opt(r.net_return_bps),
    metrics: m
      ? {
          sampleSize: num(m.sample_size),
          winRate: num(m.win_rate),
          avgWinBps: num(m.avg_win_bps),
          avgLossBps: num(m.avg_loss_bps),
          profitFactor: typeof m.profit_factor === 'number' ? m.profit_factor : null,
          maxDrawdownBps: num(m.max_drawdown_bps),
          feeDragBps: num(m.fee_drag_bps),
        }
      : undefined,
    assumptions: a
      ? {
          riskPerTradeBps: num(a.risk_per_trade_bps),
          takerBps: num(a.taker_bps),
          makerBps: num(a.maker_bps),
          spreadBps: num(a.spread_bps),
          slippageBps: num(a.slippage_bps),
        }
      : undefined,
    createdAt: typeof r.created_at === 'string' ? r.created_at : undefined,
    optimistic: true,
  };
}

/** The 503 the engine sends on purpose when a data source has no API key
 *  (coinglass_api_key_missing, cryptopanic_api_key_missing). Any other
 *  failure stays a failure. */
export const notConfigured = (e: unknown) =>
  e instanceof EngineHttpError && e.status === 503 && /_api_key_missing$/.test(e.detailError ?? '')
    ? null
    : Promise.reject(e);

export function createEngineSenales(call = createEngineCaller(engineBase)): SenalesAdapter {
  return {
    capabilities: () => CAPS,
    coins: async () => SENALES_COINS,
    channels: async () => CHANNELS,
    // CONTENT by plan: the shared feed, fetched as the service principal.
    getSignals: async ({ plan, coins, since }, signal) => {
      const raw = await call<{ signals?: Record<string, unknown>[] }>(
        HUB_SERVICE_PRINCIPAL,
        '/feed',
        {
          query: { plan, ...(since ? { since } : {}) },
          signal,
        },
      );
      const all = (raw.signals ?? []).map(toSignal).filter((x): x is Signal => x !== null);
      return coins?.length ? all.filter((x) => coins.includes(x.coin)) : all;
    },
    getSignal: async ({ id, range }, signal) => {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const raw = await call<{
        signal?: Record<string, unknown>;
        series?: Record<string, unknown>[];
      }>(HUB_SERVICE_PRINCIPAL, `/feed/${encodeURIComponent(id)}`, {
        query: { range },
        signal,
      }).catch((e) =>
        e instanceof EngineHttpError && e.code === 'NOT_FOUND' ? null : Promise.reject(e),
      );
      const sig = raw?.signal ? toSignal(raw.signal) : null;
      if (!raw || !sig) return null;
      const series: PricePoint[] = (raw.series ?? []).map((p) => ({
        at: String(p.at ?? ''),
        priceMXN: num(p.price_mxn),
      }));
      return { signal: sig, series };
    },

    getPrefs: async (userId, signal) =>
      (await call<SignalPrefs | null>(userId, '/signal-prefs', { signal })) ?? null,
    savePrefs: async (userId, prefs, signal) => {
      await call(userId, '/signal-prefs', { method: 'PUT', body: prefs, signal });
    },

    markets: async (userId, venue, signal) =>
      toMarketList(
        await call<Record<string, unknown>>(userId, '/markets', { query: { venue }, signal }),
        venue,
      ),
    indicators: async (userId, { pair, interval, bars }, signal) =>
      toIndicators(
        await call<Record<string, unknown>>(userId, `/indicators/${encodeURIComponent(pair)}`, {
          query: { interval, bars },
          signal,
        }),
      ),
    orderBook: async (userId, pair, signal) => {
      const raw = await call<Record<string, unknown>>(
        userId,
        `/orderbook/${encodeURIComponent(pair)}`,
        {
          query: { limit: 50 },
          signal,
        },
      );
      return {
        pair: String(raw.pair ?? pair),
        takenAt: String(raw.taken_at ?? ''),
        bids: levels(raw.bids),
        asks: levels(raw.asks),
      } satisfies OrderBook;
    },
    derivatives: async (userId, { pair, interval }, signal) => {
      const raw = await call<Record<string, unknown>>(
        userId,
        `/coinglass/${encodeURIComponent(pair)}`,
        {
          query: { interval },
          signal,
        },
      ).catch(notConfigured);
      return raw ? toDerivatives(raw) : null;
    },
    news: async (userId, coin, signal) => {
      const raw = await call<{ items?: Record<string, unknown>[] }>(userId, '/news', {
        query: { currencies: coin, limit: 25 },
        signal,
      }).catch(notConfigured);
      if (!raw) return null;
      return (raw.items ?? [])
        .filter((i) => typeof i.url === 'string' && /^https:\/\//.test(i.url as string))
        .map(
          (i): NewsItem => ({
            publishedAt: String(i.published_at ?? ''),
            title: String(i.title ?? ''),
            url: i.url as string,
            source: String(i.source ?? ''),
          }),
        );
    },
    strategies: async (userId, signal) =>
      (await call<Record<string, unknown>[]>(userId, '/strategies', { signal })).map(
        (s): EngineStrategy => ({
          key: String(s.key ?? ''),
          name: String(s.name ?? s.key ?? ''),
          enabled: s.enabled !== false,
        }),
      ),
    runBacktest: async (userId, input, signal) =>
      toBacktest(
        await call<Record<string, unknown>>(userId, '/backtests', {
          method: 'POST',
          body: input,
          signal,
        }),
      ),
    listBacktests: async (userId, signal) =>
      (await call<Record<string, unknown>[]>(userId, '/backtests', { signal })).map(toBacktest),
  };
}
