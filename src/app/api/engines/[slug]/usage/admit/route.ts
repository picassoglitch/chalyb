// POST /api/engines/{slug}/usage/admit
//
// An engine asks before it spends: may this user run this job, on which
// lane, and how big may the upload be? Checks the tier's caps and reserves
// the estimated tokens atomically. Refusals are 200 with allowed=false and
// a reason, so the engine can tell "no" apart from "the hub is down" (5xx),
// which it must also treat as no.
//
// Contract: docs/engines/consumption-contract.md

import { NextResponse } from 'next/server';
import { checkEngineBearer } from '@/lib/engines/bearer';
import { parseAdmitBody } from '@/lib/usage/admission-core';
import { admitUsage } from '@/lib/usage/admission';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const auth = checkEngineBearer(req, slug);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const userId = body?.external_user_id;
  if (!userId || typeof userId !== 'string') {
    return NextResponse.json({ error: 'external_user_id required' }, { status: 400 });
  }
  const parsed = parseAdmitBody(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const result = await admitUsage(slug, userId, parsed);
  if (result.status === 404) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  if (!result.allowed) {
    return NextResponse.json({
      ok: true,
      allowed: false,
      reason: result.reason,
      detail: result.detail ?? {},
      limits: result.limits,
    });
  }
  return NextResponse.json({
    ok: true,
    allowed: true,
    reservation_id: result.reservationId,
    lane: result.lane,
    boost_fee_tokens: result.boostFeeTokens,
    limits: result.limits,
    balance: result.balance,
  });
}
