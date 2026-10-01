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
  Forecast,
  InmueblesAdapter,
  InversionesAdapter,
  LiveStatus,
  PronosticosAdapter,
  PropertyCard,
  SenalesAdapter,
  Signal,
  SignalPrefs,
  ToolCapabilities,
} from './tools';

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

export function createMockSenales(now = () => Date.now()): SenalesAdapter {
  const prefs = new Map<string, SignalPrefs>();
  // One feed per plan: the same for everyone on it.
  const feed = (plan: string): Signal[] =>
    COINS.slice(0, plan === 'FREE' ? 3 : 8).map((c, i) => ({
      id: `${plan}-${c.symbol}`,
      coin: c.symbol,
      state: (['buy', 'wait', 'sell'] as const)[i % 3]!,
      confidence: i % 3 === 1 ? 'none' : i % 2 ? 'medium' : 'high',
      explanation: `Muestra del motor para ${c.name}: tendencia general del mercado en las últimas horas.`,
      at: new Date(Math.floor(now() / 3_600_000) * 3_600_000 - i * 600_000).toISOString(),
    }));
  return {
    capabilities: () => CAPS,
    coins: async () => COINS,
    channels: async () => ['email', 'app'],
    getSignals: async ({ plan, coins }) =>
      feed(plan).filter((s) => !coins?.length || coins.includes(s.coin)),
    getPrefs: async (userId) => prefs.get(userId) ?? null,
    savePrefs: async (userId, p) => {
      prefs.set(userId, p);
    },
  };
}

export function createMockEnVivo(now = () => Date.now()): EnVivoAdapter {
  const state = new Map<string, LiveStatus>();
  const get = (userId: string): LiveStatus => {
    let s = state.get(userId);
    if (!s) {
      s = {
        obsConnected: !userId.includes('free'),
        platforms: ['YouTube', 'Twitch'],
        title: 'Mi transmisión',
        scenes: [
          { id: 'start', name: 'Inicio' },
          { id: 'cam', name: 'Cámara' },
          { id: 'game', name: 'Juego' },
          { id: 'pause', name: 'Pausa' },
        ],
        activeSceneId: 'start',
        mic: true,
        cam: true,
        clipsAfter: true,
        internet: 'good',
        liveSince: null,
      };
      state.set(userId, s);
    }
    return s;
  };
  const update = (userId: string, patch: Partial<LiveStatus>) => {
    const next = { ...get(userId), ...patch };
    state.set(userId, next);
    return next;
  };
  return {
    capabilities: () => CAPS,
    status: async (u) => get(u),
    start: async (u) => update(u, { liveSince: new Date(now()).toISOString() }),
    stop: async (u) => update(u, { liveSince: null }),
    setScene: async (u, id) => update(u, { activeSceneId: id }),
    toggle: async (u, what) => update(u, { [what]: !get(u)[what] } as Partial<LiveStatus>),
  };
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
