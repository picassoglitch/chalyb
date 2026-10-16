// PATCH / DELETE /api/tools/chalybobs/destinations/{id} — edit or remove one
// destination. The engine scopes every id to the person's own tenant.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { parseDestinationId, parseDestinationPatch } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PATCH = toolRoute(
  'chalybobs',
  getEnVivo,
  async (a, { session, params, body, signal }) => {
    const id = parseDestinationId(params.id);
    await a.updateDestination(session.user.id, id, parseDestinationPatch(body), signal);
    return a.state(session.user.id, signal);
  },
);

export const DELETE = toolRoute('chalybobs', getEnVivo, async (a, { session, params, signal }) => {
  await a.removeDestination(session.user.id, parseDestinationId(params.id), signal);
  return a.state(session.user.id, signal);
});
