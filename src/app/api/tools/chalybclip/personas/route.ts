// POST /api/tools/chalybclip/personas — create a persona.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { createPersona } from '@/lib/tools/adapters/clips/engine-api';
import { parsePersona } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, signal }) => {
    const e = a.engine(session.user.id);
    return createPersona(
      e,
      parsePersona(body, true) as Parameters<typeof createPersona>[1],
      signal,
    );
  },
);
