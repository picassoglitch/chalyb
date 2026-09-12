// Mercado Pago webhook receiver.
//
// MP posts here after a payment changes state. We:
//   1. Validate the signature. NO SECRET = NO ENTRY (see checkMpSignature).
//   2. Pull the full payment details from MP (the webhook body is just a pointer)
//   3. If approved + external_reference parses as <userId>|<tier>:
//        - upsert the row in `payments` (UNIQUE on mp_payment_id → idempotent on retries)
//        - update profiles.tier for the user
//   3b. Verify the amount + currency MP reports against what that tier or
//       token pack actually costs. A mismatch grants nothing.
//   4. Always respond 200 so MP doesn't keep retrying — except on signature
//      mismatch (401), a missing webhook secret (500) and our own DB errors
//      (500), which we WANT MP to retry once the config is fixed.
//
// MP retries failed webhooks with exponential backoff for ~3 days. Our
// idempotency key (mp_payment_id UNIQUE) makes duplicate deliveries safe.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import {
  getMercadoPago,
  getAppUrl,
  getWebhookSecret,
  isMercadoPagoConfigured,
} from '@/lib/payments/mercadopago';
import { sendEmail } from '@/lib/email/resend';
import { notify } from '@/lib/notifications/notify';
import { paymentSuccessTemplate } from '@/lib/email/templates';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { grantTokenPack } from '@/lib/usage/tokens';
import { getTokenPack } from '@/lib/payments/pricing';
import {
  checkMpSignature,
  checkCharge,
  expectedChargeForPack,
  expectedChargeForTier,
  type ExpectedCharge,
} from '@/lib/payments/webhook-verify';
import type { SubscriptionTier } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'VIP'];

/** Thin wrapper: pull the pieces off the Request and hand them to the pure
 *  checker in webhook-verify.ts (which is what the tests exercise). */
function verifySignature(req: Request, paymentId: string) {
  return checkMpSignature({
    secret: getWebhookSecret(),
    paymentId,
    requestId: req.headers.get('x-request-id'),
    signatureHeader: req.headers.get('x-signature'),
  });
}

interface MPWebhookBody {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

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

  // MP sends several event types — we only care about payment events for now.
  // Other types (merchant_order, plan, subscription_preapproval) are ignored
  // with a 200 so MP stops retrying them.
  if (body.type !== 'payment') {
    return NextResponse.json({ ignored: body.type }, { status: 200 });
  }

  const paymentId = body.data?.id;
  if (!paymentId) {
    return NextResponse.json({ error: 'missing data.id' }, { status: 400 });
  }

  const signature = verifySignature(req, String(paymentId));
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

  // Pull the full payment from MP. The webhook body is just a notification
  // pointer; the source of truth is always MP's REST API.
  const { payment } = getMercadoPago();
  let mpPayment;
  try {
    mpPayment = await payment.get({ id: String(paymentId) });
  } catch (err) {
    console.error('[mp/webhook] failed to fetch payment', paymentId, err);
    // 500 → MP will retry. Likely a transient MP API issue.
    return NextResponse.json({ error: 'mp fetch failed' }, { status: 500 });
  }

  const status = String(mpPayment.status ?? 'unknown');
  const externalRef = mpPayment.external_reference ?? '';
  // external_reference is one of two shapes:
  //   1. Tier upgrade:   "<userId>|<TIER>"            (e.g. "abc|PRO")
  //   2. Token pack:     "pack|<userId>|<packId>"     (e.g. "pack|abc|tokens_500k")
  const refParts = externalRef.split('|');
  const isPackPurchase = refParts[0] === 'pack';
  const userId = isPackPurchase ? refParts[1] : refParts[0];
  const tierRaw = isPackPurchase ? null : refParts[1];
  const packIdRaw = isPackPurchase ? refParts[2] : null;
  const tier = tierRaw as SubscriptionTier | null;

