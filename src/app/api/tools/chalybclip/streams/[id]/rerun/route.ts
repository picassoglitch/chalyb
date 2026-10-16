// POST /api/tools/chalybclip/streams/{id}/rerun — "Córrelo otra vez" with a
// persona (a new admitted run).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { rerunStream } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseRerun } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return rerunStream(e, parseId(params.id), parseRerun(body), signal);
  },
);
