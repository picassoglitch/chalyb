// GET / PATCH /api/tools/chalybclip/clips/{clipId} — one clip, and the
// detail screen's autosave (title, captions, trim, format). The original
// is never deleted (TOOLS-SPEC §1.3).

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { NotFoundError, parseClipPatch } from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, params }) => {
    const clip = await a.getClip(session.user.id, params.clipId ?? '');
    if (!clip) throw new NotFoundError('clip');
    return clip;
  },
  { idempotent: true },
);

export const PATCH = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, params, body }) => {
    const id = params.clipId ?? '';
    const clip = await a.getClip(session.user.id, id);
    if (!clip) throw new NotFoundError('clip');
    const patch = parseClipPatch(body, clip);
    const next = await a.patchClip(session.user.id, id, patch);
    if (!next) throw new NotFoundError('clip');
    return next;
  },
);
