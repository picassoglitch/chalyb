// The Bearer token the hub's SERVER sends to an engine's /api/hub/v1 API
// (BRIEF: engines into the hub). Same format as the SSO launch token
// (factory.ts signLaunchToken: base64url JSON body + "." + HMAC-SHA256 with
// <SLUG>_SSO_SECRET), plus `aud: "<slug>-hub-api"` so the engine can tell
// the two apart: a launch token travels in a URL and is refused by the API;
// this token is refused by the engine's /auth/sso.
//
// Minted per request with a short lifetime. Never sent to a browser.

import 'server-only';
import { createHmac } from 'node:crypto';

export const HUB_API_TOKEN_TTL_SECONDS = 120;

export interface HubApiPrincipal {
  userId: string;
  email?: string;
  tier?: string;
  tenantId?: string;
}

export function hubApiAudience(slug: string): string {
  return `${slug}-hub-api`;
}

/** Throws when <SLUG>_SSO_SECRET is missing (the caller's call fails closed). */
export function signHubApiToken(
  slug: string,
  who: HubApiPrincipal,
  nowMs: number = Date.now(),
  ttlSeconds: number = HUB_API_TOKEN_TTL_SECONDS,
): string {
  const secret = process.env[`${slug.toUpperCase()}_SSO_SECRET`];
  if (!secret) throw new Error(`${slug.toUpperCase()}_SSO_SECRET not configured`);
  const payload = {
    user_id: who.userId,
    email: who.email ?? '',
    tenant_id: who.tenantId ?? '',
    tier: who.tier ?? '',
    exp: Math.floor(nowMs / 1000) + ttlSeconds,
    aud: hubApiAudience(slug),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
