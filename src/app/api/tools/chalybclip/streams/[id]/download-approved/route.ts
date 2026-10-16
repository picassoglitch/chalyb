// POST /api/tools/chalybclip/streams/{id}/download-approved — a signed
// engine link to the zip of approved clips; the browser downloads it directly.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { downloadApproved } from '@/lib/tools/adapters/clips/engine-api';
import { parseId } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, params, signal }) => {
    const e = a.engine(session.user.id);
    return downloadApproved(e, parseId(params.id), signal);
  },
);
