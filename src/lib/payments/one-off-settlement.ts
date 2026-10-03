// Settling a one-off charge: a token pack, or a plan bought through the old
// one-off checkout before subscriptions existed. Lifted out of the webhook
// route so the Payments API and the Orders API paths share it — they differ
// only in how the charge is fetched and normalised (order-charge.ts).
//
// Idempotent: the `payments` row is keyed by mp_payment_id and the token
// grant RPC refuses to credit the same payment twice.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/resend';
import { paymentReversedTemplate, paymentSuccessTemplate } from '@/lib/email/templates';
import { TIER_CAPS } from '@/lib/billing/tiers';
import { provisionAllAccessEngines } from '@/lib/engines/subscriptions';
import { clawbackTokenPack, grantTokenPack } from '@/lib/usage/tokens';
import { getTokenPack } from './pricing';
import { getAppUrl } from './mercadopago';
import {
  checkCharge,
  expectedChargeForPack,
  expectedChargeForTier,
  type ExpectedCharge,
} from './webhook-verify';
import { isDispute, type NormalizedCharge } from './order-charge';
import { issueRefund, onChargebackOpened, onRefundReported } from '@/lib/billing/disputes-server';
import type { SubscriptionTier } from '@/lib/auth/session';

const VALID_TIERS: SubscriptionTier[] = ['FREE', 'PRO', 'VIP'];

/** What the route answers Mercado Pago with. 500 = please retry. */
export interface SettlementResult {
  httpStatus: 200 | 500;
  body: Record<string, unknown>;
}

function ok(body: Record<string, unknown>): SettlementResult {
  return { httpStatus: 200, body };
}
function retry(body: Record<string, unknown>): SettlementResult {
  return { httpStatus: 500, body };
}

