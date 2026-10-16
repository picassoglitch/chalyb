// DELETE /api/tools/chalybclip/streams/{id} — delete a video and its clips
// (refused while it runs or while scheduled posts still use its clips).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { deleteStream } from '@/lib/tools/adapters/clips/engine-api';
import { parseId } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const DELETE = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return deleteStream(e, parseId(params.id), signal);
  },
);
