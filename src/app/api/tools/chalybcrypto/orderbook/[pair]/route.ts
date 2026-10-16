// GET /api/tools/chalybcrypto/orderbook/{pair} — the live order book (top 50
// per side), polled every 2 s by the Mercado screen.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { requirePair } from '@/lib/tools/senales-market';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { session, params, signal }) =>
    a.orderBook(
      session.user.id,
      await requirePair(a, session.user.id, params.pair, signal),
      signal,
    ),
  { idempotent: true },
);

export async function GET(req: Request, ctx: { params: Promise<{ pair: string }> }) {
  return handler(req, ctx);
}
