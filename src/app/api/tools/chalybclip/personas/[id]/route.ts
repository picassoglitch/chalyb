// PUT /api/tools/chalybclip/personas/{id} — edit a persona.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { updatePersona } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parsePersona } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PUT = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return updatePersona(e, parseId(params.id), parsePersona(body, false), signal);
  },
);
