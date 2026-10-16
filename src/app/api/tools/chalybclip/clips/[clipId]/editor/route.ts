// GET /api/tools/chalybclip/clips/{clipId}/editor — everything the editor
// renders (verdict, AI scores, controls' starting values, choices).

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseLang } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute(
  (api, id, { req, signal }) =>
    api.loadAbsolute(id, signal, parseLang(new URL(req.url).searchParams.get('lang'))),
  {
    idempotent: true,
  },
);
