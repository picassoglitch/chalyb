// Mercado Pago webhook receiver.
//
// MP posts here when something changes, in two shapes: Webhooks (JSON,
// signed) and the legacy IPN (`?id=&topic=`, empty or form body, usually
// unsigned) — webhook-notification.ts reads both. Six topics matter:
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
//   merchant_order                    IPN only: a legacy Checkout order; each
//                                     of its payments goes through `payment`
//   chargebacks                       a dispute (WS-8): recorded and triaged,
//                                     the account never changes
//
// For every one of them:
//   1. Validate the signature when there is one. NO SECRET = NO ENTRY (see
//      checkMpSignature). An unsigned call is only accepted in IPN form, and
//      then only acts on what step 2 fetches with our token.
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
//
// Mercado Pago wants an answer fast. Processing gets ACK_BUDGET_MS; if it is
// still running then, the route answers 200 and finishes in after(). Only a
// failure inside that budget can still ask MP to retry; one after it is
// logged and the daily billing cron's re-sync catches the subscription.

import { NextResponse, after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getMercadoPago,
  getMpEnv,
  getWebhookSecret,
  isMercadoPagoConfigured,
  mpGet,
} from '@/lib/payments/mercadopago';
import {
  chargebackPaymentIds,
  merchantOrderPaymentIds,
  parseMpNotification,
  unsignedAllowed,
  type MpNotification,
} from '@/lib/payments/webhook-notification';
import { checkMpSignature } from '@/lib/payments/webhook-verify';
import { manifestId, parseSubscriptionReference } from '@/lib/payments/subscription-reference';
import { recordAuthorizedPayment, syncSubscription } from '@/lib/payments/subscription-sync';
import { onChargebackOpened, onRefundReported } from '@/lib/billing/disputes-server';
import {
  chargeFromOrder,
  chargeFromPayment,
  isDispute,
  type NormalizedCharge,
} from '@/lib/payments/order-charge';
import { settleOneOffCharge } from '@/lib/payments/one-off-settlement';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Answer within this, then keep processing in after(). */
const ACK_BUDGET_MS = 1500;

export async function POST(req: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ error: 'mp not configured' }, { status: 200 });
  }

  // Query string first; an empty body (IPN) is not an error.
  const bodyText = await req.text().catch(() => '');
  const n = parseMpNotification(req.url, bodyText, req.headers.get('content-type'));
  const log = { mp_env: getMpEnv(), topic: n.topic, format: n.format };

  // Anything we don't handle (subscription_preapproval_plan,
  // point_integration_wh, …) is acknowledged so MP stops retrying.
  if (!n.handled) {
    console.info('[mp/webhook] ignored', log);
    return NextResponse.json({ ignored: n.topic }, { status: 200 });
  }
  if (!n.dataId) {
    console.error('[mp/webhook] notification without an id', log);
    return NextResponse.json({ error: 'missing id' }, { status: 400 });
  }

  const signatureHeader = req.headers.get('x-signature');
  if (signatureHeader || !unsignedAllowed(n)) {
    const signature = checkMpSignature({
      secret: getWebhookSecret(),
      paymentId: manifestId(n.dataId),
      requestId: req.headers.get('x-request-id'),
      signatureHeader,
    });
    if (!signature.ok) {
      if (signature.reason === 'not_configured') {
        // Fail CLOSED. Without the secret we cannot distinguish MP from any
        // other caller, and this endpoint grants paid entitlements. 500 so MP
        // keeps retrying and the payment lands once the secret is set.
        console.error(
          '[mp/webhook] MERCADOPAGO_WEBHOOK_SECRET is not set — rejecting the ' +
            'notification. Set it here and in the MP dashboard; payments will ' +
            'not be credited until then.',
          log,
        );
        return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 });
      }
      // Anything else = the caller is not MP (or the header is junk).
      console.error('[mp/webhook] signature rejected', { ...log, reason: signature.reason });
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
    }
  }

  const work = processNotification(n).catch((err) => {
    console.error('[mp/webhook] processing threw', log, err);
    return NextResponse.json({ error: 'processing failed' }, { status: 500 });
  });
  const timer = new Promise<'late'>((resolve) => setTimeout(() => resolve('late'), ACK_BUDGET_MS));
  const first = await Promise.race([work, timer]);
  if (first !== 'late') return first;

  after(async () => {
    const res = await work;
    if (res.status >= 400)
      console.error('[mp/webhook] late processing failed', { ...log, status: res.status });
  });
  return NextResponse.json({ accepted: true }, { status: 200 });
}

async function processNotification(n: MpNotification): Promise<NextResponse> {
  const dataId = n.dataId as string;
  switch (n.topic) {
    case 'subscription_preapproval':
    case 'subscription_authorized_payment':
      return handleSubscription(n.topic, dataId);
    case 'merchant_order':
      return handleMerchantOrder(dataId);
    case 'payment':
    case 'orders':
      return handleCharge(n.topic, dataId);
    case 'chargebacks':
      return handleChargeback(dataId);
    default:
      return NextResponse.json({ ignored: n.topic }, { status: 200 });
  }
}

