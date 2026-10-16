// GET /api/tools/chalybclip/clips/{clipId}/editor — everything the editor
// renders (verdict, AI scores, controls' starting values, choices).

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = editorRoute((api, id, { signal }) => api.load(id, signal), {
  idempotent: true,
});
