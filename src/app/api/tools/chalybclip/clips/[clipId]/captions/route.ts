// GET /api/tools/chalybclip/clips/{clipId}/captions — read-only editor feed.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute((api, id, { signal }) => api.captions(id, signal), {
  idempotent: true,
});
