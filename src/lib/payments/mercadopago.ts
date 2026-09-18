// Mercado Pago SDK wrapper — server-side only.
//
// WHAT TALKS TO MERCADO PAGO, AND THROUGH WHICH CLIENT:
//   preapproval  Pro/VIP subscriptions. Created already authorised with the
//                card token from the in-app Card Payment Brick
//                (subscription-actions.ts); read, cancelled and re-synced by
//                subscription-sync.ts.
//   order        Token packs (Orders API): `automatic` with the Brick's card
//                token (token-checkout-actions.ts → payTokenPackWithCard) or
//                `manual` for the hosted checkout_url fallback (OXXO, SPEI,
//                account money). Read by the `orders` webhook topic.
//   payment      Payments API reads only: the `payment` webhook topic (legacy
//                one-off purchases made through the discontinued preferences
//                flow, and subscription charges reported on that topic).
//   mpGet        Raw GET for resources the SDK has no client for
//                (/authorized_payments/{id}).
// There is no Preference client: nothing creates preferences any more.
//
// CONFIGURATION (names as in the committed env example; set the same on Vercel):
//   MERCADOPAGO_ACCESS_TOKEN   — the application's private token. Server-side
//                                only. From Tus integraciones → the app →
//                                Credenciales (prueba / producción).
//   MERCADOPAGO_PUBLIC_KEY     — initialises the Card Payment Brick in the
//                                browser. Not a secret, but REQUIRED: without
//                                it there is no card form to pay in.
//   MERCADOPAGO_WEBHOOK_SECRET — the secret Mercado Pago signs x-signature
//                                with. REQUIRED: /api/mp/webhook rejects every
//                                notification without it, so nothing would
//                                ever be credited.
//   NEXT_PUBLIC_APP_URL        — the public origin, for the preapproval's
//                                back_url and the hosted order's return URLs.
//                                Read through src/lib/app-url.ts.
//
// LEGACY ALIAS: `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY` / `MP_WEBHOOK_SECRET` are
// still read as fallbacks so an older Vercel setup keeps working. Every
// message names the canonical MERCADOPAGO_* variable. The lookup lives in
// ./mp-config.ts.
//
// NOT-CONFIGURED FALLBACK:
// The checkout actions ask `isCheckoutReady()` BEFORE touching the SDK and
// return a clear { ok: false, reason: 'not_configured' } naming the missing
// variables, so nothing is created on the Mercado Pago side. `getMercadoPago()`
// throwing is the backstop for a caller that skipped that check.

import 'server-only';
import { MercadoPagoConfig, Payment, PreApproval, Order } from 'mercadopago';
// Reading a failed call's body is its own concern, and has no business
// importing the SDK; see mp-error.ts for the shapes it has to cope with.
export { describeMpError, mpErrorForLog } from './mp-error';
import { appUrl } from '@/lib/app-url';
import {
  MP_ACCESS_TOKEN_VAR,
  checkoutNotReadyMessage,
  checkoutConfigProblems,
  missingCheckoutConfig,
  readAccessToken,
  readPublicKey,
  readWebhookSecret,
} from './mp-config';

let cached: {
  config: MercadoPagoConfig;
  /** Payments API, read-only here (the `payment` webhook topic). */
  payment: Payment;
  /** Subscriptions (the /preapproval API): one per paying Pro/VIP user. */
  preapproval: PreApproval;
  /** Orders API (/v1/orders): Checkout Pro via Orders, used for token packs. */
  order: Order;
} | null = null;

function getAccessToken(): string | undefined {
  return readAccessToken(process.env);
}

export function getWebhookSecret(): string | undefined {
  return readWebhookSecret(process.env);
}

/** The Bricks public key. Not a secret: it initialises the card form in the
 *  browser, so a server page may pass it down to a client component. */
export function getPublicKey(): string | undefined {
  return readPublicKey(process.env);
}

/** The access token is present. Enough to READ from Mercado Pago (the webhook
 *  fetching a payment, the admin diagnostic); not enough to start a checkout —
 *  see `isCheckoutReady`. */
export function isMercadoPagoConfigured(): boolean {
  return Boolean(getAccessToken());
}

/** Canonical names of the variables a checkout still needs. Empty = ready. */
export function missingCheckoutVars(): string[] {
  return missingCheckoutConfig(process.env);
}

/** Set-but-wrong credentials (swapped, or test paired with production).
 *  Names, never values. Empty = nothing obviously wrong. */
export function checkoutConfigWarnings(): string[] {
  return checkoutConfigProblems(process.env);
}

/** Everything a checkout needs to both start AND be credited afterwards. */
export function isCheckoutReady(): boolean {
  return missingCheckoutVars().length === 0;
}

/** The message a caller returns instead of starting a checkout. */
export function checkoutNotReadyError(): string {
  return checkoutNotReadyMessage(missingCheckoutVars());
}

export function getMercadoPago() {
  if (cached) return cached;
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      `${MP_ACCESS_TOKEN_VAR} missing — Mercado Pago checkout disabled. Set it in .env.local to enable real payments.`,
    );
  }
  const config = new MercadoPagoConfig({
    accessToken: token,
    // Idempotency key per-request is set by the SDK on each call.
    //
    // Timeout note: 7s gives the SDK a clear cap that beats Vercel's
    // 10s serverless function timeout (Hobby plan). When MP is slow or
    // the token is invalid the SDK should error out cleanly inside our
    // action's try/catch, so we return a useful { ok: false, error }
    // to the client instead of letting Vercel kill the function and
    // serve its generic "page couldn't load" 500.
    options: { timeout: 7000 },
  });
  cached = {
    config,
    payment: new Payment(config),
    preapproval: new PreApproval(config),
    order: new Order(config),
  };
  return cached;
}

/** Same cap as the SDK client above, for the calls that go around it. */
const MP_FETCH_TIMEOUT_MS = 7000;

/**
 * A GET against the Mercado Pago REST API for the resources the SDK has no
 * client for — today that is /authorized_payments/{id}, the recurring charge
 * of a subscription. Same token, same timeout as the SDK; throws with the
 * status code on anything but 2xx so the webhook can decide whether to let
 * Mercado Pago retry.
 */
export async function mpGet<T>(path: string): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error(`${MP_ACCESS_TOKEN_VAR} missing — cannot call Mercado Pago ${path}.`);
  }
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(MP_FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) {
    const excerpt = (await res.text().catch(() => '')).slice(0, 300);
    throw new Error(`Mercado Pago GET ${path} → ${res.status}: ${excerpt}`);
  }
  return (await res.json()) as T;
}

/** Absolute origin for the preapproval's back_url and the hosted order's
 *  return URLs. Thin alias over appUrl() so payment callers keep their
 *  familiar name while there is exactly one place that reads the
 *  environment. Falls back to localhost in dev (Mercado Pago cannot call the
 *  webhook there — use a tunnel for that). */
export function getAppUrl(): string {
  return appUrl();
}
