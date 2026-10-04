// POST /api/tools/chalybclip/clips/{clipId}/publish {platform} — "Publicar
// en TikTok" (TOOLS-SPEC §4.2). Only for an account the person connected.

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { NotFoundError, parsePlatform } from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { req, session, params }) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const platform = parsePlatform(body.platform);
    const accounts = await a.accounts(session.user.id);
    if (!platform || !accounts.some((x) => x.platform === platform && x.connected))
      throw new NotFoundError('account');
    const clip = await a.getClip(session.user.id, params.clipId ?? '');
    if (!clip) throw new NotFoundError('clip');
    return a.publishClip(session.user.id, clip.id, platform);
  },
);
