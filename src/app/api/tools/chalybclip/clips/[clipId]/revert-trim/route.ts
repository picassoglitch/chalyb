// POST /api/tools/chalybclip/clips/{clipId}/revert-trim — undo the automatic
// trim (may re-cut from the stream when the pristine copy is gone).

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = editorRoute((api, id, { signal }) => api.revertTrim(id, signal), {
  timeoutMs: 55_000,
});
