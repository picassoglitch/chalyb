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
//
// LEGACY ALIAS: We also accept `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` as
// fallbacks so this works with either naming convention.
//
// DEMO-MODE FALLBACK:
// If no access token is set, `getMercadoPago()` throws. Callers (the checkout
// server action) catch this and return a graceful error so the admin-direct
// path keeps working without MP configured.

import 'server-only';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

let cached: { config: MercadoPagoConfig; preference: Preference; payment: Payment } | null = null;

function getAccessToken(): string | undefined {
  return process.env.MERCADOPAGO_ACCESS_TOKEN ?? process.env.MP_ACCESS_TOKEN;
}

export function getWebhookSecret(): string | undefined {
  return process.env.MERCADOPAGO_WEBHOOK_SECRET ?? process.env.MP_WEBHOOK_SECRET;
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(getAccessToken());
}

export function getMercadoPago() {
  if (cached) return cached;
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN missing — Mercado Pago checkout disabled. Set it in .env.local to enable real payments.',
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
  };
  return cached;
}

/** Build the absolute origin for back_urls / notification_url.
 *  Falls back to localhost for dev so the dev workflow still creates valid
 *  preferences (though the webhook won't actually fire — use ngrok for that). */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
