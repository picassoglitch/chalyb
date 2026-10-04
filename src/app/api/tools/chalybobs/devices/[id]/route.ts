// DELETE /api/tools/chalybobs/devices/{id} — "Desconectar" (§6.3).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const DELETE = toolRoute('chalybobs', getEnVivo, async (a, { session, params }) => {
  await a.disconnectDevice(session.user.id, String(params.id ?? '').slice(0, 64));
  return a.devices(session.user.id);
});