export async function settleOneOffCharge(
  charge: NormalizedCharge,
  raw: Record<string, unknown>,
): Promise<SettlementResult> {
  const { status, externalReference: externalRef } = charge;
  const mpId = charge.mpPaymentId;
  const amountMajor = (charge.amountMajor ?? 0).toFixed(2);
  const currency = charge.currency ?? 'MXN';
  const amountCents = Math.round((charge.amountMajor ?? 0) * 100);

  // external_reference is one of two shapes:
  //   1. Legacy one-off tier purchase: "<userId>|<TIER>"  (e.g. "abc|PRO")
  //   2. Token pack:                   "pack|<userId>|<packId>"
  const refParts = externalRef.split('|');
  const isPackPurchase = refParts[0] === 'pack';
  const userId = isPackPurchase ? refParts[1] : refParts[0];
  const tierRaw = isPackPurchase ? null : refParts[1];
  const packIdRaw = isPackPurchase ? refParts[2] : null;
  const tier = tierRaw as SubscriptionTier | null;

  if (!userId) return ok({ error: 'bad external_reference', externalRef });
  if (isPackPurchase) {
    if (!packIdRaw || !getTokenPack(packIdRaw)) {
      return ok({ error: 'unknown token pack', externalRef });
    }
  } else if (!tier || !VALID_TIERS.includes(tier)) {
    return ok({ error: 'bad external_reference', externalRef });
  }

  const admin = createAdminClient();

  // For pack purchases the payments.tier column gets the user's CURRENT tier
  // (we're not changing it — the pack just adds bonus tokens). For tier
  // upgrades it's the target tier.
  //
  // `kind` is what makes that readable downstream. Without it the row above
  // is indistinguishable from a plan purchase, and /app/billing rendered a
  // token pack as "Plan Free · $149.00" — a plan the buyer never bought, at
  // a price no plan costs.
  let paymentRowTier: SubscriptionTier;
  if (isPackPurchase) {
    const { data: currentProfile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();
    paymentRowTier = (currentProfile?.tier as SubscriptionTier | undefined) ?? 'FREE';
  } else {
    paymentRowTier = tier!; // validated above
  }
  const packForRow = isPackPurchase ? getTokenPack(packIdRaw!) : undefined;

  // Always record the charge regardless of status — pending/rejected ones
  // are useful audit data. UNIQUE on mp_payment_id makes this idempotent.
  const { error: paymentErr } = await admin.from('payments').upsert(
    {
      user_id: userId,
      tier: paymentRowTier,
      kind: isPackPurchase ? 'pack' : 'plan',
      pack_id: packForRow?.id ?? null,
      // What the buyer gets if (and only if) this charge reaches approved.
      // Recorded on the row so the receipt on /app/billing can say it
      // without re-deriving it from the external reference.
      tokens_granted: packForRow?.tokens ?? null,
      mp_payment_id: mpId,
      amount_cents: amountCents,
      currency,
      status,
      raw,
    },
    { onConflict: 'mp_payment_id' },
  );
  if (paymentErr) {
    console.error('[mp/webhook] payments upsert failed', paymentErr);
    return retry({ error: 'db payments insert failed' });
  }

  // Feed the command-center notifications. Best-effort (notify never throws);
  // a rejected/cancelled charge is worth an admin's attention.
  if (status === 'rejected' || status === 'cancelled') {
    await notify({
      severity: 'warning',
      title: `Pago ${status === 'rejected' ? 'rechazado' : 'cancelado'} — $${amountMajor} ${currency}`,
      body: `MP ${charge.mpReference} · ${isPackPurchase ? `pack ${packIdRaw}` : `tier ${tier}`}`,
      href: '/dashboard/billing',
      source: 'mp.webhook',
    });
  }

  // ── Disputes: nothing changes (Términos de Suscripción §10.2, WS-8) ───
  // A chargeback or a mediation is recorded, triaged and handed to an admin.
  // No tokens come off and no plan drops while it is open.
  if (isDispute(status)) {
    const opened = await onChargebackOpened({ mpPaymentId: mpId, mpStatus: status });
    if (!opened.ok) return retry({ error: 'chargeback record failed' });
    return ok({ ok: true, status, dispute: true });
  }

  // ── Refunds ───────────────────────────────────────────────────────────
  // POLICY. A refunded PACK is a purchase undone: its tokens come off the
  // balance (clamped at zero — clawback_token_pack, migration 0038), keyed to
  // the payment id so a retry changes nothing. A refund never changes a
  // plan, price or the account (Términos §7.3): a legacy one-off plan stays.
  if (status === 'refunded') {
    const reason = 'refunded' as const;
    const reversedLabel = 'reembolsado';
    const { data: profile } = await admin
      .from('profiles')
      .select('email, tier, tier_ends_at')
      .eq('id', userId)
      .maybeSingle();
    const email = (profile?.email as string | null) ?? null;

    if (isPackPurchase) {
      const pack = getTokenPack(packIdRaw!)!;
      const claw = await clawbackTokenPack({ mpPaymentId: mpId, reason });
      if (!claw.ok) {
        if (claw.error === 'no_purchase') {
          // Nothing was ever granted for this payment (it never reached
          // approved); there is nothing to take back.
          return ok({ ok: true, kind: 'pack', status, clawback: 'nothing_granted' });
        }
        return retry({ error: 'pack clawback failed' });
      }
      if (!claw.alreadyClawedBack) {
        await logAudit({
          action: 'tokens.revoke',
          actorId: null,
          actorEmail: null,
          targetUserId: userId,
          targetEmail: email,
          before: { token_bonus_balance: claw.previousBalance },
          after: { token_bonus_balance: claw.balance },
          metadata: {
            mp_payment_id: mpId,
            mp_reference: charge.mpReference,
            source: charge.source,
            kind: `tokens.pack_${reason}`,
            pack_id: pack.id,
            tokens_granted: claw.tokensGranted,
            tokens_removed: claw.tokensRemoved,
          },
        });
        await notify({
          severity: 'warning',
          title: `Pack ${reversedLabel} — ${claw.tokensRemoved.toLocaleString('es-MX')} tokens retirados`,
          body: `${email ?? userId} · MP ${charge.mpReference} · $${amountMajor} ${currency}`,
          href: '/dashboard/billing',
          source: 'mp.webhook',
        });
        if (email) {
          const tmpl = paymentReversedTemplate({
            reason,
            what: `${claw.tokensGranted.toLocaleString('es-MX')} tokens`,
            amountMajor,
            currency,
            paymentId: mpId,
            appUrl: getAppUrl(),
          });
          void sendEmail({
            to: email,
            subject: 'Pago revertido: retiramos los tokens del pack · Chalyb',
            html: tmpl.html,
            text: tmpl.text,
          }).catch((err) => console.error('[mp/webhook] reversal email failed', err));
        }
      }
      return ok({
        ok: true,
        kind: 'pack',
        status,
        clawback: claw.alreadyClawedBack ? 'already' : 'done',
      });
    }

    // Legacy one-off plan: the plan stays (§7.3); a person classifies it.
    await onRefundReported({ userId, mpPaymentId: mpId, amountMajor: Number(amountMajor) || null });
    return ok({ ok: true, status, reversal: 'recorded' });
  }

  // ── Amount + currency gate ───────────────────────────────────────────
  // Everything past this point GRANTS something. external_reference says what
  // was bought; this checks that what was actually paid is that thing's price.
  //
  // Without it, external_reference is the only input deciding entitlements and
  // it is attacker-chosen: pay for the $149 token pack, then have the webhook
  // processed against "<myUserId>|VIP" and walk away with a VIP plan. The
  // payment row above is already written either way, so a mismatch is visible
  // in /dashboard/billing and the audit log.
  //
  // A mismatch returns 200: MP retrying the same charge can never make the
  // amount right, and we do not want a retry storm on a payment we refuse.
  if (status === 'approved') {
    const expected: ExpectedCharge | null = isPackPurchase
      ? expectedChargeForPack(packIdRaw!)
      : expectedChargeForTier(tier!);

    if (!expected) {
      // FREE and PARTNER have no price (TIER_PRICING null): no payment can
      // ever grant them, so an approved charge claiming one is bogus.
      console.error('[mp/webhook] REFUSING grant — nothing is for sale at this reference:', {
        externalRef,
        mpId,
      });
      await notify({
        severity: 'warning',
        title: 'Pago aprobado sin producto — no se otorgó nada',
        body: `MP ${charge.mpReference} · ref ${externalRef}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      return ok({ error: 'reference is not purchasable' });
    }

    const check = checkCharge(expected, {
      amountMajor: charge.amountMajor,
      currency: charge.currency,
    });
    if (!check.ok) {
      console.error('[mp/webhook] REFUSING grant — payment does not match the price', {
        reason: check.reason,
        expected: `${expected.amountCents} ${expected.currency} (${expected.label})`,
        paid: `${check.paidCents} ${check.paidCurrency}`,
        externalRef,
        mpId,
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
          mp_payment_id: mpId,
          mp_reference: charge.mpReference,
          source: charge.source,
          kind: 'payment.amount_mismatch',
          rejected: true,
          mismatch: check.reason,
          expected_amount_cents: expected.amountCents,
          expected_currency: expected.currency,
          paid_amount_cents: check.paidCents,
          paid_currency: check.paidCurrency,
          external_reference: externalRef,
        },
      });
      await notify({
        severity: 'critical',
        title: 'Pago con monto que no corresponde — no se otorgó nada',
        body:
          `MP ${charge.mpReference} · pagó $${(check.paidCents / 100).toFixed(2)} ` +
          `${check.paidCurrency}, ${expected.label} cuesta $${(expected.amountCents / 100).toFixed(2)} ` +
          `${expected.currency}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
      // Nothing was granted, so the whole amount goes back (Términos
      // §7.2(d): an amount other than the one shown), within 5 business days.
      if (userId && check.paidCents > 0) {
        await issueRefund({
          userId,
          mpPaymentId: mpId,
          cents: check.paidCents,
          reason: 'legal_7_2_d',
          surface: 'mp_webhook',
          actor: null,
        });
      }
      return ok({
        error: 'amount mismatch',
        expected: expected.amountCents,
        paid: check.paidCents,
      });
    }
  }

  // ── PACK PURCHASE branch: grant tokens + audit, then exit. ────────────
  if (isPackPurchase && status === 'approved') {
    const pack = getTokenPack(packIdRaw!);
    if (!pack) return ok({ error: 'pack vanished' }); // validated above; defensive
    const grantRes = await grantTokenPack({
      userId,
      tokens: pack.tokens,
      source: 'mp_payment',
      mpPaymentId: mpId,
    });
    if (!grantRes.ok) return retry({ error: 'pack grant failed' });
    await logAudit({
      action: 'tier.payment', // closest existing action; metadata distinguishes
      actorId: null,
      actorEmail: null,
      targetUserId: userId,
      targetEmail: null,
      before: null,
      after: { tokens_granted: pack.tokens },
      metadata: {
        mp_payment_id: mpId,
        mp_reference: charge.mpReference,
        source: charge.source,
        amount_cents: amountCents,
        currency,
        pack_id: pack.id,
        kind: 'tokens.pack_purchase',
        already_granted: grantRes.alreadyGranted ?? false,
      },
    });
    if (!grantRes.alreadyGranted) {
      await notify({
        severity: 'info',
        title: `Pack de tokens acreditado — ${pack.tokens.toLocaleString('es-MX')} tokens`,
        body: `MP ${charge.mpReference} · $${amountMajor} ${currency}`,
        href: '/dashboard/billing',
        source: 'mp.webhook',
      });
    }
    return ok({ ok: true, kind: 'pack', tokens: pack.tokens });
  }
  if (isPackPurchase) {
    // Pack purchase but not approved (pending/rejected). Row already
    // recorded above; nothing else to do.
    return ok({ ok: true, kind: 'pack', status });
  }

  // ── LEGACY TIER PURCHASE branch ──────────────────────────────────────
  // Plans are sold as subscriptions now (subscription-sync.ts); this stays
  // for preferences created before that, which Mercado Pago may still
  // settle. Only flip the tier if the payment is actually approved.
  if (status === 'approved') {
    const { data: targetBefore } = await admin
      .from('profiles')
      .select('email, tier')
      .eq('id', userId)
      .maybeSingle();

    const { error: tierErr } = await admin
      .from('profiles')
      // tier_ends_at cleared: paying again withdraws a pending cancellation
      // and starts a fresh period, so the plan must not lapse on the old date.
      .update({ tier, tier_ends_at: null })
      .eq('id', userId);
    if (tierErr) {
      console.error('[mp/webhook] tier update failed', tierErr);
      return retry({ error: 'db tier update failed' });
    }
    // Auto-provision engine access on VIP upgrades. PRO upgrades wait
    // until the user picks their live engine (setSelectedLiveEngine).
    if (tier === 'VIP') await provisionAllAccessEngines(userId, 'mp_payment');

    await logAudit({
      action: 'tier.payment',
      actorId: null,
      actorEmail: null,
      targetUserId: userId,
      targetEmail: (targetBefore?.email as string | null) ?? null,
      before: { tier: (targetBefore?.tier as string | null) ?? null },
      after: { tier },
      metadata: { mp_payment_id: mpId, source: charge.source, amount_cents: amountCents, currency },
    });

    await notify({
      severity: 'info',
      title: `Pago aprobado — tier ${tier} activado`,
      body: `${(targetBefore?.email as string | null) ?? userId} · MP ${charge.mpReference} · $${amountMajor} ${currency}`,
      href: '/dashboard/billing',
      source: 'mp.webhook',
    });

    // Confirmation email — best-effort. The tier write already succeeded, so
    // a mail failure must not make MP retry (that would double-send).
    const userEmail = targetBefore?.email as string | null | undefined;
    const confirmedTier = tier!;
    if (userEmail) {
      const tmpl = paymentSuccessTemplate({
        tier: TIER_CAPS[confirmedTier].label,
        amountMajor,
        currency,
        paymentId: mpId,
        appUrl: getAppUrl(),
      });
      void sendEmail({
        to: userEmail,
        subject: `Tu plan ${TIER_CAPS[confirmedTier].label} está activo · Chalyb`,
        html: tmpl.html,
        text: tmpl.text,
      }).catch((err) => console.error('[mp/webhook] payment email failed', err));
    }
  }

  return ok({ ok: true, status, tier });
}
