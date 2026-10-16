// Contracts between the hub's tool screens and the engines (rebuild P3).
//
// The hub owns the screens; each engine owns the work. None of the engines
// publishes a job/settings API yet (docs/engines/*.md is OPS-13), so every
// real adapter is a typed stub that throws NOT_IMPLEMENTED and the mock
// adapters (mock-tools.ts) power development and e2e. A tool's screens light
// up in production by implementing its adapter and setting
// TOOL_HUB_MODE_<SLUG>=a.
//
// LEGAL SHAPE (deploy-blocking tests in tests/guardrails.test.ts):
//  - Señales content takes the PLAN, never a user (REVISION-LEGAL C1).
//  - Inversiones rules are user-written only; withdrawal keys are refused.
//  - Any option that clones a voice or face declares usesLikeness and sits
//    behind requireLikenessConsent (BUILD-SPEC §11.6).
//
// Types only (plus the error classes); En vivo's platform catalogue lives in
// envivo-platforms.ts.

import type { BroadcastMeta, OAuthPlatform, PlatformId } from '../envivo-platforms';

export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED';
  constructor(what: string) {
    super(`${what}: the engine has no API for this yet (OPS-13)`);
  }
}

/** What a tool can do, so screens never show a button with no action. */
export interface ToolCapabilities {
  supportsConnect: boolean;
  /** Options that use a real person's voice or face. Empty in this phase. */
  likenessOptions: { id: string; usesLikeness: true }[];
}

// ── Señales ──────────────────────────────────────────────────────────
export type SignalState = 'buy' | 'sell' | 'wait';
export type SignalConfidence = 'high' | 'medium' | 'none';
export type PlanTierKey = 'FREE' | 'PRO' | 'VIP';

/** One signal: the engine's general state for a coin, the same for every
 *  user of a plan. Never personalised. */
export interface Signal {
  id: string;
  coin: string;
  state: SignalState;
  confidence: SignalConfidence;
  /** The engine's own general explanation; the hub never writes signal text. */
  explanation: string;
  at: string;
  /** Reference price when the signal was made (Q5 default: MXN). */
  refPriceMXN?: number;
  /** The engine's "por qué": a short line about the PRICE, never the person,
   *  and up to 3 bullets for the detail (TOOLS-SPEC §5.2–§5.3). */
  why?: { short: string; bullets: string[] };
}

export type SignalRange = '1d' | '7d' | '1m';

/** One point of the past price (the detail chart shows the past only). */
export interface PricePoint {
  at: string;
  priceMXN: number;
}

export interface Coin {
  symbol: string;
  name: string;
}

export type SignalChannel = 'whatsapp' | 'email' | 'app';

/** Delivery preferences. Coins only FILTER which notices arrive; nothing
 *  here may change a signal's content. No balance, position, goal or risk
 *  profile — ever. */
export interface SignalPrefs {
  coins: string[];
  channels: SignalChannel[];
  /** Corto plazo (day) / Mediano plazo (week): filters which signals
   *  arrive; the signals are the same for everyone. */
  timeframe: 'day' | 'week';
  quietHours: boolean;
  /** Horario (TOOLS-SPEC §5.4), 'HH:MM' 24 h. */
  from?: string;
  to?: string;
  days?: 'all' | 'weekdays';
  /** Opciones avanzadas: one summary a day; short or explained notices. */
  dailySummary?: boolean;
  format?: 'short' | 'explained';
}

// ── Señales · Mercado y Estrategias (parity with the engine's panel) ──
// General market data, the same for everyone: prices, the order book,
// derivatives context, news, the engine's strategies and its backtest queue.
// The user id these take is only who the engine call is made for (auth);
// it never shapes the data. No accounts, keys, orders or holdings here.

export type MarketVenueId = 'bitunix' | 'lbank' | 'binance';

export interface MarketVenue {
  id: MarketVenueId;
  name: string;
  /** Data-only venue (historical klines, no live book). */
  dataOnly: boolean;
}

