// POST /api/tools/chalybclip/uploads/{id}/complete — the PUT finished: the
// engine checks the object, re-admits with the real size and length, starts.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { completeUpload } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseTicket } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The engine probes the uploaded file / waits for the AI: the slow budget.
export const maxDuration = 60;

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return completeUpload(e, parseId(params.id), parseTicket(body), signal);
  },
  { timeoutMs: 55_000 },
);
