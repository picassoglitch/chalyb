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
}

// ── En vivo ──────────────────────────────────────────────────────────
// TOOLS-SPEC §1.3 / §6. The engine pairs a small desktop program with a
// 6-digit code and drives OBS through it (Q6 default). Viewers come from the
// platforms with the user's connected accounts, null when unknown (Q7).

export interface LiveScene {
  id: string;
  name: string;
  /** Short description under the name ("Solo tú", "Vuelvo enseguida"). */
  note?: string;
}

export type LivePlatform = 'youtube' | 'twitch' | 'kick' | 'facebook';
export const LIVE_PLATFORMS: readonly LivePlatform[] = ['youtube', 'twitch', 'kick', 'facebook'];

export interface LiveStatus {
  /** A paired computer is online with OBS ready. */
  obsConnected: boolean;
  /** At least one computer was ever paired (57 vs "no está conectada"). */
  paired: boolean;
  /** Display names of the destinations this stream goes to. */
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
  /** People watching, or null when the platforms don't tell us (Q7). */
  viewers: number | null;
}

export interface LiveDevice {
  id: string;
  name: string;
  os: 'windows' | 'mac' | 'linux';
  obsReady: boolean;
  online: boolean;
  lastSeenAt: string;
}

export interface PairingCode {
  /** 6 digits, single use. */
  code: string;
  /** 10 minutes after it was issued. */
  expiresAt: string;
}

export type LiveQuality = 'auto' | 'high' | 'saver';

export interface LiveDestination {
  platform: LivePlatform;
  connected: boolean;
  /** "@usuario" on the platform, once connected. */
  handle: string | null;
  /** Stream there (the switch). Only a connected destination can be on. */
  enabled: boolean;
}

export interface LiveAdvanced {
  bitrateKbps: number;
  resolution: '1080p60' | '1080p30' | '720p60' | '720p30';
  /** Ingest server per platform, "auto" by default. */
  server: string;
}

export interface LiveSettings {
  destinations: LiveDestination[];
  quality: LiveQuality;
  clipsAfter: boolean;
  /** "Guardar la grabación": needed for "Hacer clip de este momento". */
  saveRecording: boolean;
  advanced: LiveAdvanced;
}

export interface PastStream {
  id: string;
  title: string;
  startedAt: string;
  durationSec: number;
  platforms: string[];
  /** A link the Clips wizard can read, when the recording was kept. */
  recordingUrl: string | null;
}

/** The desktop program, served from our own domain in the same tab. */
export type LiveDownload = { url: string } | { filename: string; body: string };

export interface EnVivoAdapter {
  capabilities(): ToolCapabilities;
  status(userId: string, signal?: AbortSignal): Promise<LiveStatus>;
  start(userId: string, signal?: AbortSignal): Promise<LiveStatus>;
  stop(userId: string, signal?: AbortSignal): Promise<LiveStatus>;
  setScene(userId: string, sceneId: string, signal?: AbortSignal): Promise<LiveStatus>;
  toggle(
    userId: string,
    what: 'mic' | 'cam' | 'clipsAfter',
    signal?: AbortSignal,
  ): Promise<LiveStatus>;
  devices(userId: string, signal?: AbortSignal): Promise<LiveDevice[]>;
  createPairingCode(userId: string, signal?: AbortSignal): Promise<PairingCode>;
  disconnectDevice(userId: string, deviceId: string, signal?: AbortSignal): Promise<void>;
  settings(userId: string, signal?: AbortSignal): Promise<LiveSettings>;
  saveSettings(
    userId: string,
    patch: Partial<Omit<LiveSettings, 'destinations'>> & {
      enabled?: Partial<Record<LivePlatform, boolean>>;
    },
    signal?: AbortSignal,
  ): Promise<LiveSettings>;
  /** After the platform's OAuth (same tab) comes back. */
  connectDestination(
    userId: string,
    platform: LivePlatform,
    signal?: AbortSignal,
  ): Promise<LiveSettings>;
  streams(userId: string, signal?: AbortSignal): Promise<PastStream[]>;
  /** The secret stream key. Only called when the person asks to see it;
   *  never logged, never rendered before that. */
  streamKey(userId: string, platform: LivePlatform, signal?: AbortSignal): Promise<string>;
  /** A link to the last `windowSec` seconds of the live recording, or null
   *  when nothing is being recorded. */
  clipMoment(
    userId: string,
    windowSec: number,
    signal?: AbortSignal,
  ): Promise<{ sourceUrl: string } | null>;
  download(os: 'windows' | 'mac', signal?: AbortSignal): Promise<LiveDownload | null>;
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
