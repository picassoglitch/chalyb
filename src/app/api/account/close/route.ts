// POST /api/account/close — "Cerrar mi cuenta" (Términos y Condiciones
// §13.1, Paquetes §5.2). The body carries the credit count the screen showed
// and the ticked box; the server re-reads both before anything happens.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { closeAccount } from '@/lib/legal/account-closure';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS: Record<string, number> = {
  credits_unknown: 503,
  credits_changed: 409,
  not_confirmed: 422,
  already_requested: 409,
  mp_error: 502,
  rateLimited: 429,
  db: 502,
  send: 502,
};

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await closeAccount(session, {
    creditsShown: b.creditsShown,
    confirmed: b.confirmed,
    locale: b.locale === 'en' ? 'en' : 'es',
  });
  return NextResponse.json(result, { status: result.ok ? 200 : (STATUS[result.code] ?? 502) });
}
