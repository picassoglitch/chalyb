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
 * Pure, so the checkout pages and /api/diag/mp can name the mistake
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
  const body = (v: string) => v.replace(/^(TEST|APP_USR)-/, '');

  const pkPrefix = mpCredentialPrefix(publicKey);
  const tokPrefix = mpCredentialPrefix(token);
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

// ── Which Mercado Pago environment this deployment talks to (B33) ──────────
//
// Mercado Pago refuses a payment where the seller side (the access token that
// created the preapproval, the public key that tokenised the card) and the
// buyer side (payer_email, the card) belong to different environments: "Una
// de las partes con la que intentas hacer el pago es de prueba". So the
// deployment names its environment once, in MP_ENV, and everything that talks
// to Mercado Pago (server client, card form, webhook secret, payer email)
// follows it. Production on Vercel defaults to `prod`; every other deployment
// (previews, local) defaults to `test`. Defaulting to `test` is not enough
// on its own: a preview that inherited live APP_USR- keys would still charge.
// Test mode therefore also refuses APP_USR- (unless an explicit test-seller
// opt-in), refuses Vercel Production, refuses `prod` on a preview, and
// refuses to write until MP_TEST_DATA_ISOLATED attests a non-production
// database.

export type MpEnv = 'test' | 'prod';
export const MP_ENV_VAR = 'MP_ENV';
export const MP_TEST_PAYER_EMAIL_VAR = 'MP_TEST_PAYER_EMAIL';
export const MP_EXPECTED_SELLER_ID_VAR = 'MP_EXPECTED_SELLER_ID';
/** Opt-in: a test seller whose credentials are APP_USR- (newer MP test apps).
 *  Never set on Vercel Production. Requires MP_EXPECTED_SELLER_ID as well. */
export const MP_TEST_ALLOW_APP_USR_VAR = 'MP_TEST_ALLOW_APP_USR';
/** Operator attestation that NEXT_PUBLIC_SUPABASE_URL is not production.
 *  Required when MP_ENV=test. Never set on Vercel Production. */
export const MP_TEST_DATA_ISOLATED_VAR = 'MP_TEST_DATA_ISOLATED';

