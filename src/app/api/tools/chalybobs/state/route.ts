// GET /api/tools/chalybobs/state — En vivo's whole screen state (title, live,
// destinations, …). Never a stream key: only stream-key returns one.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybobs',
  getEnVivo,
  (a, { session, signal }) => a.state(session.user.id, signal),
  { idempotent: true },
);
