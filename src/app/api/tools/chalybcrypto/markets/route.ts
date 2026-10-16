// GET /api/tools/chalybcrypto/markets?venue=bitunix|lbank|binance — the
// venues and the tradeable contract list (Señales · Mercado).

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { parseVenue } from '@/lib/tools/senales-market-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  (a, { req, session, signal }) =>
    a.markets(session.user.id, parseVenue(new URL(req.url).searchParams.get('venue')), signal),
  { idempotent: true },
);

export async function GET(req: Request) {
  return handler(req);
}
