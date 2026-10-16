// POST /api/tools/chalybclip/streams/{id}/approve-all — approve every clip
// still waiting for review (status only: nothing renders or publishes).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { approveAll } from '@/lib/tools/adapters/clips/engine-api';
import { parseId } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return approveAll(e, parseId(params.id), signal);
  },
);
