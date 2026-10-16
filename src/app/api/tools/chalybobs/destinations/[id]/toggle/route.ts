// POST /api/tools/chalybobs/destinations/{id}/toggle — send the stream there
// or stop. Only a destination with an ingest URL and a key can go on.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { parseDestinationId } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, params, signal }) => {
  await a.toggleDestination(session.user.id, parseDestinationId(params.id), signal);
  return a.state(session.user.id, signal);
});
