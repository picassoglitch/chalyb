// POST /api/tools/chalybclip/clips/{clipId}/render?quality=1080|2k|4k —
// start (or report) the export render. The plan decides the real
// resolution (the engine downgrades to 1080 when 2K/4K isn't included).

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseQuality } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = editorRoute(async (api, id, { req, signal }) =>
  api.absolute(
    await api.render(id, parseQuality(new URL(req.url).searchParams.get('quality')), signal),
  ),
);
