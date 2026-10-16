// POST /api/tools/chalybclip/brand-kits/{id}/default — make it the default style.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { setDefaultKit } from '@/lib/tools/adapters/clips/engine-api';
import { parseId } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return setDefaultKit(e, parseId(params.id), signal);
  },
);
