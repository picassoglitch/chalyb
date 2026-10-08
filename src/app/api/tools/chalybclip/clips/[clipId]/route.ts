// GET / PATCH /api/tools/chalybclip/clips/{clipId} — one clip, and the
// detail screen's autosave (title, captions, trim, format). The original
// is never deleted (TOOLS-SPEC §1.3).

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { isJobHidden } from '@/lib/legal/removals';
import { toolRoute } from '@/lib/tools/bff-route';
import { NotFoundError, parseClipPatch } from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, params, signal }) => {
    const clip = await a.getClip(session.user.id, params.clipId ?? '', signal);
    if (!clip || (await isJobHidden(session.user.id, clip.jobId))) throw new NotFoundError('clip');
    return clip;
  },
  { idempotent: true },
);

export const PATCH = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, params, body, signal }) => {
    const id = params.clipId ?? '';
    const clip = await a.getClip(session.user.id, id, signal);
    if (!clip || (await isJobHidden(session.user.id, clip.jobId))) throw new NotFoundError('clip');
    const patch = parseClipPatch(body, clip);
    const next = await a.patchClip(session.user.id, id, patch, signal);
    if (!next) throw new NotFoundError('clip');
    return next;
  },
);
