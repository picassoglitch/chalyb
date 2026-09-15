'use server';

// Mercado Pago subscription — the server function behind the card form on
// /app/subscription/checkout. The browser tokenises the card with the Card
// Payment Brick (the card number never touches our servers) and sends the
// single-use token here; this creates the preapproval already AUTHORISED
// (Mercado Pago charges the first month on the spot) and activates the tier.
//
// FLOW:
//   1. /app/subscription → "Cambiar a Pro" → /app/subscription/checkout?tier=PRO
//   2. The Brick tokenises the card → authorizeTierSubscription({ tier, cardTokenId })
//   3. This validates session + tier, creates the preapproval
//      (status "authorized", card_token_id), records it, and runs the same
//      sync the webhook runs, so the tier is active before the response.
//   4. Mercado Pago keeps charging monthly; `subscription_preapproval` and
//      `subscription_authorized_payment` notifications keep our copy honest.
//
// Price, currency and frequency come from TIER_PRICING on the server. The
// browser only names the tier and hands over a token. Tokens are never logged.
//
// ADMIN: admins change tiers directly in tier-actions.ts and get
// { ok: false, reason: 'admin_skip' } here, same as the token pack checkout.

import { getSessionUser, type SubscriptionTier } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { createAdminClient } from '@/lib/supabase/admin';
import { TIER_PRICING } from './pricing';
import {
  getMercadoPago,
  getAppUrl,
  isCheckoutReady,
  checkoutNotReadyError,
  describeMpError,
} from './mercadopago';
import {
  isSubscribableTier,
  normalizePreapprovalStatus,
  subscriptionReference,
} from './subscription-reference';
import { syncSubscription } from './subscription-sync';

export interface AuthorizeSubscriptionResult {
  ok: boolean;
  /** Mercado Pago's status after creation: authorized | pending | … */
  status?: string;
  reason?:
    | 'unauth'
    | 'not_subscribable'
    | 'not_configured'
    | 'admin_skip'
    | 'bad_token'
    | 'rejected'
    | 'mp_error';
  /** Human-readable message for the form. */
  error?: string;
}

export async function authorizeTierSubscription(input: {
  tier: SubscriptionTier;
  cardTokenId: string;
}): Promise<AuthorizeSubscriptionResult> {
  // One try around everything, pre-flight included: a throw here would come
  // back as a generic server-function 500 and the client would only see
  // "This page couldn't load".
  try {
    const targetTier = input.tier;
    const cardTokenId = typeof input.cardTokenId === 'string' ? input.cardTokenId.trim() : '';

    const session = await getSessionUser();
    if (!session) {
      return { ok: false, reason: 'unauth', error: 'Inicia sesión para cambiar de plan.' };
    }
    if (isAdminRole(session.role)) {
      return {
        ok: false,
        reason: 'admin_skip',
        error: 'Las cuentas admin cambian de plan directo, sin pasar por el cobro.',
      };
    }
    if (!isSubscribableTier(targetTier)) {
      return {
        ok: false,
        reason: 'not_subscribable',
        error:
          targetTier === 'FREE'
            ? 'El plan Free es gratis, no necesitas pasar por el cobro.'
            : 'Ese plan no se vende por suscripción.',
      };
    }
    const pricing = TIER_PRICING[targetTier];
    if (!pricing) {
      return { ok: false, reason: 'not_subscribable', error: 'Ese plan no tiene precio.' };
    }
    if (!isCheckoutReady()) {
      console.error('[mp/subscription] refusing to start checkout:', checkoutNotReadyError());
      return { ok: false, reason: 'not_configured', error: checkoutNotReadyError() };
    }
    if (!cardTokenId || cardTokenId.length > 128) {
      return {
        ok: false,
        reason: 'bad_token',
        error: 'El formulario no entregó una tarjeta válida. Inténtalo de nuevo.',
      };
    }
    const payerEmail = session.user.email;
    if (!payerEmail) {
      // Mercado Pago requires payer_email on a preapproval.
      return {
        ok: false,
        reason: 'mp_error',
        error: 'Tu cuenta no tiene correo; agrega uno en /app/settings antes de suscribirte.',
      };
    }

    const { preapproval } = getMercadoPago();
    const externalReference = subscriptionReference(session.user.id, targetTier);
    const result = await preapproval.create({
      body: {
        reason: pricing.description,
        external_reference: externalReference,
        payer_email: payerEmail,
        card_token_id: cardTokenId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: pricing.amountCents / 100, // Mercado Pago wants major units
          currency_id: pricing.currency,
        },
        back_url: `${getAppUrl()}/app/subscription`,
        status: 'authorized',
      },
    });

    if (!result.id) {
      console.error('[mp/subscription] preapproval returned no id', {
        status: result.status ?? null,
      });
      return {
        ok: false,
        reason: 'mp_error',
        error: 'Mercado Pago no confirmó la suscripción. Inténtalo de nuevo en un momento.',
      };
    }

    // Our copy, written before the sync so a webhook racing us finds it.
    const admin = createAdminClient();
    await admin.from('subscriptions').upsert(
      {
        user_id: session.user.id,
        tier: targetTier,
        mp_preapproval_id: result.id,
        external_reference: externalReference,
        status: normalizePreapprovalStatus(result.status),
        amount_cents: pricing.amountCents,
        currency: pricing.currency,
        next_payment_date: result.next_payment_date ?? null,
        raw: result as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_preapproval_id', ignoreDuplicates: true },
    );

    // Same path the webhook takes: fetch the preapproval, check the price,
    // apply the entitlement. Doing it here means the plan is active when the
    // form says so, not seconds later when the notification lands.
    const status = normalizePreapprovalStatus(result.status);
    try {
      await syncSubscription(result.id);
    } catch (err) {
      // The webhook will finish the job; the user's card was still authorised.
      console.error('[mp/subscription] immediate sync failed, webhook will retry', err);
    }

    if (status === 'authorized') return { ok: true, status };
    if (status === 'pending') {
      return {
        ok: true,
        status,
        error:
          'Mercado Pago dejó la suscripción pendiente de confirmación; tu plan se activa en cuanto la apruebe.',
      };
    }
    return {
      ok: false,
      reason: 'rejected',
      status,
      error: 'Mercado Pago no autorizó la tarjeta para el cobro mensual. Prueba con otra tarjeta.',
    };
  } catch (err) {
    console.error('[mp/subscription] preapproval.create failed', err);
    const detail = describeMpError(err);
    const isCurrencyError = /currency|currency_id|moneda/i.test(detail);
    const isPayerError = /payer|collector|test user|usuario de prueba/i.test(detail);
    const isCardError = /card|token|tarjeta/i.test(detail);
    const hint = isCurrencyError
      ? ' — tu cuenta de Mercado Pago seguramente solo acepta moneda local. Revisa `currency` en src/lib/payments/pricing.ts.'
      : isPayerError
        ? ' — con credenciales de prueba, el correo del usuario debe ser el de un usuario de prueba de Mercado Pago (ver docs/payments/mercadopago.md).'
        : isCardError
          ? ' — revisa los datos de la tarjeta o prueba con otra.'
          : '';
    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo activar la suscripción: ${detail}${hint}`,
    };
  }
}
