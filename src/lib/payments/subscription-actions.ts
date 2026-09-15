'use server';

// Mercado Pago subscription checkout — the server function behind "Cambiar a
// Pro" / "Cambiar a VIP". Creates a preapproval (Mercado Pago's Subscriptions
// API, "sin plan asociado" in pending state) and returns the URL where the
// user authorises the monthly charge. The tier itself is written later by
// /api/mp/webhook once Mercado Pago reports the preapproval as authorised.
//
// FLOW:
//   1. User clicks the plan → createTierSubscription('PRO')
//   2. This validates session + tier, inserts a `subscriptions` row (pending),
//      creates the preapproval, returns its init_point
//   3. Browser navigates to init_point (Mercado Pago-hosted card authorisation)
//   4. User authorises; Mercado Pago charges the first month right away
//   5. Mercado Pago sends the user back to /app/billing?status=success
//   6. (Async) webhook `subscription_preapproval` → status authorized →
//      profiles.tier flips, renewal date stored. Every month after that a
//      `subscription_authorized_payment` lands in `payments`.
//
// Price, currency and frequency come from TIER_PRICING on the server. The
// browser only names the tier.
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
import { isSubscribableTier, subscriptionReference } from './subscription-reference';

export interface SubscriptionCheckoutResult {
  ok: boolean;
  /** Mercado Pago's init_point. Only present when ok=true. */
  url?: string;
  reason?: 'unauth' | 'not_subscribable' | 'not_configured' | 'admin_skip' | 'mp_error';
  /** Human-readable message for the sticky error panel. */
  error?: string;
}

export async function createTierSubscription(
  targetTier: SubscriptionTier,
): Promise<SubscriptionCheckoutResult> {
  // One try around everything, pre-flight included: a throw here would come
  // back as a generic server-function 500 and the client would only see
  // "This page couldn't load".
  try {
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
    const appUrl = getAppUrl();
    if (!appUrl.startsWith('https://')) {
      // Unlike a preference, a preapproval has a single back_url and Mercado
      // Pago requires it to be HTTPS. Say so instead of sending a request
      // that fails with an opaque validation error.
      console.warn(
        '[mp/subscription] NEXT_PUBLIC_APP_URL is HTTP — Mercado Pago rejects a non-HTTPS back_url. Use ngrok or deploy.',
      );
      return {
        ok: false,
        reason: 'not_configured',
        error:
          'Las suscripciones necesitan una URL pública HTTPS (NEXT_PUBLIC_APP_URL). En local usa un túnel como ngrok.',
      };
    }

    const externalReference = subscriptionReference(session.user.id, targetTier);
    const result = await preapproval.create({
      body: {
        reason: pricing.description,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: pricing.amountCents / 100, // Mercado Pago wants major units
          currency_id: pricing.currency,
        },
        // Mercado Pago appends ?preapproval_id=… on the way back. The webhook
        // is what activates the plan; this page only explains the wait.
        back_url: `${appUrl}/app/billing?status=success`,
        status: 'pending',
      },
    });

    const url = result.init_point;
    if (!result.id || !url) {
      console.error('[mp/subscription] preapproval returned no id/init_point', result);
      return {
        ok: false,
        reason: 'mp_error',
        error:
          'Mercado Pago no nos dio una URL para autorizar el cobro. Inténtalo de nuevo en un momento.',
      };
    }

    // Our copy of the preapproval, written before the user leaves so the
    // webhook can find it by id even if its notification arrives before the
    // user returns. The webhook overwrites status and dates from Mercado
    // Pago; ON CONFLICT keeps this idempotent if the two race.
    const admin = createAdminClient();
    const { error: dbErr } = await admin.from('subscriptions').upsert(
      {
        user_id: session.user.id,
        tier: targetTier,
        mp_preapproval_id: result.id,
        external_reference: externalReference,
        status: 'pending',
        amount_cents: pricing.amountCents,
        currency: pricing.currency,
        next_payment_date: result.next_payment_date ?? null,
        raw: result as unknown as Record<string, unknown>,
      },
      { onConflict: 'mp_preapproval_id', ignoreDuplicates: true },
    );
    if (dbErr) {
      // The preapproval exists at Mercado Pago and the webhook will upsert it
      // from the external_reference, so the checkout can still go ahead.
      console.error('[mp/subscription] could not record the pending subscription', dbErr);
    }

    return { ok: true, url };
  } catch (err) {
    console.error('[mp/subscription] preapproval.create failed', err);
    const detail = describeMpError(err);
    const isCurrencyError = /currency|currency_id|moneda/i.test(detail);
    const isPayerError = /payer|collector|test user|usuario de prueba/i.test(detail);
    const hint = isCurrencyError
      ? ' — tu cuenta de Mercado Pago seguramente solo acepta moneda local. Revisa `currency` en src/lib/payments/pricing.ts.'
      : isPayerError
        ? ' — con credenciales de prueba, el correo del usuario debe ser el de un usuario de prueba de Mercado Pago (ver docs/payments/mercadopago.md).'
        : '';
    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo abrir la suscripción: ${detail}${hint}`,
    };
  }
}
