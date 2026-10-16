// GET /api/tools/chalybcrypto/strategies — the engine's strategies.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  (a, { session, signal }) => a.strategies(session.user.id, signal),
  { idempotent: true },
);

export async function GET(req: Request) {
  return handler(req);
}
