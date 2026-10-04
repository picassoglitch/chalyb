// In-memory adapters for Señales, En vivo, Asistente, Pronósticos, Inmuebles
// and Inversiones — development and e2e only (TOOL_HUB_MODE_<SLUG>=mock,
// refused in production builds without E2E_USE_MOCK_ADAPTERS=1).
// Content here is sample engine output, not advice and not real data.

import type {
  AsistenteAdapter,
  AssistantConfig,
  AutomationRule,
  Coin,
  EnVivoAdapter,
  LiveDevice,
  LivePlatform,
  LiveSettings,
  PairingCode,
  PastStream,
  Forecast,
  InmueblesAdapter,
  InversionesAdapter,
  LiveStatus,
  PronosticosAdapter,
  PricePoint,
  PropertyCard,
  SenalesAdapter,
  Signal,
  SignalPrefs,
  SignalRange,
  ToolCapabilities,
} from './tools';
import { honorSignal } from './signal';

const CAPS: ToolCapabilities = { supportsConnect: false, likenessOptions: [] };

const COINS: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'LTC', name: 'Litecoin' },
];

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
  });
}

/** How long after a pairing code is issued the mock "program" types it in. */
const MOCK_PAIR_AFTER_MS = 3000;

export function createMockEnVivo(now = () => Date.now()): EnVivoAdapter {
  interface UserLive {
    status: Omit<LiveStatus, 'obsConnected' | 'paired' | 'viewers' | 'platforms'>;
    devices: LiveDevice[];
    code: (PairingCode & { issuedMs: number }) | null;
    settings: LiveSettings;
    streams: PastStream[];
  }
  const users = new Map<string, UserLive>();
  const NAMES: Record<LivePlatform, string> = { youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick', facebook: 'Facebook' };
  const get = (userId: string): UserLive => {
    let u = users.get(userId);
    if (!u) {
      u = {
        status: {
          title: 'Mi transmisión',
          scenes: [
            { id: 'cam', name: 'Cámara', note: 'Solo tú' },
            { id: 'screen', name: 'Pantalla', note: 'Pantalla y cámara' },
            { id: 'pause', name: 'Pausa', note: 'Vuelvo enseguida' },
          ],
          activeSceneId: 'cam',
          mic: true,
          cam: true,
          clipsAfter: true,
          internet: 'good',
          liveSince: null,
        },
        devices: [],
        code: null,
        settings: {
          destinations: [
            { platform: 'youtube', connected: true, handle: '@mi-canal', enabled: true },
            { platform: 'twitch', connected: true, handle: 'mi-canal', enabled: true },
            { platform: 'kick', connected: false, handle: null, enabled: false },
            { platform: 'facebook', connected: false, handle: null, enabled: false },
          ],
          quality: 'auto',
          clipsAfter: true,
          saveRecording: true,
          advanced: { bitrateKbps: 6000, resolution: '1080p30', server: 'auto' },
        },
        streams: [],
      };
      users.set(userId, u);
    }
    // The mock program "types" an issued code after a few seconds.
    if (u.code && now() - u.code.issuedMs >= MOCK_PAIR_AFTER_MS && now() < Date.parse(u.code.expiresAt)) {
      u.devices.push({
        id: `dev_${u.devices.length + 1}`,
        name: 'Mi computadora',
        os: 'windows',
        obsReady: true,
        online: true,
        lastSeenAt: new Date(now()).toISOString(),
      });
      u.code = null;
    }
    return u;
  };
  const view = (userId: string): LiveStatus => {
    const u = get(userId);
    const online = u.devices.some((d) => d.online && d.obsReady);
    return {
      ...u.status,
      clipsAfter: u.settings.clipsAfter,
      obsConnected: online,
      paired: u.devices.length > 0,
      platforms: u.settings.destinations.filter((d) => d.enabled).map((d) => NAMES[d.platform]),
      viewers: u.status.liveSince ? 12 : null,
    };
  };
  const patch = (userId: string, p: Partial<UserLive['status']>) => {
    const u = get(userId);
    u.status = { ...u.status, ...p };
    return view(userId);
  };
  return honorSignal({
    capabilities: () => ({ supportsConnect: true, likenessOptions: [] }),
    status: async (u) => view(u),
    start: async (u) => patch(u, { liveSince: new Date(now()).toISOString() }),
    stop: async (userId) => {
      const u = get(userId);
      if (u.status.liveSince) {
        const v = view(userId);
        u.streams.unshift({
          id: `st_${u.streams.length + 1}`,
          title: u.status.title,
          startedAt: u.status.liveSince,
          durationSec: Math.max(1, Math.round((now() - Date.parse(u.status.liveSince)) / 1000)),
          platforms: v.platforms,
          recordingUrl: u.settings.saveRecording ? `https://www.youtube.com/watch?v=mock${u.streams.length + 1}` : null,
        });
      }
      return patch(userId, { liveSince: null });
    },
    setScene: async (u, id) => patch(u, { activeSceneId: id }),
    toggle: async (userId, what) => {
      const u = get(userId);
      if (what === 'clipsAfter') {
        u.settings = { ...u.settings, clipsAfter: !u.settings.clipsAfter };
        return view(userId);
      }
      return patch(userId, { [what]: !u.status[what] } as Partial<UserLive['status']>);
    },
    devices: async (u) => get(u).devices,
    createPairingCode: async (userId) => {
      const u = get(userId);
      const code = String(100000 + Math.floor(Math.random() * 900000));
      const issuedMs = now();
      u.code = { code, expiresAt: new Date(issuedMs + 10 * 60_000).toISOString(), issuedMs };
      return { code, expiresAt: u.code.expiresAt };
    },
    disconnectDevice: async (userId, id) => {
      const u = get(userId);
      u.devices = u.devices.filter((d) => d.id !== id);
    },
    settings: async (u) => get(u).settings,
    saveSettings: async (userId, p) => {
      const u = get(userId);
      const { enabled, ...rest } = p;
      u.settings = {
        ...u.settings,
        ...rest,
        destinations: u.settings.destinations.map((d) =>
          enabled && d.platform in enabled ? { ...d, enabled: d.connected && !!enabled[d.platform] } : d,
        ),
      };
      return u.settings;
    },
    connectDestination: async (userId, platform) => {
      const u = get(userId);
      u.settings = {
        ...u.settings,
        destinations: u.settings.destinations.map((d) =>
          d.platform === platform ? { ...d, connected: true, handle: '@mi-canal', enabled: true } : d,
        ),
      };
      return u.settings;
    },
    streams: async (u) => get(u).streams,
    streamKey: async (_u, platform) => `live_${platform}_mock_0000_1111_2222`,
    clipMoment: async (userId, windowSec) => {
      const u = get(userId);
      if (!u.status.liveSince || !u.settings.saveRecording) return null;
      return { sourceUrl: `https://www.youtube.com/watch?v=mocklive&t=${windowSec}` };
    },
    download: async (os) => ({
      filename: `chalyb-en-vivo-${os}.txt`,
      body: 'Archivo de prueba del programa de En vivo (solo desarrollo).\n',
    }),
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
