// GET /api/tools/chalybclip/clips/{clipId}/intelligence — read-only editor feed.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute((api, id, { signal }) => api.intelligence(id, signal), {
  idempotent: true,
});
