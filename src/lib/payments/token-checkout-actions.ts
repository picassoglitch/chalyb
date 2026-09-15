'use server';

// Mercado Pago checkout for token top-up packs — Checkout Pro via the Orders
// API. Parallel to createTierSubscription (which sells the monthly plans)
// but the post-payment effect is different: instead of a tier, the webhook
// calls grantTokenPack() to add to profiles.token_bonus_balance.
//
// FLOW:
//   1. User clicks "Comprar +500k tokens" → createTokenPackCheckout('tokens_500k')
//   2. Server creates an order (POST /v1/orders, type "online") and returns
//      its checkout_url
//   3. Browser navigates to the Mercado Pago-hosted checkout
//   4. User pays (card, OXXO, SPEI, account money…)
//   5. MP redirects back to /app/usage?status=success
//   6. (Async) MP webhook, topic `orders`, external_reference
//      "pack|<userId>|<packId>" → one-off-settlement.ts grants the tokens.
//
// Price and currency come from TOKEN_PACKS on the server. The browser only
// names the pack. The Orders API is what the application in the Mercado Pago
// panel is registered for ("API de Orders"); the preferences-based Checkout
// Pro it replaces is being discontinued.
//
// Admins still pay for packs (we don't comp them via this path) but they
// don't NEED to — admins have unlimited via getTokenBalance. The button on
// /app/usage is hidden for admins.

import { randomUUID } from 'node:crypto';
import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { getTokenPack } from './pricing';
import { orderAmount } from './order-charge';
import {
  getMercadoPago,
  getAppUrl,
  isCheckoutReady,
  checkoutNotReadyError,
  describeMpError,
} from './mercadopago';

export interface PackCheckoutResult {
  ok: boolean;
  url?: string;
  reason?: 'unauth' | 'admin_skip' | 'unknown_pack' | 'not_configured' | 'mp_error';
  error?: string;
}

export async function createTokenPackCheckout(
  packId: string,
): Promise<PackCheckoutResult> {
  // Top-level try wraps EVERYTHING — including the pre-flight checks. The
  // previous version had try/catch only around the MP call, so a thrown
  // exception from getSessionUser / isMercadoPagoConfigured / config
  // initialization would escape and Next.js would 500 the server action
  // (visible to the user as "This page couldn't load"). Now any thrown
  // value short-circuits to a structured PackCheckoutResult the client
  // can render in its sticky-error panel.
  try {
    const session = await getSessionUser();
    if (!session) {
      return { ok: false, reason: 'unauth', error: 'Inicia sesión para comprar tokens.' };
    }
    // Admins don't need packs. If we let them buy anyway it'd be confusing.
    if (isAdminRole(session.role)) {
      return {
        ok: false,
        reason: 'admin_skip',
        error: 'Como admin tienes tokens ilimitados — no necesitas comprar packs.',
      };
    }

    const pack = getTokenPack(packId);
    if (!pack) {
      return { ok: false, reason: 'unknown_pack', error: `Pack desconocido: ${packId}` };
    }

    // Same rule as the tier checkout: decided before the SDK is touched, so
    // nothing is created on the Mercado Pago side and no charge is attempted.
    if (!isCheckoutReady()) {
      console.error('[mp/token-checkout] refusing to start checkout:', checkoutNotReadyError());
      return { ok: false, reason: 'not_configured', error: checkoutNotReadyError() };
    }

    const { order } = getMercadoPago();
    const appUrl = getAppUrl();
    const amount = orderAmount(pack.amountCents);
    const title = `Chalyb · ${pack.label}`;

    // external_reference shape: "pack|<userId>|<packId>" so the webhook can
    // tell a pack from a plan ("sub|…" for subscriptions, "<userId>|<TIER>"
    // for the legacy one-off purchases).
    const result = await order.create({
      body: {
        type: 'online',
        // The only mode Checkout Pro accepts: the buyer completes the
        // payment on Mercado Pago's page, not in this request.
        processing_mode: 'manual',
        total_amount: amount,
        external_reference: `pack|${session.user.id}|${pack.id}`,
        description: title,
        ...(session.user.email ? { payer: { email: session.user.email } } : {}),
        items: [
          {
            title,
            unit_price: amount,
            quantity: 1,
            unit_measure: 'unit',
            external_code: `pack-${pack.id}`,
          },
        ],
        config: {
          online: {
            success_url: `${appUrl}/app/usage?status=success`,
            pending_url: `${appUrl}/app/usage?status=pending`,
            failure_url: `${appUrl}/app/usage?status=failure`,
          },
        },
      },
      // Orders require X-Idempotency-Key; a fresh UUID per attempt means a
      // retried click can never create two payable orders.
      requestOptions: { idempotencyKey: randomUUID() },
    });

    // checkout_url is documented for Checkout Pro via Orders but the SDK's
    // OrderResponse type (2.12) predates it, hence the widening.
    const url = (result as typeof result & { checkout_url?: string }).checkout_url;
    if (!result.id || !url) {
      console.error('[token-pack-checkout] order returned no id/checkout_url', result);
      return { ok: false, reason: 'mp_error', error: 'MP no devolvió URL de checkout.' };
    }
    return { ok: true, url };
  } catch (err) {
    // Log to Vercel server logs with enough context to debug — we lose
    // the raw stack in production builds but the structured fields survive.
    const e = err as {
      message?: string;
      status?: number;
      cause?: { error?: { message?: string }; status?: number };
      name?: string;
    };
    const detail = describeMpError(err);
    console.error('[token-pack-checkout] uncaught', {
      packId,
      errorName: e?.name,
      errorMessage: e?.message,
      causeStatus: e?.cause?.status,
      causeMessage: e?.cause?.error?.message,
    });
    return { ok: false, reason: 'mp_error', error: detail };
  }
}

// Note: TOKEN_PACKS used to be re-exported here for the /app/usage page,
// but Next.js refuses to compile a "use server" file that exports anything
// except async functions ("found object" — TOKEN_PACKS is an array). The
// re-export was redundant anyway since the page can — and does — import
// TOKEN_PACKS directly from '@/lib/payments/pricing'.
