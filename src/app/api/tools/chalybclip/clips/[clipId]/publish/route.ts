// POST /api/tools/chalybclip/clips/{clipId}/publish {platform} — "Publicar
// en TikTok" (TOOLS-SPEC §4.2). Only for an account the person connected.

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { isJobHidden } from '@/lib/legal/removals';
import { toolRoute } from '@/lib/tools/bff-route';
import { termsAcceptancePending } from '@/lib/legal/reaccept-server';
import {
  NeedsPlanError,
  TermsPendingError,
  NotFoundError,
  parsePlatform,
  socialsAllowed,
} from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, entitlements, params, body, signal }) => {
    if (!socialsAllowed(entitlements.plan)) throw new NeedsPlanError('clipConnectSocials');
    if (await termsAcceptancePending(session.user.id)) throw new TermsPendingError('terms_pending');
    const platform = parsePlatform(body.platform);
    const accounts = await a.accounts(session.user.id, signal);
    if (!platform || !accounts.some((x) => x.platform === platform && x.connected))
      throw new NotFoundError('account');
    const clip = await a.getClip(session.user.id, params.clipId ?? '', signal);
    if (!clip || (await isJobHidden(session.user.id, clip.jobId))) throw new NotFoundError('clip');
    return a.publishClip(session.user.id, clip.id, platform, signal);
  },
);
