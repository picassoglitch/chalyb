// GET / POST /api/tools/chalybclip/settings — Ajustes de Clips autosave
// (TOOLS-SPEC §4.3). Unknown or out-of-range values are dropped.

import { getClipsAdapter } from '@/lib/tools/adapters/clips';
import { toolRoute } from '@/lib/tools/bff-route';
import { parseSettings } from '@/lib/tools/clips-bff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybclip',
  getClipsAdapter,
  (a, { session, signal }) => a.getSettings(session.user.id, signal),
  {
    idempotent: true,
  },
);

export const POST = toolRoute(
  'chalybclip',
  getClipsAdapter,
  async (a, { session, body, signal }) => {
    const prev = await a.getSettings(session.user.id, signal);
    const next = parseSettings(body, prev);
    await a.saveSettings(session.user.id, next, signal);
    return next;
  },
);
