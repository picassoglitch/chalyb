// PUT /api/tools/chalybclip/clips/{clipId}/overlay — "Guardar borrador".

import { editorRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parseOverlayBody } from '@/lib/tools/adapters/clips/editor-types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const PUT = editorRoute((api, id, { body, signal }) =>
  api.saveOverlay(id, parseOverlayBody(body), signal),
);
