// Mercado Pago webhook receiver.
//
// MP posts here when something changes. Four topics matter:
//
//   subscription_preapproval          a Pro/VIP subscription changed state
//                                     (authorised, paused, cancelled) →
//                                     subscription-sync.ts applies it to the tier
//   subscription_authorized_payment   a monthly charge of a subscription was
//                                     attempted → lands in `payments`, then the
//                                     subscription is re-synced
//   orders                            a Checkout Pro order (Orders API): the
//                                     token packs → one-off-settlement.ts
//   payment                           a Payments API payment: a legacy
//                                     one-off purchase made through the old
//                                     preferences checkout, or a subscription
//                                     charge reported on this topic too
//
// For every one of them:
//   1. Validate the signature. NO SECRET = NO ENTRY (see checkMpSignature).
//   2. Pull the full resource from MP (the webhook body is just a pointer)
//   3. Verify what was paid against what the thing costs. A mismatch grants
//      nothing.
//   4. Always respond 200 so MP doesn't keep retrying — except on signature
//      mismatch (401), a missing webhook secret (500) and our own DB errors
//      (500), which we WANT MP to retry once the config is fixed.
//
// MP retries failed webhooks with exponential backoff for ~3 days. Our
// idempotency keys (mp_payment_id and mp_preapproval_id UNIQUE) make
// duplicate deliveries safe.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getMercadoPago,
  getWebhookSecret,
  isMercadoPagoConfigured,
} from '@/lib/payments/mercadopago';
import { checkMpSignature } from '@/lib/payments/webhook-verify';
import { manifestId, parseSubscriptionReference } from '@/lib/payments/subscription-reference';
import {
  recordAuthorizedPayment,
  revokeSubscriptionForReversal,
  syncSubscription,
} from '@/lib/payments/subscription-sync';
import {
  chargeFromOrder,
  chargeFromPayment,
  isReversal,
  type NormalizedCharge,
} from '@/lib/payments/order-charge';
import { settleOneOffCharge } from '@/lib/payments/one-off-settlement';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Thin wrapper: pull the pieces off the Request and hand them to the pure
 *  checker in webhook-verify.ts (which is what the tests exercise). */
function verifySignature(req: Request, dataId: string) {
  return checkMpSignature({
    secret: getWebhookSecret(),
    paymentId: manifestId(dataId),
    requestId: req.headers.get('x-request-id'),
    signatureHeader: req.headers.get('x-signature'),
  });
}

interface MPWebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

const HANDLED_TOPICS = new Set([
  'payment',
  'orders',
  'order',
  'subscription_preapproval',
  'subscription_authorized_payment',
]);

