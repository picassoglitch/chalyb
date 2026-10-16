// /api/tools/chalybcrypto/backtests
//   POST {strategy, pair, timeframe, bars} — run a backtest on the engine and
//        return its result (always OPTIMISTA). The engine runs the hub's usage
//        admission first: a refusal comes back as 402 usage_refused + the
//        reason (no_tokens, jobs_cap, …); a run that fails is not charged.
//        Not idempotent: never retried. Waits up to 55 s (the run happens in
//        the request so Cloud Run keeps CPU for it).
//   GET  — the person's past runs, newest first.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { ToolRequestError } from '@/lib/tools/bff-core';
import { requirePair } from '@/lib/tools/senales-market';
import { validateBacktest } from '@/lib/tools/senales-market-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const BACKTEST_TIMEOUT_MS = 55_000;

const run = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { session, body, signal }) => {
    const strategies = await a.strategies(session.user.id, signal);
    const check = validateBacktest(
      body,
      new Set(strategies.filter((s) => s.enabled).map((s) => s.key)),
    );
    if (!check.ok) throw new ToolRequestError(check.field);
    const pair = await requirePair(a, session.user.id, check.value.pair, signal);
    return a.runBacktest(session.user.id, { ...check.value, pair }, signal);
  },
  { timeoutMs: BACKTEST_TIMEOUT_MS },
);

const list = toolRoute(
  'chalybcrypto',
  getSenales,
  (a, { session, signal }) => a.listBacktests(session.user.id, signal),
  { idempotent: true },
);

export async function POST(req: Request) {
  return run(req);
}

export async function GET(req: Request) {
  return list(req);
}
