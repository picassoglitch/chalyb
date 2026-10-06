// GET /api/tools/chalybcrypto/signals/{id}?range=1d|7d|1m — one signal and
// its past price, by PLAN (the engine never gets the user). Engine text that
// carries a banned phrase is dropped before it leaves the server.

import { getSenales } from '@/lib/tools/registry';
import { planKeyFor } from '@/lib/tools/access';
import { toolRoute } from '@/lib/tools/bff-route';
import { screenSignal } from '@/lib/tools/signals-screen';
import type { SignalRange } from '@/lib/tools/adapters/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const handler = toolRoute(
  'chalybcrypto',
  getSenales,
  async (a, { req, entitlements, params, signal }) => {
    const r = new URL(req.url).searchParams.get('range');
    const range: SignalRange = r === '1d' || r === '1m' ? r : '7d';
    const res = await a.getSignal(
      {
        plan: planKeyFor(entitlements.plan),
        id: params.id ?? '',
        range,
      },
      signal,
    );
    if (!res) throw Object.assign(new Error('signal not found'), { code: 'NOT_FOUND' });
    return { signal: screenSignal(res.signal), series: res.series };
  },
  { idempotent: true },
);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(req, ctx);
}