// ── Subscriptions ────────────────────────────────────────────────────
// Both topics end in syncSubscription(), which is idempotent and the only
// place a subscription touches profiles.tier. A failure on our side (db,
// MP unreachable) is a 500 so MP retries; a preapproval that is not ours
// is a 200 because no retry can change that.
async function handleSubscription(
  topic: 'subscription_preapproval' | 'subscription_authorized_payment',
  dataId: string,
): Promise<NextResponse> {
  try {
    const outcome =
      topic === 'subscription_preapproval'
        ? await syncSubscription(dataId)
        : await recordAuthorizedPayment(dataId);
    if (!outcome.ok && outcome.retry) {
      return NextResponse.json({ error: 'subscription sync failed' }, { status: 500 });
    }
    return NextResponse.json({ topic, ...outcome }, { status: 200 });
  } catch (err) {
    console.error(`[mp/webhook] ${topic} ${dataId} failed`, err);
    // Likely MP's API not answering. 500 → MP retries.
    return NextResponse.json({ error: 'subscription fetch failed' }, { status: 500 });
  }
}

// ── Chargebacks (WS-8) ───────────────────────────────────────────────
// Recorded and triaged per payment; nothing on the account changes
// (Términos de Suscripción §10.2). Idempotent per payment id.
async function handleChargeback(chargebackId: string): Promise<NextResponse> {
  let ids: string[];
  try {
    ids = chargebackPaymentIds(await mpGet(`/v1/chargebacks/${encodeURIComponent(chargebackId)}`));
  } catch (err) {
    console.error('[mp/webhook] failed to fetch chargeback', chargebackId, err);
    return NextResponse.json({ error: 'mp fetch failed' }, { status: 500 });
  }
  let failed = false;
  for (const id of ids) {
    const r = await onChargebackOpened({
      mpPaymentId: id,
      mpStatus: 'chargeback',
      mpChargebackId: chargebackId,
    });
    if (!r.ok) failed = true;
  }
  return NextResponse.json(
    { topic: 'chargebacks', payments: ids.length },
    { status: failed ? 500 : 200 },
  );
}

// ── Legacy merchant orders (IPN) ─────────────────────────────────────
// The order itself grants nothing; each payment in it is settled exactly as
// a `payment` notification would be, idempotent on mp_payment_id.
async function handleMerchantOrder(orderId: string): Promise<NextResponse> {
  let ids: string[];
  try {
    ids = merchantOrderPaymentIds(await mpGet(`/merchant_orders/${encodeURIComponent(orderId)}`));
  } catch (err) {
    console.error('[mp/webhook] failed to fetch merchant_order', orderId, err);
    return NextResponse.json({ error: 'mp fetch failed' }, { status: 500 });
  }
  let worst = 200;
  for (const id of ids) {
    const res = await handleCharge('payment', id);
    worst = Math.max(worst, res.status);
  }
  return NextResponse.json(
    { topic: 'merchant_order', payments: ids.length },
    { status: worst >= 500 ? 500 : 200 },
  );
}

// ── One-off charges ──────────────────────────────────────────────────
// Pull the full resource from MP. The webhook body is just a notification
// pointer; the source of truth is always MP's REST API.
async function handleCharge(topic: 'payment' | 'orders', dataId: string): Promise<NextResponse> {
  // Pull the full resource from MP. The webhook body is just a notification
  // pointer; the source of truth is always MP's REST API.
  const { payment, order } = getMercadoPago();
  let charge: NormalizedCharge;
  let raw: Record<string, unknown>;
  try {
    if (topic === 'payment') {
      const mpPayment = await payment.get({ id: dataId });
      charge = chargeFromPayment(mpPayment, dataId);
      raw = mpPayment as unknown as Record<string, unknown>;
    } else {
      const mpOrder = await order.get({ id: dataId });
      charge = chargeFromOrder(mpOrder);
      raw = mpOrder as unknown as Record<string, unknown>;
    }
  } catch (err) {
    console.error(`[mp/webhook] failed to fetch ${topic}`, dataId, err);
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
    if (isDispute(charge.status)) {
      // A dispute changes nothing on the account (Términos §10.2, WS-8).
      const opened = await onChargebackOpened({
        mpPaymentId: charge.mpPaymentId,
        mpStatus: charge.status,
      });
      if (!opened.ok) {
        return NextResponse.json({ error: 'chargeback record failed' }, { status: 500 });
      }
      return NextResponse.json(
        { ok: true, kind: 'subscription_payment', status: charge.status, dispute: true },
        { status: 200 },
      );
    }
    if (charge.status === 'refunded') {
      // A refund never changes the plan, price, step or account (§7.3).
      await onRefundReported({
        userId: subRef.userId,
        mpPaymentId: charge.mpPaymentId,
        amountMajor: charge.amountMajor,
      });
      return NextResponse.json(
        { ok: true, kind: 'subscription_payment', status: charge.status },
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
