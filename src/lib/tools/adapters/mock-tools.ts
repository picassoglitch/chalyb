// In-memory adapters for Señales, En vivo, Asistente, Pronósticos, Inmuebles
// and Inversiones — development and e2e only (TOOL_HUB_MODE_<SLUG>=mock,
// refused in production builds without E2E_USE_MOCK_ADAPTERS=1).
// Content here is sample engine output, not advice and not real data.

import type {
  AsistenteAdapter,
  BacktestResult,
  Candle,
  AssistantConfig,
  AutomationRule,
  Coin,
  EnVivoAdapter,
  LiveDestination,
  LiveState,
  PastStream,
  Forecast,
  InmueblesAdapter,
  InversionesAdapter,
  PronosticosAdapter,
  PricePoint,
  PropertyCard,
  SenalesAdapter,
  Signal,
  SignalPrefs,
  SignalRange,
  ToolCapabilities,
} from './tools';
import { EnVivoRefusal } from './tools';
import {
  normalizeBroadcastMeta,
  PLATFORM_META,
  type BroadcastMeta,
  type OAuthPlatform,
} from '../envivo-platforms';
import { honorSignal } from './signal';
import { ToolUsageRefusedError } from '../bff-core';
import { SENALES_COINS } from '../senales-coins';

const CAPS: ToolCapabilities = { supportsConnect: false, likenessOptions: [] };

const COINS: Coin[] = SENALES_COINS;

/** Sample reference prices (MXN) — engine output stand-ins, not real data. */
const REF_MXN: Record<string, number> = {
  BTC: 1_186_400,
  ETH: 46_980,
  SOL: 3_412,
  XRP: 11.62,
  DOGE: 3.07,
  ADA: 8.41,
  BNB: 12_310,
  LTC: 1_684,
};

const WHY: Record<Signal['state'], { short: string; bullets: string[] }> = {
  buy: {
    short: 'Lleva varios días subiendo poco a poco, sin saltos bruscos.',
    bullets: [
      'Lleva 5 días subiendo poco a poco.',
      'No ha tenido subidas ni bajadas bruscas.',
      'Se ha comprado más de lo que se ha vendido.',
    ],
  },
  sell: {
    short: 'Subió muy rápido esta semana. A veces, después de eso, baja.',
    bullets: [
      'Subió mucho en pocos días.',
      'Las subidas rápidas a veces se corrigen.',
      'Se está vendiendo más que antes.',
    ],
  },
  wait: {
    short: 'Se mueve mucho para los dos lados. Te avisamos cuando se calme.',
    bullets: [
      'Sube y baja sin una dirección clara.',
      'Los movimientos de hoy son más grandes de lo normal.',
      'Te avisamos cuando haya algo claro.',
    ],
  },
};

const RANGE_POINTS: Record<SignalRange, { n: number; stepMs: number }> = {
  '1d': { n: 24, stepMs: 3_600_000 },
  '7d': { n: 42, stepMs: 4 * 3_600_000 },
  '1m': { n: 30, stepMs: 24 * 3_600_000 },
};

/** Deterministic pseudo-random walk ending at `end` (same input → same series). */
function series(seed: string, end: number, endAt: number, range: SignalRange, trend: number): PricePoint[] {
  const { n, stepMs } = RANGE_POINTS[range];
  let h = 0;
  for (const ch of seed + range) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => {
    h = (h * 1_103_515_245 + 12_345) >>> 0;
    return h / 2 ** 32;
  };
  const pts: number[] = [end];
  for (let i = 1; i < n; i++) pts.push(pts[i - 1]! * (1 - trend / n + (rnd() - 0.5) * 0.012));
  return pts.reverse().map((p, i) => ({
    at: new Date(endAt - (n - 1 - i) * stepMs).toISOString(),
    priceMXN: Math.round(p * 100) / 100,
  }));
}

