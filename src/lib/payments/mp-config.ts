// Which Mercado Pago environment variables a real checkout needs, and which of
// them are missing. Pure and env-injected so it can be unit-tested without the
// SDK; `mercadopago.ts` is the only runtime caller.
//
// The names are the ones in .env.local.example. `MP_ACCESS_TOKEN` and
// `MP_WEBHOOK_SECRET` are accepted as legacy aliases so an older Vercel setup
// keeps working, but every message names the canonical variable.

export const MP_ACCESS_TOKEN_VAR = 'MERCADOPAGO_ACCESS_TOKEN';
export const MP_WEBHOOK_SECRET_VAR = 'MERCADOPAGO_WEBHOOK_SECRET';
/** Only needed for embedded (Bricks) checkout, which the hub does not use. */
export const MP_PUBLIC_KEY_VAR = 'MERCADOPAGO_PUBLIC_KEY';

type Env = Record<string, string | undefined>;

export function readAccessToken(env: Env): string | undefined {
  return env[MP_ACCESS_TOKEN_VAR] || env.MP_ACCESS_TOKEN || undefined;
}

export function readWebhookSecret(env: Env): string | undefined {
  return env[MP_WEBHOOK_SECRET_VAR] || env.MP_WEBHOOK_SECRET || undefined;
}

/**
 * Variables a checkout cannot safely start without, by canonical name.
 *
 * The access token is obvious. The webhook secret is on the list because
 * /api/mp/webhook fails closed without it: Mercado Pago would take the money
 * and the tier or token pack would never be credited. Starting a checkout in
 * that state is exactly the half-configured failure we refuse to fail open into.
 */
export function missingCheckoutConfig(env: Env): string[] {
  const missing: string[] = [];
  if (!readAccessToken(env)) missing.push(MP_ACCESS_TOKEN_VAR);
  if (!readWebhookSecret(env)) missing.push(MP_WEBHOOK_SECRET_VAR);
  return missing;
}

/** Operator-facing sentence naming what to set and where. */
export function checkoutNotReadyMessage(missing: string[]): string {
  const list = missing.join(' y ');
  return (
    `Los pagos con Mercado Pago todavía no están activos: falta ${list} en Vercel ` +
    `(los mismos nombres que en .env.local.example). Un admin puede activar tu plan directo.`
  );
}
