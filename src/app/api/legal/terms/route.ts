// POST /api/legal/terms — the user's answer to a Terms update
// (aceptacion-ux §8): { action: 'accept' } from the modal's "Aceptar y
// continuar", or { action: 'shown' } when the minor-change banner appeared.
// "No acepto, ver opciones" is a link to /app/terminos, not a call.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { answerTerms } from '@/lib/legal/reaccept-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action !== 'accept' && body.action !== 'shown') {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  const locale = body.locale === 'en' ? 'en' : 'es';
  const result = await answerTerms(session, body.action, locale);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
