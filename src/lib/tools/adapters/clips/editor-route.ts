// BFF handlers for /api/tools/chalybclip/clips/{clipId}/… (the editor).
// toolRoute does the gates (session, plan, hub mode, breaker, timeout,
// normalized errors); this adds the clip id check and hands the handler the
// editor API acting as the signed-in person.

import 'server-only';
import { getClipsEngineAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute, type ToolRouteCtx } from '@/lib/tools/bff-route';
import { NotFoundError } from '@/lib/tools/clips-bff';
import { CLIPS_SLUG } from './client';
import { editorApi, type EditorApi } from './editor-api';
import { CLIP_ID_RE } from './editor-types';

export function editorRoute<T>(
  handler: (api: EditorApi, clipId: string, ctx: ToolRouteCtx) => Promise<T>,
  opts: { idempotent?: boolean; timeoutMs?: number } = {},
) {
  return toolRoute(
    CLIPS_SLUG,
    getClipsEngineAdapter,
    async (a, ctx) => {
      const id = ctx.params.clipId ?? '';
      if (!CLIP_ID_RE.test(id)) throw new NotFoundError('clip');
      return handler(editorApi(a.engine(ctx.session.user.id)), id, ctx);
    },
    opts,
  );
}

/** For the routes that aren't about one clip (brand-kit prefs). */
export function editorAccountRoute<T>(
  handler: (api: EditorApi, ctx: ToolRouteCtx) => Promise<T>,
  opts: { timeoutMs?: number } = {},
) {
  return toolRoute(
    CLIPS_SLUG,
    getClipsEngineAdapter,
    async (a, ctx) => handler(editorApi(a.engine(ctx.session.user.id)), ctx),
    opts,
  );
}
