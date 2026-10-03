// POST /api/billing/card — "Cambiar tarjeta" / "Actualizar tarjeta" (Mi
// plan). Swaps the card on the live preapproval; changes no amount or date,
// so it needs no recurring-charge consent. A past-due plan is retried by
// Mercado Pago on the new card.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago, mpGet } from '@/lib/payments/mercadopago';
import { loadBilling } from '@/lib/billing/subscription-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ ok: false, code: 'SESSION_EXPIRED' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = String(body.cardTokenId ?? '').trim();
  if (!token || token.length > 128)
    return NextResponse.json({ ok: false, code: 'BAD_TOKEN' }, { status: 400 });
  const billing = await loadBilling(session.user.id);
  const row = billing.primaryRow;
  if (!row || !['trialing', 'pro', 'past_due'].includes(billing.primary.state)) {
    return NextResponse.json({ ok: false, code: 'NOTHING_TO_UPDATE' }, { status: 409 });
  }
  const preapprovalId = row.mp_preapproval_id as string;
  let card: {
    last_four_digits?: string;
    expiration_month?: number;
    expiration_year?: number;
    payment_method_id?: string;
  } = {};
  try {
    card = await mpGet(`/v1/card_tokens/${encodeURIComponent(token)}`);
  } catch {
    // details are cosmetic; the update is what matters
  }
  try {
    await getMercadoPago().preapproval.update({
      id: preapprovalId,
      body: { card_token_id: token },
    });
  } catch (err) {
    console.error('[billing/card] update refused', preapprovalId, err);
    return NextResponse.json({ ok: false, code: 'DECLINED' }, { status: 402 });
  }
  await createAdminClient()
    .from('subscriptions')
    .update({
      card_brand: card.payment_method_id ?? null,
      card_last4: card.last_four_digits ?? null,
      card_exp:
        card.expiration_month && card.expiration_year
          ? `${String(card.expiration_month).padStart(2, '0')}/${String(card.expiration_year).slice(-2)}`
          : null,
    })
    .eq('mp_preapproval_id', preapprovalId);
  return NextResponse.json({ ok: true, consentId: '' });
}
