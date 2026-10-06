// POST /api/tools/chalybcrypto/prefs — Señales autosave (TOOLS-SPEC §5.3,
// §5.4). Delivery preferences only; the BFF refuses it without a current
// risk notice (403) like every Señales call.

import { getSenales } from '@/lib/tools/registry';
import { toolRoute } from '@/lib/tools/bff-route';
import { mergePrefs } from '@/lib/tools/signals-prefs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute('chalybcrypto', getSenales, async (a, { session, body, signal }) => {
  const [coins, channels, prev] = await Promise.all([
    a.coins(signal),
    a.channels(signal),
    a.getPrefs(session.user.id, signal),
  ]);
  const next = mergePrefs(prev, body, {
    coins: new Set(coins.map((c) => c.symbol)),
    channels: new Set(channels),
  });
  await a.savePrefs(session.user.id, next, signal);
  return next;
});

export async function POST(req: Request) {
  return handler(req);
}
