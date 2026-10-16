// POST /api/tools/chalybclip/clips/prefs {field, value} — the editor's
// auto-save of the person's setup (URL, banner, caption knobs…) into their
// default brand kit, so the next clip opens with it.

import { editorAccountRoute } from '@/lib/tools/adapters/clips/editor-route';
import { parsePref } from '@/lib/tools/adapters/clips/editor-types';
import { ToolRequestError } from '@/lib/tools/bff-core';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = editorAccountRoute(async (api, { body, signal }) => {
  const pref = parsePref(body);
  if (!pref) throw new ToolRequestError('pref');
  return api.pref(pref, signal);
});
