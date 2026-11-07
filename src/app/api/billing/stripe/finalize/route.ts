// POST /api/billing/stripe/finalize — the page ran the bank's check (3DS) in-site; finish
// the subscription start, or the card update, it was for. Idempotent.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { finalizeStripeStart } from '@/lib/billing/start-subscription';
import { finishStripeCardUpdate } from '@/lib/billing/stripe-card';
import { loadBilling } from '@/lib/billing/subscription-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATUS: Record<string, number> = {
  REQUIRES_ACTION: 202,
  DECLINED: 402,
  NOT_FOUND: 404,
  NOTHING_TO_UPDATE: 409,
  BAD_TOKEN: 400,
  MP_ERROR: 502,
};

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subscriptionId = typeof body.subscriptionId === 'string' ? body.subscriptionId : '';
  if (!subscriptionId.startsWith('sub_')) {
    return NextResponse.json({ ok: false, code: 'BAD_REQUEST' }, { status: 400 });
  }
  try {
    if (body.kind === 'card') {
      const billing = await loadBilling(session.user.id);
      if (billing.primaryRow?.mp_preapproval_id !== subscriptionId) {
        return NextResponse.json({ ok: false, code: 'NOTHING_TO_UPDATE' }, { status: 409 });
      }
      const setupIntentId = typeof body.intentId === 'string' ? body.intentId : '';
      const r = await finishStripeCardUpdate(session.user.id, subscriptionId, setupIntentId);
      return r.ok
        ? NextResponse.json({ ok: true, consentId: '' })
        : NextResponse.json(r, { status: STATUS[r.code] ?? 502 });
    }
    const r = await finalizeStripeStart(session, subscriptionId);
    return r.ok ? NextResponse.json(r) : NextResponse.json(r, { status: STATUS[r.code] ?? 502 });
  } catch (err) {
    console.error('[billing/stripe/finalize] failed', subscriptionId, err);
    return NextResponse.json({ ok: false, code: 'MP_ERROR' }, { status: 502 });
  }
}
