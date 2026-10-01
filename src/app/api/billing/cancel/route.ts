// POST /api/billing/cancel — "Sí, cancelar" (SCR-18). Cancels at Mercado
// Pago now; access runs to the end of what was granted. Never blocked by a
// debt.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { cancelSubscription } from '@/lib/billing/billing-actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await cancelSubscription(session, {
    offerShown: body.offerShown === true,
    locale: body.locale === 'en' ? 'en' : 'es',
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : result.code === 'NOTHING_TO_CANCEL' ? 409 : 502,
  });
}
