// POST /api/engines/{slug}/usage/settle
//   { reservation_id, outcome: succeeded | failed | cancelled | heartbeat }
//
// Closes an admitted job (charging the boost fee if it succeeded on the
// boost lane) or, for heartbeat, keeps a long one from expiring. Idempotent.
//
// Contract: docs/engines/consumption-contract.md

import { NextResponse } from 'next/server';
import { checkEngineBearer } from '@/lib/engines/bearer';
import { settleUsage, type SettleOutcome } from '@/lib/usage/admission';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OUTCOMES: readonly SettleOutcome[] = ['succeeded', 'failed', 'cancelled', 'heartbeat'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const auth = checkEngineBearer(req, slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { reservation_id?: unknown; outcome?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (typeof body.reservation_id !== 'string' || !UUID_RE.test(body.reservation_id)) {
    return NextResponse.json({ error: 'reservation_id required' }, { status: 400 });
  }
  if (!OUTCOMES.includes(body.outcome as SettleOutcome)) {
    return NextResponse.json(
      { error: `outcome must be one of ${OUTCOMES.join(', ')}` },
      { status: 400 },
    );
  }

  const result = await settleUsage(slug, body.reservation_id, body.outcome as SettleOutcome);
  if (!result.ok && result.error === 'not found') {
    return NextResponse.json({ error: 'unknown reservation' }, { status: 404 });
  }
  // A heartbeat on a closed reservation is 409: the engine should stop.
  if (!result.ok && result.already) {
    return NextResponse.json({ ok: false, status: result.status }, { status: 409 });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
