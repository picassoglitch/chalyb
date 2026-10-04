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
// Pure types, no imports.

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

export interface SenalesAdapter {
  capabilities(): ToolCapabilities;
  coins(): Promise<Coin[]>;
  channels(): Promise<SignalChannel[]>;
  /** CONTENT: by plan only. There is deliberately no user parameter. */
  getSignals(input: { plan: PlanTierKey; coins?: string[]; since?: string }): Promise<Signal[]>;
  /** One signal and its past price, by plan. No user parameter either. */
  getSignal(input: {
    plan: PlanTierKey;
    id: string;
    range: SignalRange;
  }): Promise<{ signal: Signal; series: PricePoint[] } | null>;
  /** DELIVERY: the user's filter. */
  getPrefs(userId: string): Promise<SignalPrefs | null>;
  savePrefs(userId: string, prefs: SignalPrefs): Promise<void>;
}

// ── En vivo ──────────────────────────────────────────────────────────
export interface LiveScene {
  id: string;
  name: string;
}

export interface LiveStatus {
  obsConnected: boolean;
  platforms: string[];
  title: string;
  scenes: LiveScene[];
  activeSceneId: string | null;
  mic: boolean;
  cam: boolean;
  clipsAfter: boolean;
  internet: 'good' | 'slow' | 'offline';
  /** ISO time the stream started, or null when off air. */
  liveSince: string | null;
}

export interface EnVivoAdapter {
  capabilities(): ToolCapabilities;
  status(userId: string): Promise<LiveStatus>;
  start(userId: string): Promise<LiveStatus>;
  stop(userId: string): Promise<LiveStatus>;
  setScene(userId: string, sceneId: string): Promise<LiveStatus>;
  toggle(userId: string, what: 'mic' | 'cam' | 'clipsAfter'): Promise<LiveStatus>;
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
