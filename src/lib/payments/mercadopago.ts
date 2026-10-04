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
//   mpGet        Raw GET for resources the SDK has no client for (/authorized_payments)
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
import {
  CardToken,
  Chargeback,
  MercadoPagoConfig,
  MerchantOrder,
  Order,
  Payment,
  PaymentRefund,
  PreApproval,
  User,
} from 'mercadopago';
import { appUrl } from '@/lib/app-url';
import {
  MP_ACCESS_TOKEN_VAR,
  checkoutNotReadyMessage,
  isAllowedMpUrl,
  missingCheckoutConfig,
  mpCredentials,
  mpEnvProblems,
  mpErrorCode,
  readAccessToken,
  mpUrl,
  mpWebhookUrl,
  payerEmailFor,
  type MpEnv,
} from './mp-config';

let cached: {
  config: MercadoPagoConfig;
  /** Payments API, read-only here (the `payment` webhook topic). */
  payment: Payment;
  /** Subscriptions (the /preapproval API): one per paying Pro/VIP user. */
  preapproval: PreApproval;
  /** Orders API (/v1/orders): Checkout Pro via Orders, used for token packs. */
  order: Order;
  refund: PaymentRefund;
  /** Merchant orders (the merchant_order webhook topic), read-only. */
  merchantOrder: MerchantOrder;
  /** Card tokens, read-only: the card details shown after a card update. */
  cardToken: CardToken;
  /** The account the access token belongs to (/users/me). */
  user: User;
  /** Chargebacks (the chargebacks webhook topic), read-only. */
  chargeback: Chargeback;
} | null = null;

// Every credential below comes out of mpCredentials() (mp-config.ts), the
// only reader of the MERCADOPAGO_* / MP_* variables, so the token, the card
// form's public key and the webhook secret always belong to one environment.

/** 'prod' or 'test' (MP_ENV; Vercel Production defaults to prod). */
export function getMpEnv(): MpEnv {
  return mpCredentials(process.env).mpEnv;
}

function getAccessToken(): string | undefined {
  return mpCredentials(process.env).accessToken;
}

export function getWebhookSecret(): string | undefined {
  return mpCredentials(process.env).webhookSecret;
}

/** The Bricks public key. Not a secret: it initialises the card form in the
 *  browser, so a server page may pass it down to a client component. */
export function getPublicKey(): string | undefined {
  return mpCredentials(process.env).publicKey;
}

/** The seller the access token must belong to (MP_EXPECTED_SELLER_ID). */
export function getExpectedSellerId(): string | undefined {
  return mpCredentials(process.env).expectedSellerId;
}

/** The access token exactly as configured (untrimmed), for /api/diag/mp to
 *  spot stray whitespace. Everything else uses the trimmed one. */
export function getRawAccessTokenForDiag(): string {
  return readAccessToken(process.env) ?? '';
}

let sellerCheck: { token: string; ok: boolean } | null = null;

/**
 * When MP_EXPECTED_SELLER_ID is set, the access token must belong to that
 * seller (GET /users/me, cached per token). A token from another account —
 * the other half of a mixed pair — fails closed. Unset = no check.
 */
