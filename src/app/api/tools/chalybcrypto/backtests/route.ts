// POST /api/tools/chalybcrypto/backtests {strategy, pair, timeframe, bars}
// — queue a backtest on the engine. The engine runs the hub's usage
// admission first: a refusal comes back as 402 usage_refused + the reason
// (no_tokens, jobs_cap, …). Not idempotent: never retried.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { ToolRequestError } from '@/lib/tools/bff-core';
import { requirePair } from '@/lib/tools/senales-market';
import { validateBacktest } from '@/lib/tools/senales-market-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute('chalybcrypto', getSenales, async (a, { session, body, signal }) => {
  const strategies = await a.strategies(session.user.id, signal);
  const check = validateBacktest(
    body,
    new Set(strategies.filter((s) => s.enabled).map((s) => s.key)),
  );
  if (!check.ok) throw new ToolRequestError(check.field);
  const pair = await requirePair(a, session.user.id, check.value.pair, signal);
  return a.queueBacktest(session.user.id, { ...check.value, pair }, signal);
});

export async function POST(req: Request) {
  return handler(req);
}
