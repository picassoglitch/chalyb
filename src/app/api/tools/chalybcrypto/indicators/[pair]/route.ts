// GET /api/tools/chalybcrypto/indicators/{pair}?interval=5m — candles plus
// RSI(14), MACD(12/26/9), ADX(14) and volume delta (Señales · Mercado).

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { requirePair } from '@/lib/tools/senales-market';
import { parseInterval } from '@/lib/tools/senales-market-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { req, session, params, signal }) => {
    const pair = await requirePair(a, session.user.id, params.pair, signal);
    const interval = parseInterval(new URL(req.url).searchParams.get('interval'));
    return a.indicators(session.user.id, { pair, interval, bars: 300 }, signal);
  },
  { idempotent: true },
);

export async function GET(req: Request, ctx: { params: Promise<{ pair: string }> }) {
  return handler(req, ctx);
}