export async function sellerMatches(): Promise<boolean> {
  const expected = getExpectedSellerId();
  const token = getAccessToken();
  if (!expected || !token) return true;
  if (sellerCheck?.token === token) return sellerCheck.ok;
  try {
    const me = await getMercadoPago().user.get();
    const ok = String(me.id ?? '') === expected;
    if (!ok) console.error('[mp] access token belongs to another seller', { mp_env: getMpEnv() });
    sellerCheck = { token, ok };
    return ok;
  } catch (err) {
    // Not cached: a blip at Mercado Pago must not lock checkout out for good.
    console.error('[mp] could not verify the seller of the access token', err);
    return false;
  }
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

/** Set-but-wrong credentials (swapped, test paired with production, a
 *  production deployment on test keys, a test deployment with no test
 *  buyer). Names, never values. Empty = nothing obviously wrong. */
export function checkoutConfigWarnings(): string[] {
  return mpEnvProblems(process.env);
}

/** Everything a checkout needs to both start AND be credited afterwards, in
 *  ONE environment. A mixed pair fails closed: nothing is created. */
export function isCheckoutReady(): boolean {
  return missingCheckoutVars().length === 0 && checkoutConfigWarnings().length === 0;
}

/** The message a caller returns instead of starting a checkout. Missing
 *  variables are named for the operator; a mixed or wrong pair gets the
 *  generic payment error (the reason goes to the log). */
export function checkoutNotReadyError(): string {
  const missing = missingCheckoutVars();
  if (missing.length) return checkoutNotReadyMessage(missing);
  console.error('[mp] checkout refused, credentials inconsistent:', checkoutConfigWarnings());
  return MP_GENERIC_ERROR;
}

/** The generic payment error customers see when we refuse on our side. */
export const MP_GENERIC_ERROR =
  'No pudimos iniciar el pago en este momento. No se hizo ningún cargo; inténtalo de nuevo más tarde.';

/** The payer email for a create call (test buyer in `test`, the user in
 *  `prod`). null = refuse to create anything. */
export function mpPayerEmail(userEmail: string | null | undefined): string | null {
  return payerEmailFor(userEmail, process.env);
}

/**
 * Absolute URL for a back_url / return URL on a payment object. Throws in
 * `prod` if it would not be https://www.chalyb.com/… — Mercado Pago follows
 * no redirects, and the caller's try/catch turns the throw into the
 * generic error before anything is created.
 */
export function mpReturnUrl(path: string): string {
  const url = mpUrl(path, process.env, appUrl());
  if (!isAllowedMpUrl(url, process.env)) {
    throw new Error(`[mp] refusing a non-canonical return URL in ${getMpEnv()}`);
  }
  return url;
}

/** Where the Mercado Pago dashboard must send notifications (OPS-4). The
 *  preapproval and Orders APIs take no per-object notification_url, so this
 *  is shown by /api/diag/mp for the operator to compare. */
export function mpExpectedWebhookUrl(): string {
  return mpWebhookUrl(process.env, appUrl());
}

/** The Mercado Pago error code of a failed call, for logs only. */
export function mpErrorCodeOf(err: unknown): string | null {
  return mpErrorCode(err);
}

/** One log line per object created at Mercado Pago: the environment, the
 *  MP id and our reference. Never tokens, card data or emails. */
export function logMpCreate(
  kind: string,
  fields: { id?: string | null; externalReference?: string | null },
) {
  console.info('[mp] created', {
    kind,
    mp_env: getMpEnv(),
    mp_id: fields.id ?? null,
    external_reference: fields.externalReference ?? null,
  });
}

export function getMercadoPago() {
  if (cached) return cached;
  cached = buildClients();
  return cached;
}

/**
 * Clients on a config of their own, for a call that passes `requestOptions`
 * (an idempotency key above all). SDK 3.6 merges a call's requestOptions
 * into its client's config for good (`this.config.options = {…}`), so on
 * the shared cached config one call's key would be sent by every later call
 * of this instance — and Mercado Pago would answer them with the first
 * call's response.
 */
export function getMercadoPagoIsolated() {
  return buildClients();
}

function buildClients() {
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
  return {
    config,
    payment: new Payment(config),
    preapproval: new PreApproval(config),
    order: new Order(config),
    refund: new PaymentRefund(config),
    merchantOrder: new MerchantOrder(config),
    cardToken: new CardToken(config),
    user: new User(config),
    chargeback: new Chargeback(config),
  };
}

/** Same cap as the SDK client above, for the calls that go around it. */
const MP_FETCH_TIMEOUT_MS = 7000;

/**
 * A GET against the Mercado Pago REST API for the resources the SDK has no
 * client for — today that is /authorized_payments/{id}, the recurring charge
 * of a subscription. Everything the SDK covers goes through it, so Mercado
 * Pago sees the SDK on those calls. Same token, same timeout as the SDK; throws with the
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
    throw Object.assign(new Error(`Mercado Pago GET ${path} → ${res.status}: ${excerpt}`), {
      status: res.status,
    });
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

/**
 * A sentence for the operator out of whatever the SDK threw.
 *
 * The SDK answers a non-2xx by parsing the error body as JSON. When Mercado
 * Pago's gateway rejects the credential it often answers 401/403 with an
 * EMPTY body, so what surfaces is node-fetch's "invalid json response body …
 * Unexpected end of JSON input" and the real status is lost. That shape is
 * a credential problem until proven otherwise; say so, and point at the
 * diagnostic that shows the actual HTTP status.
 */
export function describeMpError(err: unknown): string {
  const e = err as {
    message?: string;
    type?: string;
    cause?: { error?: { message?: string }; message?: string };
  };
  const detail = e?.cause?.error?.message || e?.cause?.message || e?.message || 'sin detalle';
  if (e?.type === 'invalid-json' || /invalid json response body/i.test(detail)) {
    return (
      'Mercado Pago respondió sin cuerpo, que es lo que hace cuando rechaza la credencial. ' +
      `Revisa que ${MP_ACCESS_TOKEN_VAR} en Vercel sea el Access Token vigente (si lo regeneraste ` +
      'en el panel, el anterior dejó de servir) y sin espacios ni comillas. /api/diag/mp muestra ' +
      'el código HTTP real.'
    );
  }
  return detail;
}
