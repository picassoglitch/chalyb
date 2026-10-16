// POST /api/tools/chalybclip/clips/{clipId}/reject — "Descartar".

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = editorRoute((api, id, { signal }) => api.reject(id, signal));
