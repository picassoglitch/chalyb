// POST /api/tools/chalybclip/brand-kits — create a style (brand kit).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { createKit } from '@/lib/tools/adapters/clips/engine-api';
import { parseKit } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, signal }) => {
    const e = a.engine(session.user.id);
    return createKit(e, parseKit(body), signal);
  },
);
