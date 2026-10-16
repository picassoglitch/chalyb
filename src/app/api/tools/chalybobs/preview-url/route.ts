// GET /api/tools/chalybobs/preview-url — a fresh preview address for the
// player (the previous one lasts 30 minutes). Null when there is no video.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { previewUrlFor } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute('chalybobs', getEnVivo, async (a, { session, signal }) =>
  previewUrlFor(await a.previewToken(session.user.id, signal)),
);
