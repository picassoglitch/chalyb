// The hub → En vivo engine credential (TOOLS-SPEC §1.2, BRIEF "Architecture").
//
// Same wire format as the SSO launch token the engine already verifies
// (factory.ts signLaunchToken): base64url(JSON) "." base64url(HMAC-SHA256),
// secret CHALYBOBS_SSO_SECRET. Two audiences keep the uses apart:
//   - API: minted per request on the server, 120 s, never leaves the server.
//   - PREVIEW: 30 min, rides in the browser's preview URL; the engine accepts
//     it ONLY for the HLS preview of that tenant (no key, no writes).
// A launch token (no `aud`) is refused by the API. Pure, unit-tested.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const API_AUD = 'chalybobs-hub-api';
export const PREVIEW_AUD = 'chalybobs-hub-preview';
export const API_TTL_S = 120;
export const PREVIEW_TTL_S = 1800;

export interface EngineClaims {
  user_id: string;
  email: string;
  tenant_id: string;
  tier: string;
  exp: number;
  aud: typeof API_AUD | typeof PREVIEW_AUD;
}

export function signEngineToken(claims: EngineClaims, secret: string): string {
  if (!secret) throw new Error('CHALYBOBS_SSO_SECRET not configured');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function mintEngineToken(
  who: { userId: string; email: string; tenantId: string; tier: string },
  aud: EngineClaims['aud'],
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): string {
  return signEngineToken(
    {
      user_id: who.userId,
      email: who.email,
      tenant_id: who.tenantId,
      tier: who.tier,
      exp: nowS + (aud === PREVIEW_AUD ? PREVIEW_TTL_S : API_TTL_S),
      aud,
    },
    secret,
  );
}

/** The hub's own check of a preview token before it proxies anything:
 *  signature, audience and expiry. Null on any failure. */
export function verifyEngineToken(
  token: string,
  aud: EngineClaims['aud'],
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
): EngineClaims | null {
  if (!secret || typeof token !== 'string' || token.length > 4096) return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1 || token.indexOf('.', dot + 1) !== -1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const want = createHmac('sha256', secret).update(body).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let claims: Partial<EngineClaims>;
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<EngineClaims>;
  } catch {
    return null;
  }
  if (claims.aud !== aud) return null;
  if (typeof claims.exp !== 'number' || claims.exp < nowS) return null;
  if (typeof claims.tenant_id !== 'string' || !claims.tenant_id) return null;
  if (typeof claims.user_id !== 'string' || !claims.user_id) return null;
  return claims as EngineClaims;
}

/** A preview path the proxy forwards: simple segment names only. */
export function safePreviewPath(parts: string[]): string | null {
  if (parts.length === 0 || parts.length > 4) return null;
  for (const p of parts)
    if (!/^[A-Za-z0-9_.-]{1,128}$/.test(p) || p === '.' || p === '..') return null;
  return parts.join('/');
}
