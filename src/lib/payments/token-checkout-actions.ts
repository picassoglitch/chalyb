'use server';

// Mercado Pago checkout for token top-up packs — Checkout Pro via the Orders
// API. Parallel to authorizeTierSubscription (which sells the monthly plans)
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

import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { getTokenPack } from './pricing';
import {
  chargeFromOrder,
  isAllowedCheckoutUrl,
  orderAmount,
  orderIdempotencyKey,
} from './order-charge';
import { settleOneOffCharge } from './one-off-settlement';
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

export async function createTokenPackCheckout(packId: string): Promise<PackCheckoutResult> {
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
      // Orders require X-Idempotency-Key. It is STABLE for this user, pack
      // and ten-minute window (order-charge.ts): a double click or a
      // framework retry gets the same order and checkout_url back instead
      // of a second payable order.
      requestOptions: {
        idempotencyKey: orderIdempotencyKey({
          userId: session.user.id,
          packId: pack.id,
          mode: 'hosted',
        }),
      },
    });

    // checkout_url is documented for Checkout Pro via Orders but the SDK's
    // OrderResponse type (2.12) predates it, hence the widening.
    const url = (result as typeof result & { checkout_url?: string }).checkout_url;
    if (!result.id || !url) {
      console.error('[token-pack-checkout] order returned no id/checkout_url', result);
      return { ok: false, reason: 'mp_error', error: 'MP no devolvió URL de checkout.' };
    }
    // The browser goes wherever this returns. Only Mercado Pago's own
    // checkout hosts qualify, over HTTPS.
    if (!isAllowedCheckoutUrl(url)) {
      console.error('[token-pack-checkout] refusing to redirect to a non-Mercado Pago host', {
        orderId: result.id,
        host: (() => {
          try {
            return new URL(url).host;
          } catch {
            return 'unparseable';
          }
        })(),
      });
      return {
        ok: false,
        reason: 'mp_error',
        error:
          'Mercado Pago devolvió una URL de pago inesperada. No te redirigimos; inténtalo de nuevo.',
      };
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

export interface PackCardPaymentResult {
  ok: boolean;
  /** Ledger status after the charge: approved | pending | rejected | … */
  status?: string;
  reason?:
    | 'unauth'
    | 'admin_skip'
    | 'unknown_pack'
    | 'not_configured'
    | 'bad_token'
    | 'rejected'
    | 'mp_error';
  error?: string;
}

/**
 * Pay a token pack with a card tokenised in the app (Card Payment Brick), no
 * redirect. Creates an Orders API order in `automatic` mode — Mercado Pago
 * charges the token in this same request — then settles it exactly as the
 * webhook would (ledger row, price gate, token grant), so the tokens are in
 * the balance before the response. The `orders` notification that follows
 * finds the row already there and changes nothing.
 *
 * The browser sends the token and what the Brick learned about the card;
 * price and currency come from TOKEN_PACKS here. Tokens are never logged.
 */
export async function payTokenPackWithCard(input: {
  packId: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string | null;
  installments?: number;
  paymentTypeId?: string | null;
  identification?: { type: string; number: string } | null;
}): Promise<PackCardPaymentResult> {
  try {
    const session = await getSessionUser();
    if (!session) {
      return { ok: false, reason: 'unauth', error: 'Inicia sesión para comprar tokens.' };
    }
    if (isAdminRole(session.role)) {
      return {
        ok: false,
        reason: 'admin_skip',
        error: 'Como admin tienes tokens ilimitados — no necesitas comprar packs.',
      };
    }
    const pack = getTokenPack(input.packId);
    if (!pack) {
      return { ok: false, reason: 'unknown_pack', error: `Pack desconocido: ${input.packId}` };
    }
    if (!isCheckoutReady()) {
      console.error('[token-pack-card] refusing to charge:', checkoutNotReadyError());
      return { ok: false, reason: 'not_configured', error: checkoutNotReadyError() };
    }
    const token = typeof input.token === 'string' ? input.token.trim() : '';
    const paymentMethodId =
      typeof input.paymentMethodId === 'string' ? input.paymentMethodId.trim() : '';
    if (!token || token.length > 128 || !paymentMethodId) {
      return {
        ok: false,
        reason: 'bad_token',
        error: 'El formulario no entregó una tarjeta válida. Inténtalo de nuevo.',
      };
    }
    const installments = Math.max(1, Math.min(24, Math.trunc(input.installments ?? 1)));
    const paymentType =
      input.paymentTypeId === 'debit_card' || input.paymentTypeId === 'prepaid_card'
        ? input.paymentTypeId
        : 'credit_card';

    const { order } = getMercadoPago();
    const amount = orderAmount(pack.amountCents);
    const title = `Chalyb · ${pack.label}`;
    const externalReference = `pack|${session.user.id}|${pack.id}`;

    const result = await order.create({
      body: {
        type: 'online',
        // The card is charged in this request; the result comes back in
        // `status` (processed / failed / action_required).
        processing_mode: 'automatic',
        total_amount: amount,
        external_reference: externalReference,
        description: title,
        payer: {
          ...(session.user.email ? { email: session.user.email } : {}),
          ...(input.identification ? { identification: input.identification } : {}),
        },
        items: [
          {
            title,
            unit_price: amount,
            quantity: 1,
            unit_measure: 'unit',
            external_code: `pack-${pack.id}`,
          },
        ],
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: paymentMethodId,
                type: paymentType,
                token,
                installments,
                statement_descriptor: 'CHALYB TOKENS',
              },
            },
          ],
        },
      },
      // Stable per user, pack and ten-minute window (order-charge.ts): a
      // retried submit reuses the order instead of charging twice. The card
      // token is single-use anyway; the key is what keeps the ORDER single.
      requestOptions: {
        idempotencyKey: orderIdempotencyKey({
          userId: session.user.id,
          packId: pack.id,
          mode: 'card',
        }),
      },
    });

    if (!result.id) {
      console.error('[token-pack-card] order returned no id', { status: result.status ?? null });
      return {
        ok: false,
        reason: 'mp_error',
        error: 'Mercado Pago no confirmó el pago. Inténtalo de nuevo en un momento.',
      };
    }

    // Same settlement the `orders` webhook runs, so the tokens land now.
    const charge = chargeFromOrder(result);
    const settled = await settleOneOffCharge(charge, result as unknown as Record<string, unknown>);
    if (settled.httpStatus !== 200) {
      // Money may have moved but our side failed; the webhook retries the
      // settlement. Tell the user honestly.
      return {
        ok: false,
        reason: 'mp_error',
        status: charge.status,
        error:
          'El pago se envió pero no pudimos acreditar los tokens todavía. Se acreditan solos en unos minutos; si no, escríbenos.',
      };
    }
    if (charge.status === 'approved') return { ok: true, status: charge.status };
    if (charge.status === 'pending' || charge.status === 'in_process') {
      return {
        ok: true,
        status: charge.status,
        error:
          'Mercado Pago dejó el pago en revisión; los tokens se acreditan en cuanto lo apruebe.',
      };
    }
    const detail = (result as { status_detail?: string }).status_detail;
    return {
      ok: false,
      reason: 'rejected',
      status: charge.status,
      error: `Mercado Pago rechazó el pago${detail ? ` (${detail.replace(/_/g, ' ')})` : ''}. Prueba con otra tarjeta.`,
    };
  } catch (err) {
    console.error('[token-pack-card] order.create failed', err);
    return {
      ok: false,
      reason: 'mp_error',
      error: `Mercado Pago no pudo procesar el pago: ${describeMpError(err)}`,
    };
  }
}