  if (!userId) {
    return NextResponse.json({ error: 'bad external_reference', externalRef }, { status: 200 });
  }
  if (isPackPurchase) {
    if (!packIdRaw || !getTokenPack(packIdRaw)) {
      return NextResponse.json(
        { error: 'unknown token pack', externalRef },
        { status: 200 },
      );
    }
  } else if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: 'bad external_reference', externalRef }, { status: 200 });
  }

  const admin = createAdminClient();

  // For pack purchases the payments.tier column gets the user's CURRENT tier
  // (we're not changing it — the pack just adds bonus tokens). For tier
  // upgrades it's the target tier.
  let paymentRowTier: SubscriptionTier;
  if (isPackPurchase) {
    const { data: currentProfile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();
    paymentRowTier =
      (currentProfile?.tier as SubscriptionTier | undefined) ?? 'FREE';
  } else {
    paymentRowTier = tier!; // validated above
  }

  // Always record the payment regardless of status — pending/rejected payments
  // are useful audit data. UNIQUE on mp_payment_id makes this idempotent.
  const { error: paymentErr } = await admin
    .from('payments')
    .upsert(
      {
        user_id: userId,
        tier: paymentRowTier,
        mp_payment_id: String(mpPayment.id ?? paymentId),
        amount_cents: Math.round((mpPayment.transaction_amount ?? 0) * 100),
        currency: mpPayment.currency_id ?? 'USD',
        status,
        raw: mpPayment as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_payment_id' },
    );

  if (paymentErr) {
    console.error('[mp/webhook] payments upsert failed', paymentErr);
    return NextResponse.json({ error: 'db payments insert failed' }, { status: 500 });
  }

  // Feed the command-center notifications. Best-effort (notify never throws);
  // a rejected/cancelled payment is worth an admin's attention, an approved
  // one is informational.
  const amountMajor = (mpPayment.transaction_amount ?? 0).toFixed(2);
  const currency = mpPayment.currency_id ?? 'USD';
  if (status === 'rejected' || status === 'cancelled') {
    await notify({
      severity: 'warning',
      title: `Pago ${status === 'rejected' ? 'rechazado' : 'cancelado'} — $${amountMajor} ${currency}`,
      body: `MP #${String(mpPayment.id ?? paymentId)} · ${isPackPurchase ? `pack ${packIdRaw}` : `tier ${tier}`}`,
      href: '/dashboard/billing',
      source: 'mp.webhook',
    });
  }

  // ── Amount + currency gate ───────────────────────────────────────────
  // Everything past this point GRANTS something. external_reference says what
  // was bought; this checks that what was actually paid is that thing's price.
  //
  // Without it, external_reference is the only input deciding entitlements and
  // it is attacker-chosen: pay for the $149 token pack, then have the webhook
  // processed against "<myUserId>|VIP" and walk away with a $2,499 plan. The
  // payment row above is already written either way, so a mismatch is visible
  // in /dashboard/billing and the audit log.
  //
  // A mismatch returns 200: MP retrying the same payment can never make the
  // amount right, and we do not want a retry storm on a payment we refuse.
  if (status === 'approved') {
    const expected: ExpectedCharge | null = isPackPurchase
      ? expectedChargeForPack(packIdRaw!)
      : expectedChargeForTier(tier!);

    if (!expected) {
      // FREE and PARTNER have no price (TIER_PRICING null): no payment can
      // ever grant them, so an approved payment claiming one is bogus.
      console.error(
        '[mp/webhook] REFUSING grant — nothing is for sale at this reference:',
        { externalRef, mpPaymentId: String(mpPayment.id ?? paymentId) },
      );
      await notify({
        severity: 'warning',
        title: 'Pago aprobado sin producto — no se otorgó nada',
        body: `MP #${String(mpPayment.id ?? paymentId)} · ref ${externalRef}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      return NextResponse.json({ error: 'reference is not purchasable' }, { status: 200 });
    }

    const charge = checkCharge(expected, {
      amountMajor: mpPayment.transaction_amount,
      currency: mpPayment.currency_id,
    });

    if (!charge.ok) {
      console.error('[mp/webhook] REFUSING grant — payment does not match the price', {
        reason: charge.reason,
        expected: `${expected.amountCents} ${expected.currency} (${expected.label})`,
        paid: `${charge.paidCents} ${charge.paidCurrency}`,
        externalRef,
        mpPaymentId: String(mpPayment.id ?? paymentId),
        userId,
      });
      await logAudit({
        action: 'tier.payment',
        actorId: null,
        actorEmail: null,
        targetUserId: userId,
        targetEmail: null,
        before: null,
        after: null,
        metadata: {
          mp_payment_id: String(mpPayment.id ?? paymentId),
          kind: 'payment.amount_mismatch',
          rejected: true,
          mismatch: charge.reason,
          expected_amount_cents: expected.amountCents,
          expected_currency: expected.currency,
          paid_amount_cents: charge.paidCents,
          paid_currency: charge.paidCurrency,
          external_reference: externalRef,
        },
      });
      await notify({
        severity: 'critical',
        title: 'Pago con monto que no corresponde — no se otorgó nada',
        body:
          `MP #${String(mpPayment.id ?? paymentId)} · pagó $${(charge.paidCents / 100).toFixed(2)} ` +
          `${charge.paidCurrency}, ${expected.label} cuesta $${(expected.amountCents / 100).toFixed(2)} ` +
          `${expected.currency}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      return NextResponse.json(
        { error: 'amount mismatch', expected: expected.amountCents, paid: charge.paidCents },
        { status: 200 },
      );
    }
  }

  // ── PACK PURCHASE branch: grant tokens + audit, then exit. ────────────
  if (isPackPurchase && status === 'approved') {
    const pack = getTokenPack(packIdRaw!);
    if (!pack) {
      // Already validated above; defensive.
      return NextResponse.json({ error: 'pack vanished' }, { status: 200 });
    }
    const grantRes = await grantTokenPack({
      userId,
      tokens: pack.tokens,
      source: 'mp_payment',
      mpPaymentId: String(mpPayment.id ?? paymentId),
    });
    if (!grantRes.ok) {
      return NextResponse.json({ error: 'pack grant failed' }, { status: 500 });
    }
    await logAudit({
      action: 'tier.payment', // closest existing action; metadata distinguishes
      actorId: null,
      actorEmail: null,
      targetUserId: userId,
      targetEmail: null,
      before: null,
      after: { tokens_granted: pack.tokens },
      metadata: {
        mp_payment_id: String(mpPayment.id ?? paymentId),
        amount_cents: Math.round((mpPayment.transaction_amount ?? 0) * 100),
        currency: mpPayment.currency_id ?? 'MXN',
        pack_id: pack.id,
        kind: 'tokens.pack_purchase',
        already_granted: grantRes.alreadyGranted ?? false,
      },
    });
    if (!grantRes.alreadyGranted) {
      await notify({
        severity: 'info',
        title: `Pack de tokens acreditado — ${pack.tokens.toLocaleString('es-MX')} tokens`,
        body: `MP #${String(mpPayment.id ?? paymentId)} · $${amountMajor} ${currency}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
    }
    return NextResponse.json({ ok: true, kind: 'pack', tokens: pack.tokens }, { status: 200 });
  }
  if (isPackPurchase) {
    // Pack purchase but not approved (pending/rejected). Payment row already
    // recorded above; nothing else to do.
    return NextResponse.json({ ok: true, kind: 'pack', status }, { status: 200 });
  }

  // ── TIER UPGRADE branch (original logic, now explicit). ──────────────
  // Only flip the user's tier if the payment is actually approved.
  // pending/rejected/cancelled = no tier change.
  if (status === 'approved') {
    // Read prev tier + email for audit before mutating.
    const { data: targetBefore } = await admin
      .from('profiles')
      .select('email, tier')
      .eq('id', userId)
      .maybeSingle();

    const { error: tierErr } = await admin
      .from('profiles')
      .update({ tier })
      .eq('id', userId);
    // Auto-provision engine access on VIP upgrades. PRO upgrades wait
    // until the user picks their live engine (setSelectedLiveEngine handles
    // provisioning there).
    if (!tierErr && tier === 'VIP') {
      await provisionAllAccessEngines(userId, 'mp_payment');
    }
    if (tierErr) {
      console.error('[mp/webhook] tier update failed', tierErr);
      return NextResponse.json({ error: 'db tier update failed' }, { status: 500 });
    }

    // Audit log — actor is NULL because the system (MP webhook) made the change,
    // not a human. Include the MP payment id for disputes.
    await logAudit({
      action: 'tier.payment',
      actorId: null,
      actorEmail: null,
      targetUserId: userId,
      targetEmail: (targetBefore?.email as string | null) ?? null,
      before: { tier: (targetBefore?.tier as string | null) ?? null },
      after: { tier },
      metadata: {
        mp_payment_id: String(mpPayment.id ?? paymentId),
        amount_cents: Math.round((mpPayment.transaction_amount ?? 0) * 100),
        currency: mpPayment.currency_id ?? 'USD',
      },
    });

    await notify({
      severity: 'info',
      title: `Pago aprobado — tier ${tier} activado`,
      body: `${(targetBefore?.email as string | null) ?? userId} · MP #${String(mpPayment.id ?? paymentId)} · $${amountMajor} ${currency}`,
      href: '/dashboard/billing',
      source: 'mp.webhook',
    });

    // Confirmation email — best-effort. If the user's email is missing or
    // Resend isn't configured, we log and move on. Webhook still returns 200
    // so MP doesn't retry (the tier write already succeeded, retrying would
    // double-send the email).
    const userEmail = targetBefore?.email as string | null | undefined;
    // tier is non-null here — we returned early above for pack purchases.
    const confirmedTier = tier!;
    if (userEmail) {
      const tmpl = paymentSuccessTemplate({
        tier: TIER_CAPS[confirmedTier].label,
        amountMajor: (mpPayment.transaction_amount ?? 0).toFixed(2),
        currency: mpPayment.currency_id ?? 'USD',
        paymentId: String(mpPayment.id ?? paymentId),
        appUrl: getAppUrl(),
      });
      void sendEmail({
        to: userEmail,
        subject: `Tu plan ${TIER_CAPS[confirmedTier].label} está activo · Chalyb`,
        html: tmpl.html,
        text: tmpl.text,
      }).catch((err) => {
        console.error('[mp/webhook] payment email failed', err);
      });
    }
  }

  return NextResponse.json({ ok: true, status, tier }, { status: 200 });
}