export function createMockSenales(now = () => Date.now()): SenalesAdapter {
  const prefs = new Map<string, SignalPrefs>();
  // One feed per plan: the same for everyone on it. Newest first: today's
  // signal per coin, then yesterday's, then one 9 days old (the "puede que
  // ya no aplique" band).
  const feed = (plan: string): Signal[] => {
    const hour = Math.floor(now() / 3_600_000) * 3_600_000;
    const coins = COINS.slice(0, plan === 'FREE' ? 3 : 8);
    const out: Signal[] = [];
    for (const [ageH, suffix] of [
      [0, ''],
      [26, '-d1'],
      [9 * 24, '-d9'],
    ] as const) {
      coins.forEach((c, i) => {
        if (suffix === '-d9' && c.symbol !== 'BTC') return;
        const state = (['buy', 'sell', 'wait'] as const)[(i + (suffix ? 1 : 0)) % 3]!;
        out.push({
          id: `${plan}-${c.symbol}${suffix}`,
          coin: c.symbol,
          state,
          confidence: state === 'wait' ? 'none' : i % 2 ? 'medium' : 'high',
          explanation: `Muestra del motor para ${c.name}: tendencia general del mercado en las últimas horas.`,
          at: new Date(hour - ageH * 3_600_000 - i * 600_000).toISOString(),
          refPriceMXN: REF_MXN[c.symbol],
          why: WHY[state],
        });
      });
    }
    return out;
  };
  return honorSignal({
    capabilities: () => CAPS,
    coins: async () => COINS,
    channels: async () => ['email', 'app'],
    getSignals: async ({ plan, coins, since }) =>
      feed(plan).filter(
        (s) => (!coins?.length || coins.includes(s.coin)) && (!since || s.at >= since),
      ),
    getSignal: async ({ plan, id, range }) => {
      const signal = feed(plan).find((s) => s.id === id);
      if (!signal) return null;
      const trend = signal.state === 'buy' ? 0.06 : signal.state === 'sell' ? -0.04 : 0;
      return {
        signal,
        // The past only: the series ends now, never later.
        series: series(signal.id, signal.refPriceMXN ?? 1, Math.floor(now() / 60_000) * 60_000, range, trend),
      };
    },
    getPrefs: async (userId) => prefs.get(userId) ?? null,
    savePrefs: async (userId, p) => {
      prefs.set(userId, p);
    },
    ...mockMarket(now),
  });
}

// ── Mercado / Estrategias sample data (deterministic per pair) ──────────
function seeded(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    h = (h * 1_103_515_245 + 12_345) >>> 0;
    return h / 2 ** 32;
  };
}

const MOCK_USD: Record<string, number> = { BTC: 64_200, ETH: 2_540, SOL: 184, XRP: 0.62, DOGE: 0.16, ADA: 0.45, BNB: 590, LTC: 88 };
const STEP_S: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14_400, '1d': 86_400, '1w': 604_800 };

function mockMarket(now: () => number): Pick<
  SenalesAdapter,
  'markets' | 'indicators' | 'orderBook' | 'derivatives' | 'news' | 'strategies' | 'runBacktest' | 'listBacktests'
