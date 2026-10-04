// POST /api/tools/chalybobs/pairing-codes — a fresh 6-digit code (10 min,
// single use; §1.3).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = toolRoute('chalybobs', getEnVivo, (a, { session }) =>
  a.createPairingCode(session.user.id),
);
