// POST /api/billing/card — "Cambiar tarjeta" / "Actualizar tarjeta" (Mi
// plan). Swaps the card on the live preapproval; changes no amount or date,
// so it needs no recurring-charge consent. A past-due plan is retried by
// Mercado Pago on the new card.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMercadoPago, getMercadoPagoIsolated } from '@/lib/payments/mercadopago';
import { declineReasonOf, rejectionDetailOf } from '@/lib/payments/card-decline';
import { meliSessionOptions } from '@/lib/payments/device-session';
import { loadBilling } from '@/lib/billing/subscription-store';
import { isStripeSubscriptionId } from '@/lib/payments/stripe-config';
import { updateStripeCard, type CardUpdateResult } from '@/lib/billing/stripe-card';

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
  // The card form follows the subscription's own gateway (tarjeta/page.tsx).
  if (isStripeSubscriptionId(preapprovalId)) {
    const result = await updateStripeCard(session.user.id, preapprovalId, token).catch(
      (err): CardUpdateResult => {
        console.error('[billing/card] stripe update failed', preapprovalId, err);
        return { ok: false, code: 'MP_ERROR' };
      },
    );
    if (result.ok) return NextResponse.json({ ok: true, consentId: '' });
    return NextResponse.json(result, { status: cardStatus(result.code) });
  }
  let card: {
    last_four_digits?: string;
    expiration_month?: number;
    expiration_year?: number;
    payment_method_id?: string;
  } = {};
  try {
    card = await getMercadoPago().cardToken.get({ id: token });
  } catch {
    // details are cosmetic; the update is what matters
  }
  try {
    // Isolated: the SDK keeps a call's requestOptions on its client for good.
    await getMercadoPagoIsolated().preapproval.update({
      id: preapprovalId,
      body: { card_token_id: token },
      requestOptions: meliSessionOptions(body.deviceSessionId),
    });
  } catch (err) {
    const detail = rejectionDetailOf(err);
    console.error('[billing/card] update refused', preapprovalId, { status_detail: detail }, err);
    return NextResponse.json(
      { ok: false, code: 'DECLINED', decline: declineReasonOf(detail) },
      { status: 402 },
    );
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

function cardStatus(code: Exclude<CardUpdateResult, { ok: true }>['code']): number {
  if (code === 'REQUIRES_ACTION') return 202;
  if (code === 'DECLINED') return 402;
  if (code === 'BAD_TOKEN') return 400;
  if (code === 'NOTHING_TO_UPDATE') return 409;
  return 502;
}