> {
  const usd = (pair: string) => MOCK_USD[pair.replace(/USDT$/, '')] ?? 1;
  const runs: { userId: string; run: BacktestResult }[] = [];
  const candles = (pair: string, interval: string, bars: number): Candle[] => {
    const step = STEP_S[interval] ?? 300;
    const end = Math.floor(now() / 1000 / step) * step;
    const rnd = seeded(pair + interval);
    let p = usd(pair);
    const out: Candle[] = [];
    for (let i = 0; i < bars; i++) {
      const open = p;
      const close = open * (1 + (rnd() - 0.5) * 0.01);
      const high = Math.max(open, close) * (1 + rnd() * 0.003);
      const low = Math.min(open, close) * (1 - rnd() * 0.003);
      out.push({ time: end - (bars - 1 - i) * step, open, high, low, close });
      p = close;
    }
    return out;
  };
  return {
    markets: async (_u, venue) => ({
      venues: [
        { id: 'bitunix', name: 'Bitunix', dataOnly: false },
        { id: 'lbank', name: 'LBank', dataOnly: false },
        { id: 'binance', name: 'Binance', dataOnly: true },
      ],
      venue,
      symbols:
        venue === 'bitunix'
          ? COINS.map((c) => ({ symbol: `${c.symbol}USDT`, base: c.symbol, quote: 'USDT' }))
          : [],
      degraded: false,
    }),
    indicators: async (_u, { pair, interval, bars }) => {
      const cs = candles(pair, interval, Math.min(bars, 200));
      const rnd = seeded(pair + interval + 'ind');
      const line = (base: number, amp: number) =>
        cs.slice(26).map((c) => ({ time: c.time, value: base + (rnd() - 0.5) * amp }));
      return {
        candles: cs,
        rsi: line(50, 40),
        macd: { line: line(0, 20), signal: line(0, 15), hist: line(0, 10) },
        adx: line(25, 20),
        volumeDelta: cs.map((c) => ({ time: c.time, value: (c.close - c.open) * 1000 })),
      };
    },
    orderBook: async (_u, pair) => {
      const mid = usd(pair);
      const rnd = seeded(pair + Math.floor(now() / 2000));
      const side = (dir: 1 | -1) => {
        let cum = 0;
        return Array.from({ length: 20 }, (_, i) => {
          const size = Math.round(rnd() * 5000) / 1000 + 0.01;
          cum += size;
          return { price: mid * (1 + dir * (i + 1) * 0.0002), size, cumulative: cum };
        });
      };
      return { pair, takenAt: new Date(now()).toISOString(), bids: side(-1), asks: side(1) };
    },
    derivatives: async (_u, { pair, interval }) => {
      const rnd = seeded(pair + 'cg');
      const t = Math.floor(now() / 3_600_000) * 3600;
      const ts = Array.from({ length: 48 }, (_, i) => t - (47 - i) * 3600);
      return {
        symbol: pair.replace(/USDT$/, ''),
        interval,
        openInterest: ts.map((time) => ({ time, value: 8e9 + rnd() * 1e9 })),
        funding: ts.map((time) => ({ time, value: (rnd() - 0.4) * 0.0002 })),
        liquidations: ts.map((time) => ({ time, longUsd: rnd() * 4e6, shortUsd: rnd() * 4e6 })),
        longShort: ts.map((time) => {
          const l = 45 + rnd() * 10;
          return { time, longPct: l, shortPct: 100 - l };
        }),
        heatmap: Array.from({ length: 8 }, (_, i) => ({
          price: usd(pair) * (0.96 + i * 0.01),
          amountUsd: rnd() * 5e7,
        })),
      };
    },
    news: async (_u, coin) => [
      {
        publishedAt: new Date(now() - 40 * 60_000).toISOString(),
        title: `Muestra: titular sobre ${coin}`,
        url: 'https://example.com/noticia-1',
        source: 'Ejemplo',
      },
      {
        publishedAt: new Date(now() - 5 * 3_600_000).toISOString(),
        title: `Muestra: otro titular sobre ${coin}`,
        url: 'https://example.com/noticia-2',
        source: 'Ejemplo',
      },
    ],
    strategies: async () => [
      { key: 'ema_adx_trend', name: 'EMA/ADX trend', enabled: true },
      { key: 'vwap_rsi_meanrev', name: 'VWAP/RSI mean-reversion', enabled: true },
      { key: 'fvg_ob', name: 'FVG + Order Block', enabled: true },
    ],
    runBacktest: async (userId, input) => {
      // 5000 bars: the sample "out of credits" refusal, for e2e.
      if (input.bars === 5000) throw new ToolUsageRefusedError('no_tokens');
      const rnd = seeded(input.strategy + input.pair + input.timeframe + input.bars);
      const net = Math.round((rnd() - 0.45) * 800);
      const run: BacktestResult = {
        ...input,
        jobId: `backtest_mock_${runs.length + 1}`,
        status: 'done',
        barsRequested: input.bars,
        dataSource: 'binance',
        from: new Date(now() - input.bars * 300_000).toISOString(),
        to: new Date(now()).toISOString(),
        startingEquity: 10_000,
        endingEquity: 10_000 * (1 + net / 10_000),
        netReturnBps: net,
        metrics: {
          sampleSize: 8 + Math.floor(rnd() * 30),
          winRate: 0.35 + rnd() * 0.3,
          avgWinBps: 40 + rnd() * 40,
          avgLossBps: 30 + rnd() * 30,
          profitFactor: 0.7 + rnd() * 0.9,
          maxDrawdownBps: 100 + rnd() * 300,
          feeDragBps: 10 + rnd() * 20,
        },
        assumptions: { riskPerTradeBps: 50, takerBps: 6, makerBps: 2, spreadBps: 1, slippageBps: 1 },
        createdAt: new Date(now()).toISOString(),
        optimistic: true,
      };
      runs.unshift({ userId, run });
      return run;
    },
    listBacktests: async (userId) => runs.filter((r) => r.userId === userId).map((r) => r.run),
  };
}

/** In-memory En vivo: the engine's model (RTMP relay + destinations), so
 *  every screen runs in development and e2e without the engine. "Live"
 *  never turns on by itself here (no encoder pushes to a mock). */
