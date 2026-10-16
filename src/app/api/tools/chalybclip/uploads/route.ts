// POST /api/tools/chalybclip/uploads — start a direct upload: the engine admits
// the declared size and answers a short-lived presigned PUT to the bucket. The
// browser sends the file there itself (Vercel never carries the bytes).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { startUpload } from '@/lib/tools/adapters/clips/engine-api';
import { parseUploadStart } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, signal }) => {
    const e = a.engine(session.user.id);
    return startUpload(e, parseUploadStart(body), signal);
  },
);
