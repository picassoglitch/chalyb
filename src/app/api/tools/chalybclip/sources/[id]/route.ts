// PATCH / DELETE /api/tools/chalybclip/sources/{id} — pause/resume, cadence,
// stop watching.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { deleteSource, patchSource } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseSourcePatch } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PATCH = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return patchSource(e, parseId(params.id), parseSourcePatch(body), signal);
  },
);

export const DELETE = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return deleteSource(e, parseId(params.id), signal);
  },
);
