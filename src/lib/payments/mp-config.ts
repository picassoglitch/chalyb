// Which Mercado Pago environment variables a real checkout needs, and which of
// them are missing. Pure and env-injected so it can be unit-tested without the
// SDK; `mercadopago.ts` is the only runtime caller.
//
// The names are the ones in .env.local.example. `MP_ACCESS_TOKEN` and
// `MP_WEBHOOK_SECRET` are accepted as legacy aliases so an older Vercel setup
// keeps working, but every message names the canonical variable.

export const MP_ACCESS_TOKEN_VAR = 'MERCADOPAGO_ACCESS_TOKEN';
export const MP_WEBHOOK_SECRET_VAR = 'MERCADOPAGO_WEBHOOK_SECRET';
/** The Bricks (embedded card form) public key. Ships to the browser. */
export const MP_PUBLIC_KEY_VAR = 'MERCADOPAGO_PUBLIC_KEY';

type Env = Record<string, string | undefined>;

export function readAccessToken(env: Env): string | undefined {
  return env[MP_ACCESS_TOKEN_VAR] || env.MP_ACCESS_TOKEN || undefined;
}

export function readWebhookSecret(env: Env): string | undefined {
  return env[MP_WEBHOOK_SECRET_VAR] || env.MP_WEBHOOK_SECRET || undefined;
}

export function readPublicKey(env: Env): string | undefined {
  return env[MP_PUBLIC_KEY_VAR] || env.MP_PUBLIC_KEY || undefined;
}

/**
 * Variables a checkout cannot safely start without, by canonical name.
 *
 * The access token is obvious. The public key is what the card form in the
 * browser (Checkout Bricks) initialises with; without it there is no form to
 * pay in. The webhook secret is on the list because /api/mp/webhook fails
 * closed without it: Mercado Pago would take the money and the tier or token
 * pack would never be credited. Starting a checkout in that state is exactly
 * the half-configured failure we refuse to fail open into.
 */
export function missingCheckoutConfig(env: Env): string[] {
  const missing: string[] = [];
  if (!readAccessToken(env)) missing.push(MP_ACCESS_TOKEN_VAR);
  if (!readPublicKey(env)) missing.push(MP_PUBLIC_KEY_VAR);
  if (!readWebhookSecret(env)) missing.push(MP_WEBHOOK_SECRET_VAR);
  return missing;
}

/** Operator-facing sentence naming what to set and where. */
export function checkoutNotReadyMessage(missing: string[]): string {
  const list =
    missing.length > 1
      ? `${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}`
      : (missing[0] ?? '');
  return (
    `Los pagos con Mercado Pago todavía no están activos: falta ${list} en Vercel ` +
    `(los mismos nombres que en .env.local.example). Un admin puede activar tu plan directo.`
  );
}

/**
 * Mistakes that leave every variable SET but the card form dead: the public
 * key slot holding the access token (or the reverse), or a test key paired
 * with a production token. Mercado Pago's Brick then never reports ready.
 * Pure, so the checkout pages and /api/_diag/mp can name the mistake
 * without touching the SDK. Empty = nothing obviously wrong.
 */
export function checkoutConfigProblems(env: Env): string[] {
  const problems: string[] = [];
  const token = readAccessToken(env)?.trim();
  const publicKey = readPublicKey(env)?.trim();
  if (!token || !publicKey) return problems;

  // A public key is "<PREFIX>-<uuid>"; an access token is
  // "<PREFIX>-<digits>-<digits>-<hex>-<digits>".
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const prefixOf = (v: string) =>
    v.startsWith('TEST-') ? 'TEST' : v.startsWith('APP_USR-') ? 'APP_USR' : null;
  const body = (v: string) => v.replace(/^(TEST|APP_USR)-/, '');

  const pkPrefix = prefixOf(publicKey);
  const tokPrefix = prefixOf(token);
  if (!pkPrefix) {
    problems.push(
      `${MP_PUBLIC_KEY_VAR} no empieza con APP_USR- ni TEST-; no parece una Public Key de Mercado Pago`,
    );
  } else if (!uuid.test(body(publicKey))) {
    problems.push(
      /^\d{5,}-/.test(body(publicKey))
        ? `${MP_PUBLIC_KEY_VAR} contiene un Access Token, no la Public Key (la Public Key es el otro valor del mismo panel de credenciales)`
        : `${MP_PUBLIC_KEY_VAR} no tiene la forma de una Public Key (PREFIJO-uuid)`,
    );
  }
  if (tokPrefix && uuid.test(body(token))) {
    problems.push(`${MP_ACCESS_TOKEN_VAR} contiene una Public Key, no el Access Token`);
  }
  if (pkPrefix && tokPrefix && pkPrefix !== tokPrefix) {
    problems.push(
      `${MP_PUBLIC_KEY_VAR} es ${pkPrefix} pero ${MP_ACCESS_TOKEN_VAR} es ${tokPrefix}: las dos credenciales deben venir del mismo panel (ambas de prueba o ambas de producción)`,
    );
  }
  return problems;
}
