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
//      "pack_<userId>_<packId>" → one-off-settlement.ts grants the tokens.
//
// Price and currency come from the owner's pack prices on the server
// (pack-prices.ts). The browser names the pack, says whether the Paquetes
// box was ticked and which total it showed; the server refuses unless the
// box is ticked and that total is the one in force (pack-checkout-core.ts),
// records the consent, and only then creates the order — for that total. The Orders API is what the application in the Mercado Pago
// panel is registered for ("API de Orders"); the preferences-based Checkout
// Pro it replaces is being discontinued.
//
// Admins still pay for packs (we don't comp them via this path) but they
// don't NEED to — admins have unlimited via getTokenBalance. The button on
// /app/usage is hidden for admins.

import { getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { termsAcceptancePending } from '@/lib/legal/reaccept-server';
import { gatePackCharge, type PackGateRefusal } from './pack-checkout-core';
import { loadPricedPacks, packTermsText } from './pack-prices';
import { recordPackConsent } from './pack-consent';
import { packReference } from './subscription-reference';
import { STATEMENT_DESCRIPTOR, orderAdditionalInfo, packItem, payerName } from './order-quality';
import {
  chargeFromOrder,
  isAllowedCheckoutUrl,
  orderIdempotencyKey,
} from './order-charge';
import { settleOneOffCharge } from './one-off-settlement';
import {
  getMercadoPagoIsolated,
  isCheckoutReady,
  checkoutNotReadyError,
  logMpCreate,
  mpErrorCodeOf,
  mpPayerEmail,
  mpReturnUrl,
  MP_GENERIC_ERROR,
  sellerMatches,
} from './mercadopago';
import { isCardErrorCode } from './mp-config';

/** Same rule and words as the plan checkout (subscription-actions.ts). */
const TERMS_PENDING_ERROR = 'Acepta los nuevos Términos (o revisa tus opciones) antes de comprar.';

/** What a customer reads when the card itself was the problem. */
const CARD_ERROR =
  'No pudimos validar tu tarjeta. Revisa los datos o prueba con otra; no se hizo ningún cargo.';

export interface PackCheckoutResult {
  ok: boolean;
  url?: string;
  reason?:
    | 'unauth'
    | 'admin_skip'
    | 'unknown_pack'
    | 'not_configured'
    | 'mp_error'
    | 'terms_pending'
    | PackGateRefusal
    | 'consent_failed';
  error?: string;
}

/** What the checkout page sends with either way of paying. */
export interface PackConsentInput {
  packId: string;
  /** The Paquetes checkbox (Términos de los Paquetes §9.1). */
  accepted: boolean;
  /** The total the page showed, in centavos. */
  shownCents: number;
  locale: string;
  clientTimezone?: string | null;
}

/** Words for the refusals the gate decides (the page maps the reason to
 *  its own translated message; these are the fallback). */
const GATE_ERROR: Record<PackGateRefusal | 'consent_failed', string> = {
  unknown_pack: 'Ese paquete no existe.',
  consent_required: 'Marca la casilla para aceptar el cargo único. No se hizo ningún cargo.',
  not_configured: 'Los paquetes no están disponibles por ahora. No se hizo ningún cargo.',
  price_changed: 'El precio cambió. Recarga la página para ver el actual. No se hizo ningún cargo.',
  terms_mismatch: 'Los paquetes no están disponibles por ahora. No se hizo ningún cargo.',
  consent_failed: 'No pudimos guardar tu aceptación. No se hizo ningún cargo; inténtalo de nuevo.',
};

/** The gate, then the evidence. Either refusal charges nothing. */
async function acceptPackCharge(
  input: PackConsentInput,
  session: { user: { id: string; email?: string | null } },
  mode: 'card' | 'hosted',
) {
  const gate = await gatePackCharge(input, {
    loadTotals: async () => (await loadPricedPacks())?.totals ?? null,
    termsText: packTermsText,
  });
  if (!gate.ok) {
    if (gate.reason === 'terms_mismatch') {
      console.error('[pack-checkout] the Paquetes text in force does not show this price', {
        packId: input.packId,
      });
    }
    return { ok: false as const, reason: gate.reason, error: GATE_ERROR[gate.reason] };
  }
  const priced = await loadPricedPacks();
  if (!priced) {
    return { ok: false as const, reason: 'not_configured' as const, error: GATE_ERROR.not_configured };
  }
  const accountEmail = session.user.email ?? null;
  try {
    await recordPackConsent({
      userId: session.user.id,
      email: accountEmail,
      pack: gate.pack,
      cents: gate.cents,
      pricing: priced.pricing,
      termsText: gate.termsText,
      locale: input.locale,
      clientTimezone: typeof input.clientTimezone === 'string' ? input.clientTimezone.slice(0, 64) : null,
      mode,
    });
  } catch (err) {
    console.error('[pack-checkout] consent not stored — refusing before any charge', err);
    return { ok: false as const, reason: 'consent_failed' as const, error: GATE_ERROR.consent_failed };
  }
  return gate;
}

export async function createTokenPackCheckout(input: PackConsentInput): Promise<PackCheckoutResult> {
  const packId = input?.packId;
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
    // aceptacion-ux §8: no new charge under Terms the person hasn't accepted.
    if (await termsAcceptancePending(session.user.id)) {
      return { ok: false, reason: 'terms_pending', error: TERMS_PENDING_ERROR };
    }

    // Same rule as the tier checkout: decided before the SDK is touched, so
    // nothing is created on the Mercado Pago side and no charge is attempted.
    if (!isCheckoutReady()) {
      console.error('[mp/token-checkout] refusing to start checkout:', checkoutNotReadyError());
      return { ok: false, reason: 'not_configured', error: checkoutNotReadyError() };
    }
    if (!(await sellerMatches())) {
      return { ok: false, reason: 'not_configured', error: MP_GENERIC_ERROR };
    }

    // The box, the price in force = the price shown, then the evidence.
    const accepted = await acceptPackCharge(input, session, 'hosted');
    if (!accepted.ok) return accepted;
    const { pack, amount } = accepted;

    // B33: the test buyer in `test`, the user (if any) in `prod`.
    const payerEmail = mpPayerEmail(session.user.email);
    const { order } = getMercadoPagoIsolated();
    const title = `Chalyb · ${pack.label}`;

    // external_reference shape: "pack_<userId>_<packId>" so the webhook can
    // tell a pack from a plan ("sub|…" for subscriptions, "<userId>|<TIER>"
    // for the legacy one-off purchases).
    const result = await order.create({
      body: {
        type: 'online',
        // The only mode Checkout Pro accepts: the buyer completes the
        // payment on Mercado Pago's page, not in this request.
        processing_mode: 'manual',
        total_amount: amount,
        external_reference: packReference(session.user.id, pack.id),
        description: title,
        payer: {
          ...(payerEmail ? { email: payerEmail } : {}),
          ...payerName(session.user),
        },
        items: [packItem(pack, amount)],
        additional_info: orderAdditionalInfo(session.user),
        config: {
          statement_descriptor: STATEMENT_DESCRIPTOR,
          online: {
            success_url: mpReturnUrl('/app/usage?status=success'),
            pending_url: mpReturnUrl('/app/usage?status=pending'),
            failure_url: mpReturnUrl('/app/usage?status=failure'),
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
          amountCents: accepted.cents,
        }),
      },
    });

    // checkout_url is documented for Checkout Pro via Orders but the SDK's
    // OrderResponse type (2.12) predates it, hence the widening.
    logMpCreate('order', {
      id: result.id,
      externalReference: packReference(session.user.id, pack.id),
    });
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
      // The Orders API answers a 4xx with { errors: [{ code, message, details }] }
      // and the SDK throws that body as is.
      errors?: unknown;
      name?: string;
    };
    console.error('[token-pack-checkout] uncaught', {
      packId,
      mp_code: mpErrorCodeOf(err),
      errorName: e?.name,
      errorMessage: e?.message,
      causeStatus: e?.cause?.status,
      causeMessage: e?.cause?.error?.message,
      mpErrors: e?.errors,
    });
    return { ok: false, reason: 'mp_error', error: MP_GENERIC_ERROR };
  }
}

