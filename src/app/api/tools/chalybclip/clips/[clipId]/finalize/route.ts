// POST /api/tools/chalybclip/clips/{clipId}/finalize — "Aprobar y seguir":
// saves the controls, approves the clip and names the next one to review.
// Approving can also auto-publish (engine setting), which may wait for the
// render: give it room.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseOverlayBody } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export const POST = editorRoute(
  (api, id, { body, signal }) => api.finalize(id, parseOverlayBody(body), signal),
  { timeoutMs: 280_000 },
);
