// GET /api/tools/chalybobs/streams — past streams (newest first).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybobs',
  getEnVivo,
  (a, { session, signal }) => a.streams(session.user.id, signal),
  { idempotent: true },
);
