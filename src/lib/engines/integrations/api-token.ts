// Per-request bearer for the engines' hub APIs (TOOLS-SPEC §1, option B).
//
// The same HMAC-SHA256 launch token factory.ts signs for /auth/sso
// ({user_id, email, tenant_id, tier, exp}, secret <SLUG>_SSO_SECRET), with a
// short TTL: the hub server mints a fresh one for every engine call and sends
// it as `Authorization: Bearer <token>`. The engine verifies it exactly like
// /auth/sso and derives the user/tenant from it. Never sent to a browser.

import { createHmac } from 'node:crypto';

/** Long enough for one request (with retries), short enough that a leaked
 *  token is useless almost at once. */
export const ENGINE_API_TOKEN_TTL_SECONDS = 120;

export interface EngineApiClaims {
  /** Chalyb user id. */
  user_id: string;
  email: string;
  /** The engine's tenant id (engine_subscriptions.external_user_id). */
  tenant_id: string;
  /** Lowercase effective tier ('free' | 'pro' | 'partner' | 'vip'). */
  tier: string;
}

export class EngineTokenConfigError extends Error {
  readonly code = 'ENGINE_NOT_CONFIGURED';
}

/** Sign claims for `slug`'s engine. Throws EngineTokenConfigError when
 *  <SLUG>_SSO_SECRET is missing. `nowMs` is injectable for tests. */
export function mintEngineApiToken(
  slug: string,
  claims: EngineApiClaims,
  opts: { ttlSeconds?: number; nowMs?: number; secret?: string } = {},
): string {
  const secretVar = `${slug.toUpperCase()}_SSO_SECRET`;
  const secret = opts.secret ?? process.env[secretVar];
  if (!secret) throw new EngineTokenConfigError(`${secretVar} not configured`);
  const exp =
    Math.floor((opts.nowMs ?? Date.now()) / 1000) +
    (opts.ttlSeconds ?? ENGINE_API_TOKEN_TTL_SECONDS);
  const payload = {
    user_id: claims.user_id,
    email: claims.email,
    tenant_id: claims.tenant_id,
    tier: claims.tier,
    exp,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