export interface MarketSymbol {
  symbol: string;
  base: string;
  quote: string;
}

export interface MarketList {
  venues: MarketVenue[];
  venue: MarketVenueId;
  symbols: MarketSymbol[];
  /** The venue's list couldn't be read; symbols may be empty. */
  degraded: boolean;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SeriesPoint {
  time: number;
  value: number;
}

export interface MarketIndicators {
  candles: Candle[];
  rsi: SeriesPoint[];
  macd: { line: SeriesPoint[]; signal: SeriesPoint[]; hist: SeriesPoint[] };
  adx: SeriesPoint[];
  volumeDelta: SeriesPoint[];
}

export interface BookLevel {
  price: number;
  size: number;
  cumulative: number;
}

export interface OrderBook {
  pair: string;
  takenAt: string;
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface DerivativesContext {
  symbol: string;
  interval: string;
  openInterest: SeriesPoint[];
  funding: SeriesPoint[];
  liquidations: { time: number; longUsd: number; shortUsd: number }[];
  longShort: { time: number; longPct: number; shortPct: number }[];
  heatmap: { price: number; amountUsd: number }[];
}

export interface NewsItem {
  publishedAt: string;
  title: string;
  url: string;
  source: string;
}

export interface EngineStrategy {
  key: string;
  name: string;
  enabled: boolean;
}

export interface BacktestInput {
  strategy: string;
  pair: string;
  timeframe: string;
  bars: number;
}

/** One backtest run on past data. Always optimistic (engine rule). */
export interface BacktestResult extends BacktestInput {
  jobId: string;
  status: 'done' | 'failed';
  /** Set when status is 'failed' (e.g. 'data_unavailable'). */
  error?: string;
  barsRequested: number;
  /** Where the past candles came from ('binance', 'bitunix'). */
  dataSource?: string;
  from?: string;
  to?: string;
  startingEquity?: number;
  endingEquity?: number;
  /** Net change of the simulated account, in basis points. */
  netReturnBps?: number;
  metrics?: {
    sampleSize: number;
    winRate: number;
    avgWinBps: number;
    avgLossBps: number;
    profitFactor: number | null;
    maxDrawdownBps: number;
    feeDragBps: number;
  };
  assumptions?: {
    riskPerTradeBps: number;
    takerBps: number;
    makerBps: number;
    spreadBps: number;
    slippageBps: number;
  };
  createdAt?: string;
  optimistic: true;
}

export interface SenalesAdapter {
  capabilities(): ToolCapabilities;
  coins(signal?: AbortSignal): Promise<Coin[]>;
  channels(signal?: AbortSignal): Promise<SignalChannel[]>;
  /** CONTENT: by plan only. There is deliberately no user parameter. */
  getSignals(
    input: { plan: PlanTierKey; coins?: string[]; since?: string },
    signal?: AbortSignal,
  ): Promise<Signal[]>;
  /** One signal and its past price, by plan. No user parameter either. */
  getSignal(
    input: {
      plan: PlanTierKey;
      id: string;
      range: SignalRange;
    },
    signal?: AbortSignal,
  ): Promise<{ signal: Signal; series: PricePoint[] } | null>;
  /** DELIVERY: the user's filter. */
  getPrefs(userId: string, signal?: AbortSignal): Promise<SignalPrefs | null>;
  savePrefs(userId: string, prefs: SignalPrefs, signal?: AbortSignal): Promise<void>;

