// POST /api/tools/chalybclip/clips/{clipId}/finalize — "Aprobar y seguir":
// saves the controls, approves the clip and names the next one to review.
// Auto-publish on approve now runs on the engine as a background job, so
// this answers quickly; the longer budget only covers a slow save.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseOverlayBody } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = editorRoute(
  (api, id, { body, signal }) => api.finalize(id, parseOverlayBody(body), signal),
  { timeoutMs: 55_000 },
);
