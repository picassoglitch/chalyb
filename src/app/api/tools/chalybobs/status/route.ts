// GET /api/tools/chalybobs/status — the live room's state (polled every 5 s
// as the SSE fallback, TOOLS-SPEC §1.2).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybobs',
  getEnVivo,
  (a, { session, signal }) => a.status(session.user.id, signal),
  {
    idempotent: true,
  },
);
