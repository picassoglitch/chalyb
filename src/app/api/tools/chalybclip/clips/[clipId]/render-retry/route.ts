// POST /api/tools/chalybclip/clips/{clipId}/render-retry?quality= — clear a
// failed render so the next export starts clean.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseQuality } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = editorRoute((api, id, { req, signal }) =>
  api.renderRetry(id, parseQuality(new URL(req.url).searchParams.get('quality')), signal),
);
