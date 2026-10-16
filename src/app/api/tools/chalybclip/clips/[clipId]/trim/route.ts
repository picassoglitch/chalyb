// POST /api/tools/chalybclip/clips/{clipId}/trim {start_s, end_s} — manual
// trim (stream seconds). The engine validates the bounds and length and
// re-cuts the clip; Deshacer (revert-trim) restores the cut.

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseTrimBody } from '@/lib/tools/adapters/clips/editor-types';
import { ToolRequestError } from '@/lib/tools/bff-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = editorRoute(
  async (api, id, { body, signal }) => {
    const trim = parseTrimBody(body);
    if (!trim) throw new ToolRequestError('trim');
    return api.trim(id, trim, signal);
  },
  { timeoutMs: 55_000 },
);