  // Mercado / Estrategias. `userId` authenticates the engine call only.
  markets(userId: string, venue: MarketVenueId, signal?: AbortSignal): Promise<MarketList>;
  indicators(
    userId: string,
    input: { pair: string; interval: string; bars: number },
    signal?: AbortSignal,
  ): Promise<MarketIndicators>;
  orderBook(userId: string, pair: string, signal?: AbortSignal): Promise<OrderBook>;
  /** Null when the engine has no derivatives data source configured. */
  derivatives(
    userId: string,
    input: { pair: string; interval: string },
    signal?: AbortSignal,
  ): Promise<DerivativesContext | null>;
  /** Null when the engine has no news source configured. */
  news(userId: string, coin: string, signal?: AbortSignal): Promise<NewsItem[] | null>;
  strategies(userId: string, signal?: AbortSignal): Promise<EngineStrategy[]>;
  /** Runs now and returns the result. Hub usage admission runs inside the
   *  engine: a refusal throws USAGE_REFUSED with the reason; a run that
   *  fails is not charged. */
  runBacktest(userId: string, input: BacktestInput, signal?: AbortSignal): Promise<BacktestResult>;
  /** The person's past runs, newest first. */
  listBacktests(userId: string, signal?: AbortSignal): Promise<BacktestResult[]>;
}

// ── En vivo ──────────────────────────────────────────────────────────
// The engine (ChalyOBS) is an RTMP relay: the person pastes our RTMP URL and
// stream key into OBS (or any encoder), and the relay re-sends the signal to
// every destination that is on. Shaped on the engine's hub API
// (/api/hub/v1, ChalyOBS docs) — nothing here exists only in the hub.

export type DestinationStatus =
  | { kind: 'ok' }
  | { kind: 'offline' }
  | { kind: 'expired' }
  | { kind: 'pending_approval'; platformName: string };

/** One place the stream is re-sent to. Keys never travel in this shape:
 *  only whether there is one. */
export interface LiveDestination {
  id: string;
  platformId: PlatformId;
  channelHandle: string;
  streamTitle: string;
  ingestUrl: string;
  hasStreamKey: boolean;
  /** Connected with the platform's sign-in (key filled automatically). */
  oauthConnected: boolean;
  enabled: boolean;
  status: DestinationStatus | null;
}

export interface LiveState {
  title: string;
  /** The relay is receiving the encoder's signal right now. */
  isLive: boolean;
  /** Streams go on to Clips (the engine's "ChalyClip" connection). */
  clipsEnabled: boolean;
  /** The plan may turn the Clips connection on (engine isFullAccessTier). */
  isFullAccess: boolean;
  broadcastMeta: BroadcastMeta;
  /** Server field for the encoder. The key is never part of the state. */
  rtmpUrl: string;
  previewEnabled: boolean;
  oauthAvailable: Partial<Record<OAuthPlatform, boolean>>;
  destinations: LiveDestination[];
}

export interface DestinationPatch {
  channelHandle?: string;
  streamTitle?: string;
  ingestUrl?: string;
  /** Absent = keep the saved key. */
  streamKey?: string;
}

export interface PastStream {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSec: number | null;
}

/** A refusal the engine explains (the person's state, never an outage).
 *  `code` is the BFF's vocabulary (normalizeToolError); `detail` is the
 *  engine's code ("full_access_required", "not_configured", …). */
export class EnVivoRefusal extends Error {
  constructor(
    readonly code: 'NEEDS_PLAN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'FORBIDDEN',
    readonly detail: string,
  ) {
    super(detail);
  }
}

export interface EnVivoAdapter {
  capabilities(): ToolCapabilities;
  state(userId: string, signal?: AbortSignal): Promise<LiveState>;
  setTitle(userId: string, title: string, signal?: AbortSignal): Promise<void>;
  setClipsEnabled(userId: string, on: boolean, signal?: AbortSignal): Promise<void>;
  /** The secret ingest key. Only on "Mostrar"; never logged or cached. */
  streamKey(userId: string, signal?: AbortSignal): Promise<string>;
  regenerateKey(userId: string, signal?: AbortSignal): Promise<void>;
  addDestination(userId: string, platformId: PlatformId, signal?: AbortSignal): Promise<void>;
  updateDestination(
    userId: string,
    id: string,
    patch: DestinationPatch,
    signal?: AbortSignal,
  ): Promise<void>;
  toggleDestination(userId: string, id: string, signal?: AbortSignal): Promise<boolean>;
  removeDestination(userId: string, id: string, signal?: AbortSignal): Promise<void>;
  /** A destination's saved key, only on "Mostrar". */
  destinationKey(userId: string, id: string, signal?: AbortSignal): Promise<string>;
  publishBroadcast(userId: string, meta: BroadcastMeta, signal?: AbortSignal): Promise<void>;
  streams(userId: string, signal?: AbortSignal): Promise<PastStream[]>;
  /** The platform's consent page for a hub-started OAuth (state "hub.…"). */
  oauthAuthorizeUrl(
    userId: string,
    platform: OAuthPlatform,
    input: { state: string; codeChallenge?: string },
    signal?: AbortSignal,
  ): Promise<string>;
  oauthComplete(
    userId: string,
    platform: OAuthPlatform,
    input: { code: string; codeVerifier?: string },
    signal?: AbortSignal,
  ): Promise<void>;
  /** A short-lived path segment for the preview proxy, or null when the
   *  adapter has no live video (mock). Carries no stream key. */
  previewToken(userId: string, signal?: AbortSignal): Promise<string | null>;
}

// ── Asistente ────────────────────────────────────────────────────────
export type AssistantChannel = 'whatsapp' | 'instagram' | 'web';

export interface AssistantConfig {
  businessName: string;
  channel: AssistantChannel;
  knowledge: string;
}

export interface AsistenteAdapter {
  capabilities(): ToolCapabilities;
  channels(): Promise<AssistantChannel[]>;
  getConfig(userId: string): Promise<AssistantConfig | null>;
  saveConfig(userId: string, config: AssistantConfig): Promise<void>;
  /** A reply to a test message. The hub prepends the self-identification. */
  test(userId: string, message: string): Promise<string>;
}

// ── Pronósticos ──────────────────────────────────────────────────────
export interface Forecast {
  id: string;
  match: string;
  forecast: string;
  why: string;
  confidence: 'high' | 'medium';
  at: string;
}

export interface PronosticosAdapter {
  capabilities(): ToolCapabilities;
  today(): Promise<Forecast[]>;
}

// ── Inmuebles ────────────────────────────────────────────────────────
export interface PropertyCard {
  id: string;
  title: string;
  description: string;
  photos: string[];
  shareUrl: string;
  createdAt: string;
}

export interface InmueblesAdapter {
  capabilities(): ToolCapabilities;
  list(userId: string): Promise<PropertyCard[]>;
  create(
    userId: string,
    input: { title: string; details: string; photos: string[] },
  ): Promise<PropertyCard>;
}

// ── Inversiones ──────────────────────────────────────────────────────
export interface KeyPermissions {
  read: boolean;
  trade: boolean;
  withdraw: boolean;
}

/** A rule is ALWAYS written by the user. `source` exists only so a schema
 *  test can prove nothing else (a signal, a template) can create one. */
export interface AutomationRule {
  id: string;
  source: 'user';
  asset: string;
  side: 'buy' | 'sell';
  /** Plain-language condition the user wrote, e.g. "si BTC baja de 60,000". */
  condition: string;
  maxAmount: number;
  schedule: string;
  active: boolean;
  createdAt: string;
}

export interface InversionesAdapter {
  capabilities(): ToolCapabilities;
  exchanges(): Promise<string[]>;
  /** Ask the exchange what this key may do (the hub refuses withdraw). */
  checkPermissions(input: {
    exchange: string;
    apiKey: string;
    apiSecret: string;
  }): Promise<KeyPermissions>;
  rules(userId: string): Promise<AutomationRule[]>;
  saveRule(userId: string, rule: AutomationRule): Promise<void>;
  setActive(userId: string, ruleId: string, active: boolean): Promise<void>;
}
