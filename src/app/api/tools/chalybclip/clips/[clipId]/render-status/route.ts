// GET /api/tools/chalybclip/clips/{clipId}/render-status?quality= — polled
// while the export renders.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseQuality } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute(
  (api, id, { req, signal }) =>
    api.renderStatus(id, parseQuality(new URL(req.url).searchParams.get('quality')), signal),
  { idempotent: true },
);
