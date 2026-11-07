// The Señales feed for a screen: content by PLAN through the BFF, then the
// person's coin filter, then the §8 text filter. If the engine fails and
// this server already had the plan's feed, the screen shows the last one
// with the "te mostramos las últimas" banner (§5.2 error parcial);
// otherwise ToolErrorState.

import 'server-only';
import { runTool } from './bff';
import { signalsFor } from '@/lib/guardrails/signals';
import { screenSignal } from './signals-screen';
import { engineLang } from './engine-lang';
import type { PlanTierKey, SenalesAdapter, Signal } from './adapters/tools';
import type { ToolError } from './bff-core';
import type { AppLocale } from '@/i18n/locales';

const store = globalThis as unknown as { __chalybSignalFeed?: Map<string, Signal[]> };
const cache = () => (store.__chalybSignalFeed ??= new Map());

export type FeedResult =
  | { ok: true; signals: Signal[]; stale: boolean }
  | { ok: false; error: ToolError };

export async function loadSignalFeed(
  adapter: SenalesAdapter,
  plan: PlanTierKey,
  userId: string,
  /** The person's coins. May be a promise: the screens start the feed
   *  (content by plan, no user input) alongside the prefs read, and only the
   *  filter waits for the coins. */
  coins: string[] | Promise<string[]>,
  /** The screen's language (the adapter asks the engine for the same one). */
  lang: () => Promise<AppLocale> = engineLang,
): Promise<FeedResult> {
  const res = await runTool(
    'chalybcrypto',
    userId,
    (signal) => signalsFor(adapter, plan, [], signal),
    {
      idempotent: true,
    },
  );
  const mine = await coins;
  // #174 — the engine writes the text in the screen's language: es and en never share a fallback.
  const key = `${await lang()}:${plan}`;
  const filter = (all: Signal[]) =>
    (mine.length ? all.filter((s) => mine.includes(s.coin)) : all).map(screenSignal);
  if (res.ok) {
    cache().set(key, res.data);
    return { ok: true, signals: filter(res.data), stale: false };
  }
  const last = cache().get(key);
  if (last) return { ok: true, signals: filter(last), stale: true };
  return { ok: false, error: res.error };
}