export function createMockEnVivo(now = () => Date.now()): EnVivoAdapter {
  interface UserLive {
    title: string;
    clipsEnabled: boolean;
    streamKey: string;
    meta: BroadcastMeta;
    destinations: (LiveDestination & { key: string })[];
    streams: PastStream[];
    seq: number;
  }
  const users = new Map<string, UserLive>();
  const freshKey = () =>
    `chalyb_live_${Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  const get = (userId: string): UserLive => {
    let u = users.get(userId);
    if (!u) {
      const startedAt = new Date(now() - 2 * 86_400_000).toISOString();
      u = {
        title: 'Mi transmisión en vivo',
        clipsEnabled: false,
        streamKey: freshKey(),
        meta: normalizeBroadcastMeta(null, 'Mi transmisión en vivo'),
        destinations: [],
        streams: [
          {
            id: 'st_1',
            startedAt,
            endedAt: new Date(Date.parse(startedAt) + 3_900_000).toISOString(),
            durationSec: 3900,
          },
        ],
        seq: 0,
      };
      users.set(userId, u);
    }
    return u;
  };
  const find = (userId: string, id: string) => {
    const d = get(userId).destinations.find((x) => x.id === id);
    if (!d) throw new EnVivoRefusal('NOT_FOUND', 'not_found');
    return d;
  };
  const view = (userId: string): LiveState => {
    const u = get(userId);
    return {
      title: u.title,
      isLive: false,
      clipsEnabled: u.clipsEnabled,
      isFullAccess: true,
      broadcastMeta: u.meta,
      rtmpUrl: 'rtmp://ingest.chalyb.com/live',
      previewEnabled: false,
      oauthAvailable: { kick: true, twitch: true, youtube: true },
      destinations: u.destinations.map(({ key, ...d }) => ({ ...d, hasStreamKey: key.length > 0 })),
    };
  };
  const connectPlatform = (userId: string, platform: OAuthPlatform) => {
    const u = get(userId);
    const existing = u.destinations.find((d) => d.platformId === platform);
    const handle = 'mi_canal';
    if (existing) {
      Object.assign(existing, {
        channelHandle: handle,
        oauthConnected: true,
        key: 'oauth_key',
        status: { kind: 'ok' },
      });
      existing.ingestUrl ||= PLATFORM_META[platform].ingestHint;
    } else {
      u.destinations.push({
        id: `d_${++u.seq}`,
        platformId: platform,
        channelHandle: handle,
        streamTitle: u.title,
        ingestUrl: PLATFORM_META[platform].ingestHint,
        key: 'oauth_key',
        hasStreamKey: true,
        oauthConnected: true,
        enabled: true,
        status: { kind: 'ok' },
      });
    }
  };
  return honorSignal<EnVivoAdapter>({
    capabilities: () => ({ supportsConnect: true, likenessOptions: [] }),
    state: async (u) => view(u),
    setTitle: async (userId, title) => {
      get(userId).title = title.trim() || 'Mi transmisión en vivo';
    },
    setClipsEnabled: async (userId, on) => {
      get(userId).clipsEnabled = on;
    },
    streamKey: async (u) => get(u).streamKey,
    regenerateKey: async (userId) => {
      get(userId).streamKey = freshKey();
    },
    addDestination: async (userId, platformId) => {
      const u = get(userId);
      u.destinations.push({
        id: `d_${++u.seq}`,
        platformId,
        channelHandle: '',
        streamTitle: '',
        ingestUrl: PLATFORM_META[platformId].ingestHint,
        key: '',
        hasStreamKey: false,
        oauthConnected: false,
        enabled: false,
        status: { kind: 'offline' },
      });
    },
    updateDestination: async (userId, id, patch) => {
      const d = find(userId, id);
      if (patch.channelHandle !== undefined) d.channelHandle = patch.channelHandle;
      if (patch.streamTitle !== undefined) d.streamTitle = patch.streamTitle;
      if (patch.ingestUrl !== undefined) d.ingestUrl = patch.ingestUrl;
      if (patch.streamKey !== undefined) d.key = patch.streamKey;
    },
    toggleDestination: async (userId, id) => {
      const d = find(userId, id);
      if (!d.enabled && !(d.ingestUrl.trim() && d.key.trim()))
        throw new EnVivoRefusal('BAD_REQUEST', 'not_configured');
      d.enabled = !d.enabled;
      return d.enabled;
    },
    removeDestination: async (userId, id) => {
      find(userId, id);
      const u = get(userId);
      u.destinations = u.destinations.filter((d) => d.id !== id);
    },
    destinationKey: async (userId, id) => find(userId, id).key,
    publishBroadcast: async (userId, meta) => {
      const u = get(userId);
      const clean = normalizeBroadcastMeta(meta, u.title);
      u.meta = clean;
      u.title = clean.title;
      for (const d of u.destinations) d.streamTitle = clean.title;
    },
    streams: async (u) => get(u).streams,
    // The mock "platform" signs in at once: its consent page is the hub's own
    // callback with a fixed code, so the popup flow runs end to end.
    oauthAuthorizeUrl: async (_u, platform, input) =>
      `/api/tools/chalybobs/oauth/callback?platform=${platform}&code=mock-code&state=${encodeURIComponent(input.state)}`,
    oauthComplete: async (userId, platform, input) => {
      if (input.code !== 'mock-code') throw new EnVivoRefusal('BAD_REQUEST', 'exchange_failed');
      connectPlatform(userId, platform);
    },
    previewToken: async () => null,
  });
}

export function createMockAsistente(): AsistenteAdapter {
  const configs = new Map<string, AssistantConfig>();
  return {
    capabilities: () => CAPS,
    channels: async () => ['whatsapp', 'instagram', 'web'],
    getConfig: async (u) => configs.get(u) ?? null,
    saveConfig: async (u, c) => {
      configs.set(u, c);
    },
    test: async (u, message) => {
      const c = configs.get(u);
      const fact = c?.knowledge.split(/[.\n]/).find((l) => l.trim()) ?? '';
      return fact
        ? `Sobre "${message}": ${fact.trim()}.`
        : `Gracias por tu mensaje: "${message}". Te respondemos pronto.`;
    },
  };
}

export function createMockPronosticos(now = () => Date.now()): PronosticosAdapter {
  const day = new Date(Math.floor(now() / 86_400_000) * 86_400_000).toISOString();
  const list: Forecast[] = [
    {
      id: 'f1',
      match: 'América vs. Chivas',
      forecast: 'Partido cerrado, pocos goles',
      why: 'Ambos llegan con defensas sólidas en sus últimos cinco partidos.',
      confidence: 'medium',
      at: day,
    },
    {
      id: 'f2',
      match: 'Monterrey vs. Tigres',
      forecast: 'Ventaja local',
      why: 'Monterrey ganó 4 de sus últimos 5 partidos en casa.',
      confidence: 'high',
      at: day,
    },
  ];
  return { capabilities: () => CAPS, today: async () => list };
}

export function createMockInmuebles(now = () => Date.now()): InmueblesAdapter {
  const cards = new Map<string, PropertyCard[]>();
  return {
    capabilities: () => CAPS,
    list: async (u) => cards.get(u) ?? [],
    create: async (u, input) => {
      const id = `prop_${now().toString(36)}`;
      const card: PropertyCard = {
        id,
        title: input.title,
        description: `${input.title}. ${input.details}`.trim(),
        photos: input.photos,
        shareUrl: `/p/${id}`,
        createdAt: new Date(now()).toISOString(),
      };
      cards.set(u, [card, ...(cards.get(u) ?? [])]);
      return card;
    },
  };
}

export function createMockInversiones(): InversionesAdapter {
  const rules = new Map<string, AutomationRule[]>();
  return {
    capabilities: () => ({ ...CAPS, supportsConnect: true }),
    exchanges: async () => ['Bitso', 'Binance'],
    // Keys whose id contains "withdraw" report withdrawal permission, "read"
    // read-only, anything else read + trade.
    checkPermissions: async ({ apiKey }) =>
      apiKey.includes('withdraw')
        ? { read: true, trade: true, withdraw: true }
        : apiKey.includes('read')
          ? { read: true, trade: false, withdraw: false }
          : { read: true, trade: true, withdraw: false },
    rules: async (u) => rules.get(u) ?? [],
    saveRule: async (u, r) => {
      rules.set(u, [r, ...(rules.get(u) ?? []).filter((x) => x.id !== r.id)]);
    },
    setActive: async (u, id, active) => {
      rules.set(
        u,
        (rules.get(u) ?? []).map((r) => (r.id === id ? { ...r, active } : r)),
      );
    },
  };
}
