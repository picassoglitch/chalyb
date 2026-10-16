// POST /api/tools/chalybobs/stream-key/regenerate — a new ingest key. The
// old one stops working at once; the new one is NOT returned (it shows only
// through "Mostrar", like any key).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { logAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, signal }) => {
  await a.regenerateKey(session.user.id, signal);
  await logAudit({
    action: 'tool.key_regenerate',
    actorId: session.user.id,
    targetUserId: session.user.id,
    metadata: { tool: 'chalybobs' },
  });
  return { ok: true };
});
