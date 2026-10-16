// PUT / DELETE /api/tools/chalybclip/brand-kits/{id} — save or delete a style.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { deleteKit, updateKit } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseKit } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PUT = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return updateKit(e, parseId(params.id), parseKit(body), signal);
  },
);

export const DELETE = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return deleteKit(e, parseId(params.id), signal);
  },
);
