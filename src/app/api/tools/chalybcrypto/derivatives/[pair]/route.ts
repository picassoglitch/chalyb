// GET /api/tools/chalybcrypto/derivatives/{pair}?interval=1h — derivatives
// context (open interest, funding, liquidations, long/short, heatmap).
// Context only. data: null when the engine has no source configured.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { requirePair } from '@/lib/tools/senales-market';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INTERVALS = new Set(['1h', '4h', '1d']);

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { req, session, params, signal }) => {
    const pair = await requirePair(a, session.user.id, params.pair, signal);
    const raw = new URL(req.url).searchParams.get('interval') ?? '1h';
    return a.derivatives(
      session.user.id,
      { pair, interval: INTERVALS.has(raw) ? raw : '1h' },
      signal,
    );
  },
  { idempotent: true },
);

export async function GET(req: Request, ctx: { params: Promise<{ pair: string }> }) {
  return handler(req, ctx);
}
