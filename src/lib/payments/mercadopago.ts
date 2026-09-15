// Mercado Pago SDK wrapper — server-side only.
//
// CONFIGURATION:
// Set the following env vars in .env.local (and Vercel for prod):
//   MERCADOPAGO_ACCESS_TOKEN   — your MP private access token. TEST-* for
//                                sandbox, APP_USR-* for production. Get from
//                                https://www.mercadopago.com/developers/panel/credentials
//   MERCADOPAGO_WEBHOOK_SECRET (optional but recommended) — the secret MP
//                                signs the webhook x-signature header with.
//                                Set the same value in your MP dashboard under
//                                "Notificaciones IPN/Webhooks".
//   MERCADOPAGO_PUBLIC_KEY    (optional) — only needed if/when we switch from
//                                redirect-based checkout to embedded MP Bricks.
//                                Currently unused — safe to leave set.
//   NEXT_PUBLIC_APP_URL        — the publicly reachable origin (https://chalyb.com
//                                or http://localhost:3000 for local). Used in
//                                back_urls and notification_url on the preference.
//                                Read through src/lib/app-url.ts, which is the
//                                one reader for this value across the app.
//
// LEGACY ALIAS: `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` are still read as
// fallbacks so an older Vercel setup keeps working. Every message names the
// canonical MERCADOPAGO_* variable. The lookup lives in ./mp-config.ts.
//
// NOT-CONFIGURED FALLBACK:
// The checkout actions ask `isCheckoutReady()` BEFORE touching the SDK and
// return a clear { ok: false, reason: 'not_configured' } naming the missing
// variables, so nothing is created on the Mercado Pago side. `getMercadoPago()`
// throwing is the backstop for a caller that skipped that check.

import 'server-only';
import { MercadoPagoConfig, Preference, Payment, PreApproval, Order } from 'mercadopago';
import { appUrl } from '@/lib/app-url';
import {
  MP_ACCESS_TOKEN_VAR,
  checkoutNotReadyMessage,
  missingCheckoutConfig,
  readAccessToken,
  readWebhookSecret,
} from './mp-config';

let cached: {
  config: MercadoPagoConfig;
  preference: Preference;
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
    preference: new Preference(config),
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

/** Absolute origin for back_urls / notification_url.
 *  Thin alias over appUrl() so payment callers keep their familiar name while
 *  there is exactly one place that reads the environment. Falls back to
 *  localhost for dev so the dev workflow still creates valid preferences
 *  (though the webhook won't actually fire — use ngrok for that). */
export function getAppUrl(): string {
  return appUrl();
}
