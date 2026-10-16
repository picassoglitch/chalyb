// PUT /api/tools/chalybclip/admin/site-settings — landing price strings
// (engine admins only; the engine answers 404 to anyone else).
// Mode "a" only (the engine's hub API); otherwise 503 like every tool route.

import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { saveSiteSettings } from '@/lib/tools/adapters/clips/engine-api';
import { parseSiteSettings } from '@/lib/tools/clips-engine-input';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PUT = toolRoute(
  'chalybclip',
  getClipsEngineAdapter,
  (a, { session, body, signal }) => {
    const e = a.engine(session.user.id);
    return saveSiteSettings(e, parseSiteSettings(body), signal);
  },
);
