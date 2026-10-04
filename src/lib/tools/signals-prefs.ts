// Señales delivery preferences from a screen's autosave (TOOLS-SPEC §5.3–
// §5.4). Pure: unknown coins and channels are dropped, times must be HH:MM,
// and nothing outside SignalPrefs gets through (no money fields exist).

import type { SignalChannel, SignalPrefs } from './adapters/tools';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_PREFS: SignalPrefs = {
  coins: [],
  channels: ['app'],
  timeframe: 'day',
  quietHours: true,
  from: '08:00',
  to: '22:00',
  days: 'all',
  dailySummary: false,
  format: 'short',
};

export function mergePrefs(
  prev: SignalPrefs | null,
  patch: unknown,
  known: { coins: Set<string>; channels: Set<string> },
): SignalPrefs {
  const p = (patch && typeof patch === 'object' ? patch : {}) as Record<string, unknown>;
  const base: SignalPrefs = { ...DEFAULT_PREFS, ...(prev ?? {}) };
  const out: SignalPrefs = { ...base };
  if (Array.isArray(p.coins)) {
    const coins = [...new Set(p.coins.map(String).filter((c) => known.coins.has(c)))];
    // At least one coin always stays (an empty list would undo the setup).
    if (coins.length) out.coins = coins;
  }
  if (Array.isArray(p.channels))
    out.channels = [
      ...new Set(p.channels.map(String).filter((c): c is SignalChannel => known.channels.has(c))),
    ] as SignalChannel[];
  if (p.timeframe === 'day' || p.timeframe === 'week') out.timeframe = p.timeframe;
  if (typeof p.quietHours === 'boolean') out.quietHours = p.quietHours;
  if (typeof p.from === 'string' && TIME.test(p.from)) out.from = p.from;
  if (typeof p.to === 'string' && TIME.test(p.to)) out.to = p.to;
  if (p.days === 'all' || p.days === 'weekdays') out.days = p.days;
  if (typeof p.dailySummary === 'boolean') out.dailySummary = p.dailySummary;
  if (p.format === 'short' || p.format === 'explained') out.format = p.format;
  return out;
}

/** "Recibir avisos de esta moneda" on the detail: add or remove one coin. */
export function toggleCoin(prefs: SignalPrefs, coin: string, on: boolean): string[] {
  const set = new Set(prefs.coins);
  if (on) set.add(coin);
  else set.delete(coin);
  return [...set];
}
