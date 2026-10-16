// GET /api/tools/chalybcrypto/news?coin=BTC — headlines about a coin.
// Context only. data: null when the engine has no news source configured.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { ToolRequestError } from '@/lib/tools/bff-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { req, session, signal }) => {
    const coin = (new URL(req.url).searchParams.get('coin') ?? '').toUpperCase();
    if (!/^[A-Z0-9]{1,15}$/.test(coin)) throw new ToolRequestError('coin');
    return a.news(session.user.id, coin, signal);
  },
  { idempotent: true },
);

export async function GET(req: Request) {
  return handler(req);
}
