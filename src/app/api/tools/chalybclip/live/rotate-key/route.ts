// POST /api/tools/chalybclip/live/rotate-key — new stream key, old one revoked.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { rotateLiveKey } from '@/lib/tools/adapters/clips/engine-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybclip', getClipsEngineAdapter, (a, { session, signal }) => {
  const e = a.engine(session.user.id);
  return rotateLiveKey(e, signal);
});
