// POST /api/tools/chalybclip/uploads/{id}/abort — cancelled: release the
// admission and drop whatever reached the bucket.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { abortUpload } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseTicket } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return abortUpload(e, parseId(params.id), parseTicket(body), signal);
  },
);
