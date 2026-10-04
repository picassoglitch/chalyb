// POST /api/tools/chalybobs/destinations/{platform} — connect a platform
// after the person read the aceptacion-ux §7 text in ConnectAccountSheet.
// Only when the tool can actually connect (capabilities.supportsConnect).

import { getEnVivo } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { LIVE_PLATFORMS, type LivePlatform } from '@/lib/tools/adapters/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

class Refused extends Error {
  readonly code = 'FORBIDDEN';
}

export const POST = toolRoute('chalybobs', getEnVivo, async (a, { session, params }) => {
  const platform = String(params.platform ?? '') as LivePlatform;
  if (!LIVE_PLATFORMS.includes(platform) || !a.capabilities().supportsConnect)
    throw new Refused('cannot connect');
  return a.connectDestination(session.user.id, platform);
});
