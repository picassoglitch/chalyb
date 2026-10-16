// POST /api/tools/chalybclip/clips/{clipId}/hooks {tone, n} — "Generar 5"
// (one AI call; the engine falls back to titles from the transcript).

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseHooksBody } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 90;

export const POST = editorRoute(
  (api, id, { body, signal }) => api.hooks(id, parseHooksBody(body), signal),
  { timeoutMs: 80_000 },
);
