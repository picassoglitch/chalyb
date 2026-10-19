// POST /api/tools/chalito/reset/start — "Empezar de cero": emails the signed-in person a one-time
// code (src/lib/chalito/reset.ts). Three codes an hour at most.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { startReset } from '@/lib/chalito/reset';
import { resetSecret, resetStore, sendResetCode } from '@/lib/chalito/reset-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'cache-control': 'no-store' };

export async function POST() {
  const session = await getSessionUser();
  if (!session)
    return NextResponse.json(
      { ok: false, reason: 'signed_out' },
      { status: 401, headers: noStore },
    );
  const secret = resetSecret();
  if (!secret)
    return NextResponse.json(
      { ok: false, reason: 'send_failed' },
      { status: 503, headers: noStore },
    );
  try {
    const r = await startReset({
      userId: session.user.id,
      email: session.user.email ?? null,
      store: resetStore,
      secret,
      now: Date.now,
      send: sendResetCode,
    });
    const status = r.ok
      ? 200
      : r.reason === 'rate_limited'
        ? 429
        : r.reason === 'no_email'
          ? 409
          : 502;
    return NextResponse.json(r, { status, headers: noStore });
  } catch {
    return NextResponse.json(
      { ok: false, reason: 'send_failed' },
      { status: 503, headers: noStore },
    );
  }
}
