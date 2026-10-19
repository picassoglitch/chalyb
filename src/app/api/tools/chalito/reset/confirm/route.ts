// POST /api/tools/chalito/reset/confirm {code} — "Empezar de cero": with the emailed code, every
// Chalito device of the signed-in person is retired right away, so this browser can activate.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { confirmReset } from '@/lib/chalito/reset';
import { resetChalitoDevices, resetSecret, resetStore } from '@/lib/chalito/reset-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'cache-control': 'no-store' };

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session)
    return NextResponse.json(
      { ok: false, reason: 'signed_out' },
      { status: 401, headers: noStore },
    );
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const secret = resetSecret();
  if (!secret)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 503, headers: noStore });
  try {
    const r = await confirmReset({
      userId: session.user.id,
      raw: typeof body?.code === 'string' ? body.code.slice(0, 32) : '',
      store: resetStore,
      secret,
      now: Date.now,
      resetDevices: resetChalitoDevices,
    });
    const status = r.ok ? 200 : r.reason === 'failed' ? 502 : 400;
    return NextResponse.json(r, { status, headers: noStore });
  } catch {
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 503, headers: noStore });
  }
}
