// GET / POST /api/tools/chalybclip/settings — Ajustes de Clips autosave
// (TOOLS-SPEC §4.3). Unknown or out-of-range values are dropped.

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { parseSettings } from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute('chalybclip', getClipsAdapter, (a, { session }) => a.getSettings(session.user.id), {
  idempotent: true,
});

export const POST = toolRoute('chalybclip', getClipsAdapter, async (a, { req, session }) => {
  const prev = await a.getSettings(session.user.id);
  const next = parseSettings(await req.json().catch(() => ({})), prev);
  await a.saveSettings(session.user.id, next);
  return next;
});
