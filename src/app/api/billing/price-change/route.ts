// POST /api/billing/price-change — the subscriber's express answer to a
// price increase (aceptacion-ux §4.1): { decision: 'accept' | 'decline' }.
// "Cancelar mi plan" is the ordinary cancel (/app/billing?cancelar=1).

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { answerIncrease } from '@/lib/billing/price-change-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.decision !== 'accept' && body.decision !== 'decline') {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  const result = await answerIncrease(session, body.decision);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.code === 'NOTHING_PENDING' ? 409 : 502 });
  }
  return NextResponse.json({ ok: true });
}
