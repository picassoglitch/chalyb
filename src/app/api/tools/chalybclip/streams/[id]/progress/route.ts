// GET /api/tools/chalybclip/streams/{id}/progress — pipeline steps (polling).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { getProgress } from '@/lib/tools/adapters/clips/engine-api';
import { parseId } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return getProgress(e, parseId(params.id), signal);
  },
  { idempotent: true },
);