// Note: a "use server" file may export only async functions (Next.js
// refuses "found object"); the types above are erased at build.

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
    | 'terms_pending'
    | 'mp_error'
    | PackGateRefusal
    | 'consent_failed';
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
 * The browser sends the token, what the Brick learned about the card, the
 * Paquetes box and the total it showed; price and currency come from the
 * owner's pack prices here. Tokens are never logged.
 */
export async function payTokenPackWithCard(input: PackConsentInput & {
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
    // aceptacion-ux §8: no new charge under Terms the person hasn't accepted.
    if (await termsAcceptancePending(session.user.id)) {
      return { ok: false, reason: 'terms_pending', error: TERMS_PENDING_ERROR };
    }
    if (!isCheckoutReady()) {
      console.error('[token-pack-card] refusing to charge:', checkoutNotReadyError());
      return { ok: false, reason: 'not_configured', error: checkoutNotReadyError() };
    }
    if (!(await sellerMatches())) {
      return { ok: false, reason: 'not_configured', error: MP_GENERIC_ERROR };
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

    // The box, the price in force = the price shown, then the evidence.
    const accepted = await acceptPackCharge(input, session, 'card');
    if (!accepted.ok) return accepted;
    const { pack, amount } = accepted;

    const payerEmail = mpPayerEmail(session.user.email);
    const { order } = getMercadoPagoIsolated();
    const title = `Chalyb · ${pack.label}`;
    const externalReference = packReference(session.user.id, pack.id);

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
          ...(payerEmail ? { email: payerEmail } : {}),
          ...payerName(session.user),
          ...(input.identification ? { identification: input.identification } : {}),
        },
        items: [packItem(pack, amount)],
        additional_info: orderAdditionalInfo(session.user),
        transactions: {
          payments: [
            {
              amount,
              payment_method: {
                id: paymentMethodId,
                type: paymentType,
                token,
                installments,
                statement_descriptor: STATEMENT_DESCRIPTOR,
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
          amountCents: accepted.cents,
        }),
      },
    });

    logMpCreate('order', { id: result.id, externalReference });
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
    console.error('[token-pack-card] payment not approved', {
      status: charge.status,
      status_detail: (result as { status_detail?: string }).status_detail ?? null,
    });
    return { ok: false, reason: 'rejected', status: charge.status, error: CARD_ERROR };
  } catch (err) {
    const code = mpErrorCodeOf(err);
    console.error('[token-pack-card] order.create failed', { mp_code: code }, err);
    return isCardErrorCode(code)
      ? { ok: false, reason: 'rejected', error: CARD_ERROR }
      : { ok: false, reason: 'mp_error', error: MP_GENERIC_ERROR };
  }
}
