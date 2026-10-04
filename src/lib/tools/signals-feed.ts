// The Señales feed for a screen: content by PLAN through the BFF, then the
// person's coin filter, then the §8 text filter. If the engine fails and
// this server already had the plan's feed, the screen shows the last one
// with the "te mostramos las últimas" banner (§5.2 error parcial);
// otherwise ToolErrorState.

import 'server-only';
import { runTool } from './bff';
import { signalsFor } from '@/lib/guardrails/signals';
import { screenSignal } from './signals-screen';
import type { PlanTierKey, SenalesAdapter, Signal } from './adapters/tools';
import type { ToolError } from './bff-core';

const store = globalThis as unknown as { __chalybSignalFeed?: Map<string, Signal[]> };
const cache = () => (store.__chalybSignalFeed ??= new Map());

export type FeedResult =
  | { ok: true; signals: Signal[]; stale: boolean }
  | { ok: false; error: ToolError };

export async function loadSignalFeed(
  adapter: SenalesAdapter,
  plan: PlanTierKey,
  userId: string,
  coins: string[],
): Promise<FeedResult> {
  const res = await runTool('chalybcrypto', userId, () => signalsFor(adapter, plan, []), {
    idempotent: true,
  });
  const filter = (all: Signal[]) =>
    (coins.length ? all.filter((s) => coins.includes(s.coin)) : all).map(screenSignal);
  if (res.ok) {
    cache().set(plan, res.data);
    return { ok: true, signals: filter(res.data), stale: false };
  }
  const last = cache().get(plan);
  if (last) return { ok: true, signals: filter(last), stale: true };
  return { ok: false, error: res.error };
}