export async function POST(req: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: 'mp not configured' }, { status: 200 });
  }

  let body: MPWebhookBody;
  try {
    body = (await req.json()) as MPWebhookBody;
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  // Anything else MP sends (merchant_order, subscription_preapproval_plan,
  // chargebacks) is acknowledged with a 200 so it stops retrying.
  const type = body.type ?? '';
  if (!HANDLED_TOPICS.has(type)) {
    return NextResponse.json({ ignored: type }, { status: 200 });
  }

  const dataId = body.data?.id;
  if (!dataId) {
    return NextResponse.json({ error: 'missing data.id' }, { status: 400 });
  }

  const signature = verifySignature(req, String(dataId));
  if (!signature.ok) {
    if (signature.reason === 'not_configured') {
      // Fail CLOSED. Without the secret we cannot distinguish MP from any
      // other caller, and this endpoint grants paid entitlements. 500 so MP
      // keeps retrying and the payment lands once the secret is set.
      console.error(
        '[mp/webhook] MERCADOPAGO_WEBHOOK_SECRET is not set — rejecting the ' +
          'notification. Set it here and in the MP dashboard; payments will ' +
          'not be credited until then.',
      );
      return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 });
    }
    // Anything else = the caller is not MP (or the header is junk).
    console.error('[mp/webhook] signature rejected:', signature.reason);
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // ── Subscriptions ────────────────────────────────────────────────────
  // Both topics end in syncSubscription(), which is idempotent and the only
  // place a subscription touches profiles.tier. A failure on our side (db,
  // MP unreachable) is a 500 so MP retries; a preapproval that is not ours
  // is a 200 because no retry can change that.
  if (type === 'subscription_preapproval' || type === 'subscription_authorized_payment') {
    try {
      const outcome =
        type === 'subscription_preapproval'
          ? await syncSubscription(String(dataId))
          : await recordAuthorizedPayment(String(dataId));
      if (!outcome.ok && outcome.retry) {
        return NextResponse.json({ error: 'subscription sync failed' }, { status: 500 });
      }
      return NextResponse.json({ topic: type, ...outcome }, { status: 200 });
    } catch (err) {
      console.error(`[mp/webhook] ${type} ${String(dataId)} failed`, err);
      // Likely MP's API not answering. 500 → MP retries.
      return NextResponse.json({ error: 'subscription fetch failed' }, { status: 500 });
    }
  }

  // ── One-off charges ──────────────────────────────────────────────────
  // Pull the full resource from MP. The webhook body is just a notification
  // pointer; the source of truth is always MP's REST API.
  const { payment, order } = getMercadoPago();
  let charge: NormalizedCharge;
  let raw: Record<string, unknown>;
  try {
    if (type === 'payment') {
      const mpPayment = await payment.get({ id: String(dataId) });
      charge = chargeFromPayment(mpPayment, String(dataId));
      raw = mpPayment as unknown as Record<string, unknown>;
    } else {
      const mpOrder = await order.get({ id: String(dataId) });
      charge = chargeFromOrder(mpOrder);
      raw = mpOrder as unknown as Record<string, unknown>;
    }
  } catch (err) {
    console.error(`[mp/webhook] failed to fetch ${type}`, dataId, err);
    // 500 → MP will retry. Likely a transient MP API issue.
    return NextResponse.json({ error: 'mp fetch failed' }, { status: 500 });
  }

  // A subscription's monthly charge can also arrive on the `payment` topic
  // with the preapproval's reference on it. The ledger row is the same one
  // recordAuthorizedPayment writes (UNIQUE mp_payment_id), and the tier is
  // decided by the preapproval's state, never by this payment alone.
  const subRef = parseSubscriptionReference(charge.externalReference);
  if (subRef) {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from('subscriptions')
      .select('mp_preapproval_id')
      .eq('external_reference', charge.externalReference)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error: ledgerErr } = await admin.from('payments').upsert(
      {
        user_id: subRef.userId,
        tier: subRef.tier,
        // Same ledger row recordAuthorizedPayment writes; keep the product
        // label identical so /app/billing does not describe the same charge
        // two different ways depending on which topic reported it first.
        kind: 'subscription',
        mp_payment_id: charge.mpPaymentId,
        mp_preapproval_id: (sub?.mp_preapproval_id as string | undefined) ?? null,
        amount_cents: Math.round((charge.amountMajor ?? 0) * 100),
        currency: charge.currency ?? 'MXN',
        status: charge.status,
        raw,
      },
      { onConflict: 'mp_payment_id' },
    );
    if (ledgerErr) {
      console.error('[mp/webhook] payments upsert failed', ledgerErr);
      return NextResponse.json({ error: 'db payments insert failed' }, { status: 500 });
    }
    if (sub?.mp_preapproval_id && isReversal(charge.status)) {
      // Refund / chargeback of a monthly charge: the plan is revoked now
      // (policy in revokeSubscriptionForReversal).
      const revoked = await revokeSubscriptionForReversal({
        preapprovalId: sub.mp_preapproval_id as string,
        mpPaymentId: charge.mpPaymentId,
        reason: charge.status as 'refunded' | 'charged_back',
        amountMajor: charge.amountMajor,
        currency: charge.currency,
      });
      if (!revoked.ok) {
        return NextResponse.json({ error: 'subscription revoke failed' }, { status: 500 });
      }
      return NextResponse.json(
        { ok: true, kind: 'subscription_payment', status: charge.status, revoked: true },
        { status: 200 },
      );
    }
    if (sub?.mp_preapproval_id) {
      try {
        const outcome = await syncSubscription(sub.mp_preapproval_id as string);
        if (!outcome.ok && outcome.retry) {
          return NextResponse.json({ error: 'subscription sync failed' }, { status: 500 });
        }
      } catch (err) {
        console.error('[mp/webhook] subscription sync after payment failed', err);
        return NextResponse.json({ error: 'subscription fetch failed' }, { status: 500 });
      }
    }
    return NextResponse.json(
      { ok: true, kind: 'subscription_payment', status: charge.status },
      { status: 200 },
    );
  }

  const result = await settleOneOffCharge(charge, raw);
  return NextResponse.json(result.body, { status: result.httpStatus });
}
