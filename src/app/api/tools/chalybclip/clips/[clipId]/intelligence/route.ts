// GET /api/tools/chalybclip/clips/{clipId}/intelligence — read-only editor feed.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseLang } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute(
  (api, id, { req, signal }) =>
    api.intelligence(id, signal, parseLang(new URL(req.url).searchParams.get('lang'))),
  {
    idempotent: true,
  },
);
