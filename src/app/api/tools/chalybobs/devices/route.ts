// GET /api/tools/chalybobs/devices — paired computers; the Conectar screen
// polls it every 5 s until one shows up (§6.1).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = toolRoute(
  'chalybobs',
  getEnVivo,
  (a, { session }) => a.devices(session.user.id),
  {
    idempotent: true,
  },
);
