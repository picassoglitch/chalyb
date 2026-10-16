// POST /api/tools/chalybclip/live/connection — the En vivo ↔ Clips switch
// (VIP only; the engine enforces it).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { setLiveConnection } from '@/lib/tools/adapters/clips/engine-api';
import { parseLiveConnection } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, signal }) => {
    const e = a.engine(session.user.id);
    return setLiveConnection(e, parseLiveConnection(body).enabled, signal);
  },
);