function envFlag(env: Env, name: string): boolean {
  const s = env[name]?.trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

/** TEST | APP_USR | null. Prefix only — newer test sellers can be APP_USR-. */
export function mpCredentialPrefix(value: string): 'TEST' | 'APP_USR' | null {
  if (value.startsWith('TEST-')) return 'TEST';
  if (value.startsWith('APP_USR-')) return 'APP_USR';
  return null;
}

export function getMpEnv(env: Env): MpEnv {
  const explicit = env[MP_ENV_VAR]?.trim().toLowerCase();
  if (explicit === 'test' || explicit === 'prod') return explicit;
  return env.VERCEL_ENV === 'production' ? 'prod' : 'test';
}

export interface MpCredentials {
  mpEnv: MpEnv;
  accessToken: string | undefined;
  publicKey: string | undefined;
  webhookSecret: string | undefined;
  /** Seller id the access token must belong to, when configured. */
  expectedSellerId: string | undefined;
}

/** Every Mercado Pago credential, read in one place, for one environment. */
export function mpCredentials(env: Env): MpCredentials {
  return {
    mpEnv: getMpEnv(env),
    accessToken: readAccessToken(env)?.trim() || undefined,
    publicKey: readPublicKey(env)?.trim() || undefined,
    webhookSecret: readWebhookSecret(env)?.trim() || undefined,
    expectedSellerId: env[MP_EXPECTED_SELLER_ID_VAR]?.trim() || undefined,
  };
}

/**
 * Everything that would make a checkout fail at Mercado Pago (or charge the
 * wrong side) although every variable is set: the shape problems above, plus
 * the environment rules. Operator-facing, names only. Empty = consistent.
 */
export function mpEnvProblems(env: Env): string[] {
  const problems = checkoutConfigProblems(env);
  const { mpEnv, accessToken, publicKey, expectedSellerId } = mpCredentials(env);
  const vercelEnv = env.VERCEL_ENV?.trim();

  if (mpEnv === 'prod') {
    if (vercelEnv && vercelEnv !== 'production') {
      problems.push(
        `${MP_ENV_VAR}=prod solo se admite en Vercel Production; un preview no puede cobrar con credenciales de producción`,
      );
    }
    for (const [name, value] of [
      [MP_ACCESS_TOKEN_VAR, accessToken],
      [MP_PUBLIC_KEY_VAR, publicKey],
    ] as const) {
      if (value && !value.startsWith('APP_USR-')) {
        problems.push(
          `${MP_ENV_VAR}=prod pero ${name} no es una credencial de producción (APP_USR-)`,
        );
      }
    }
    return problems;
  }

  if (vercelEnv === 'production') {
    problems.push(
      `${MP_ENV_VAR}=test no se admite en Vercel Production: se cobraría o se escribiría en datos de producción`,
    );
  }
  const payer = env[MP_TEST_PAYER_EMAIL_VAR]?.trim();
  if (!payer) {
    problems.push(
      `${MP_ENV_VAR}=test necesita ${MP_TEST_PAYER_EMAIL_VAR} (el correo del comprador de prueba)`,
    );
  } else if (!isMpTestPayerEmail(payer)) {
    problems.push(
      `${MP_TEST_PAYER_EMAIL_VAR} debe ser un comprador de prueba de Mercado Pago (@testuser.com)`,
    );
  }
  const allowAppUsr = envFlag(env, MP_TEST_ALLOW_APP_USR_VAR);
  for (const [name, value] of [
    [MP_ACCESS_TOKEN_VAR, accessToken],
    [MP_PUBLIC_KEY_VAR, publicKey],
  ] as const) {
    if (!value) continue;
    const prefix = mpCredentialPrefix(value);
    if (prefix === 'TEST') continue;
    if (prefix === 'APP_USR' && allowAppUsr && expectedSellerId) continue;
    problems.push(
      prefix === 'APP_USR'
        ? `${MP_ENV_VAR}=test y ${name} es APP_USR-: hace falta ${MP_TEST_ALLOW_APP_USR_VAR}=1 y ${MP_EXPECTED_SELLER_ID_VAR} (vendedor de prueba). Sin eso se rechaza, no sea una credencial de producción`
        : `${MP_ENV_VAR}=test pero ${name} no empieza con TEST-`,
    );
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    problems.push(
      `${MP_ENV_VAR}=test necesita NEXT_PUBLIC_SUPABASE_URL de un proyecto aislado, no el de producción`,
    );
  }
  if (!envFlag(env, MP_TEST_DATA_ISOLATED_VAR)) {
    problems.push(
      `${MP_ENV_VAR}=test necesita ${MP_TEST_DATA_ISOLATED_VAR}=1 solo cuando la base, el auth y el webhook no son los de producción`,
    );
  }
  return problems;
}

/** Whether the webhook may fetch from Mercado Pago and write entitlements.
 *  Missing token: not configured. Mixed/live credentials or shared production
 *  data in test: inconsistent — fail closed, grant nothing. */
export function mpWebhookAdmitted(
  env: Env,
): { ok: true } | { ok: false; reason: 'not_configured' | 'inconsistent' } {
  if (!readAccessToken(env)?.trim()) return { ok: false, reason: 'not_configured' };
  if (mpEnvProblems(env).length > 0) return { ok: false, reason: 'inconsistent' };
  return { ok: true };
}

/** Mercado Pago's test buyers live on this domain. */
const TEST_BUYER_DOMAIN = /@testuser\.com$/i;

export function isMpTestPayerEmail(email: string | null | undefined): boolean {
  return Boolean(email?.trim() && TEST_BUYER_DOMAIN.test(email.trim()));
}

/**
 * The payer email sent to Mercado Pago. In `test` it is the test buyer
 * (MP_TEST_PAYER_EMAIL), never the user's real address; in `prod` it is the
 * user's own email, and a test-buyer address is refused. null = don't create
 * anything (fail closed).
 */
export function payerEmailFor(userEmail: string | null | undefined, env: Env): string | null {
  if (getMpEnv(env) === 'test') {
    const email = env[MP_TEST_PAYER_EMAIL_VAR]?.trim() || null;
    return isMpTestPayerEmail(email) ? email : null;
  }
  const email = userEmail?.trim();
  if (!email || isMpTestPayerEmail(email)) return null;
  return email;
}

// ── URLs we hand to Mercado Pago (B35) ─────────────────────────────────────

/** The production host. Non-www 308s here, and Mercado Pago does not follow
 *  redirects, so anything it calls or sends the buyer to must already be it. */
export const MP_PROD_ORIGIN = 'https://www.chalyb.com';
export const MP_WEBHOOK_PATH = '/api/mp/webhook';

/**
 * Absolute URL for a path on this deployment, for a back_url / return URL.
 * `prod` always uses the production host; `test` uses the deployment's own
 * origin so a preview's buyer comes back to the preview.
 */
export function mpUrl(path: string, env: Env, deploymentOrigin: string): string {
  const origin = getMpEnv(env) === 'prod' ? MP_PROD_ORIGIN : deploymentOrigin.replace(/\/+$/, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The URL the Mercado Pago dashboard must notify (OPS-4). */
export function mpWebhookUrl(env: Env, deploymentOrigin: string): string {
  return mpUrl(MP_WEBHOOK_PATH, env, deploymentOrigin);
}

/** Guard for every URL put on a payment object: in `prod` only the
 *  production host over HTTPS. */
export function isAllowedMpUrl(url: string, env: Env): boolean {
  if (getMpEnv(env) !== 'prod') return /^https?:\/\//.test(url);
  return url === MP_PROD_ORIGIN || url.startsWith(`${MP_PROD_ORIGIN}/`);
}

// ── Mercado Pago errors (B36) ──────────────────────────────────────────────

/**
 * The machine code out of whatever the SDK threw or MP answered, for logs:
 * e.g. "CC_VAL_433" from "CC_VAL_433 Credit card validation has failed", or
 * a `cause[].code`. null when there is none. Never shown to a customer.
 */
export function mpErrorCode(err: unknown): string | null {
  const e = err as {
    message?: string;
    code?: string | number;
    cause?: unknown;
    error?: string;
  } | null;
  if (!e) return null;
  const causes = Array.isArray(e.cause)
    ? e.cause
    : e.cause && typeof e.cause === 'object'
      ? [e.cause]
      : [];
  for (const c of causes as { code?: string | number; description?: string }[]) {
    if (c?.code !== undefined && c.code !== null && String(c.code).trim()) return String(c.code);
  }
  if (e.code !== undefined && e.code !== null && String(e.code).trim()) return String(e.code);
  const text = [e.message, e.error].filter(Boolean).join(' ');
  const m = /\b([A-Z]{2,}(?:_[A-Z0-9]+)+|cc_rejected_[a-z_]+)\b/.exec(text);
  return m?.[1] ?? null;
}

/** Card-side failures (validation, rejections, card-token field errors):
 *  the customer can fix them with other card details or another card. */
const CARD_ERROR_CODE =
  /^(?:CC_VAL_\w+|cc_rejected_\w+|E30[12]|E203|20[589]|21[234]|22[014]|316|32[2-6])$/i;

export function isCardErrorCode(code: string | null): boolean {
  return Boolean(code && CARD_ERROR_CODE.test(code));
}
