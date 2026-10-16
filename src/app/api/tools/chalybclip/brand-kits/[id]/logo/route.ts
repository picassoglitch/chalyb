// POST /api/tools/chalybclip/brand-kits/{id}/logo — generate a logo with AI.
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { generateKitLogo } from '@/lib/tools/adapters/clips/engine-api';
import { parseId, parseLogo } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// The engine probes the uploaded file / waits for the AI: the slow budget.
export const maxDuration = 60;

export const POST = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, params, signal }) => {
    const e = a.engine(session.user.id);
    return generateKitLogo(e, parseId(params.id), parseLogo(body).style_hint, signal);
  },
  { timeoutMs: 55_000 },
);
