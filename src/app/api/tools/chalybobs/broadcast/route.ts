// POST /api/tools/chalybobs/broadcast {meta} — "Actualizar títulos": saves
// the title, description, category… and the engine sends each field to the
// connected platforms that take it.

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { normalizeBroadcastMeta } from '@/lib/tools/envivo-platforms';
import { EnVivoBadRequest } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, body, signal }) => {
  if (!body.meta || typeof body.meta !== 'object') throw new EnVivoBadRequest('meta');
  const meta = normalizeBroadcastMeta(body.meta, '');
  if (!meta.title.trim()) throw new EnVivoBadRequest('title');
  await a.publishBroadcast(session.user.id, meta, signal);
  return a.state(session.user.id, signal);
});
