// PATCH /api/tools/chalybobs/session {title?, clipsEnabled?} — the stream's
// title and the connection to Clips. Turning Clips on needs a plan the
// engine counts as full access; the engine refuses otherwise (403 needs_plan).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { EnVivoBadRequest, parseTitle } from '@/lib/tools/envivo-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PATCH = toolRoute('chalybobs', getEnVivo, async (a, { session, body, signal }) => {
  const u = session.user.id;
  const hasTitle = body.title !== undefined;
  const hasClips = body.clipsEnabled !== undefined;
  if (!hasTitle && !hasClips) throw new EnVivoBadRequest('empty');
  if (hasClips && typeof body.clipsEnabled !== 'boolean')
    throw new EnVivoBadRequest('clipsEnabled');
  if (hasTitle) await a.setTitle(u, parseTitle(body.title), signal);
  if (hasClips) await a.setClipsEnabled(u, body.clipsEnabled as boolean, signal);
  return a.state(u, signal);
});
