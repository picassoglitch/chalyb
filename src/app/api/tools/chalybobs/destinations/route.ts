// POST /api/tools/chalybobs/destinations {platformId} — add a place to send
// the stream to (filled in by hand). Platforms with sign-in use oauth/*.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { parsePlatformId } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, body, signal }) => {
  await a.addDestination(session.user.id, parsePlatformId(body.platformId), signal);
  return a.state(session.user.id, signal);
});
