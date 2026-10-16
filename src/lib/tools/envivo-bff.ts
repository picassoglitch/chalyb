// En vivo's BFF helpers (pure, unit-tested): request parsing for the
// /api/tools/chalybobs/* routes and the hub side of the platform sign-in
// (OAuth) that ends back in the hub.
//
// OAuth, start to end, without the browser ever holding engine credentials:
//   1. "Conectar {plataforma}" → POST oauth/consent: records social_connect,
//      mints state ("hub.<random>") + a PKCE verifier into an httpOnly hub
//      cookie, bound to this person and platform.
//   2. The same tab (the app never opens windows) goes to GET oauth/start:
//      the hub asks the engine for the platform's consent URL (redirect_uri =
//      the engine's registered callback) and sends the browser there.
//   3. The platform returns to the engine's callback, which sees "hub." and
//      forwards code/state to GET oauth/callback here — nothing is saved yet.
//   4. The hub checks state against ITS cookie (so only the browser that
//      started it, signed in as this person, can finish it) and asks the
//      engine, server to server, to exchange the code for this person's
//      tenant, and goes back to Transmitir with ?connected= / ?connect_error=.

import { createHash, randomBytes } from 'node:crypto';
import {
  isOAuthPlatform,
  isPlatformId,
  validIngestUrl,
  type OAuthPlatform,
  type PlatformId,
} from './envivo-platforms';
import type { DestinationPatch } from './adapters/tools';
import { launchLocale, localizedPath } from './routes';

export class EnVivoBadRequest extends Error {
  readonly code = 'BAD_REQUEST';
}

export function parsePlatformId(v: unknown): PlatformId {
  if (!isPlatformId(v)) throw new EnVivoBadRequest('platform');
  return v;
}

export function parseDestinationId(v: unknown): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(v)) throw new EnVivoBadRequest('id');
  return v;
}

/** Editable fields only; absent stays as is, a key is only sent when typed. */
export function parseDestinationPatch(b: Record<string, unknown>): DestinationPatch {
  const out: DestinationPatch = {};
  const take = (k: keyof DestinationPatch, max: number) => {
    const v = b[k];
    if (v === undefined) return;
    if (typeof v !== 'string' || v.length > max) throw new EnVivoBadRequest(k);
    out[k] = v.trim();
  };
  take('channelHandle', 200);
  take('streamTitle', 200);
  take('ingestUrl', 500);
  take('streamKey', 500);
  if (out.ingestUrl !== undefined && !validIngestUrl(out.ingestUrl))
    throw new EnVivoBadRequest('ingestUrl');
  if (out.streamKey === '') delete out.streamKey;
  return out;
}

export function parseTitle(v: unknown): string {
  if (typeof v !== 'string' || v.length > 200) throw new EnVivoBadRequest('title');
  return v.trim();
}

// ── OAuth (hub side) ────────────────────────────────────────────────────
export const OAUTH_COOKIE = 'chalybobs_oauth';
export const OAUTH_COOKIE_PATH = '/api/tools/chalybobs/oauth';
export const OAUTH_TTL_S = 600;

export interface OAuthPending {
  userId: string;
  platform: OAuthPlatform;
  state: string;
  verifier: string;
  /** The screen's language, so the way back keeps it (/en prefix). */
  lang: 'es' | 'en';
  /** Unix seconds. */
  exp: number;
}

export function studioLang(raw: unknown): 'es' | 'en' {
  return raw === 'en' ? 'en' : 'es';
}

export function newOAuthPending(
  userId: string,
  platform: OAuthPlatform,
  nowS: number,
  lang: 'es' | 'en' = 'es',
): OAuthPending {
  return {
    userId,
    platform,
    lang,
    state: `hub.${randomBytes(24).toString('base64url')}`,
    verifier: randomBytes(32).toString('base64url'),
    exp: nowS + OAUTH_TTL_S,
  };
}

export const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

export function encodePending(p: OAuthPending): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url');
}

export function decodePending(raw: string | undefined | null): OAuthPending | null {
  if (!raw || raw.length > 2000) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<OAuthPending>;
    if (
      typeof p.userId !== 'string' ||
      !isOAuthPlatform(p.platform) ||
      typeof p.state !== 'string' ||
      !/^hub\.[A-Za-z0-9_-]{16,128}$/.test(p.state) ||
      typeof p.verifier !== 'string' ||
      typeof p.exp !== 'number'
    )
      return null;
    return { ...(p as OAuthPending), lang: studioLang(p.lang) };
  } catch {
    return null;
  }
}

/** The cookie matches this person, platform and (for the callback) state,
 *  and hasn't expired. The cookie is httpOnly + SameSite=Lax on the hub's
 *  own domain, so a link from elsewhere can't bring one. */
export function pendingMatches(
  p: OAuthPending | null,
  want: { userId: string; platform: string; state?: string | null },
  nowS: number,
): p is OAuthPending {
  if (!p) return false;
  if (p.exp < nowS) return false;
  if (p.userId !== want.userId || p.platform !== want.platform) return false;
  if (want.state !== undefined && p.state !== want.state) return false;
  return true;
}

export type OAuthOutcome = { connected: OAuthPlatform } | { error: string };

/** The connect result as the screens read it (?connected= / ?connect_error=). */
export function outcomeQuery(o: OAuthOutcome): string {
  return 'connected' in o
    ? `connected=${encodeURIComponent(o.connected)}`
    : `connect_error=${encodeURIComponent(o.error)}`;
}

/** Back to Transmitir, in the screen's language, with the result. */
export function backToStudio(o: OAuthOutcome, base: string, lang: string | null = null): URL {
  return new URL(`${localizedPath('/app/en-vivo', launchLocale(lang))}?${outcomeQuery(o)}`, base);
}

export { isOAuthPlatform };

/** Where the player reads the preview: the hub's proxy, with the
 *  short-lived preview token as a path segment (relative segment URLs in
 *  the playlist resolve under it). */
export function previewUrlFor(token: string | null): { url: string | null } {
  return {
    url: token ? `/api/tools/chalybobs/preview/${encodeURIComponent(token)}/index.m3u8` : null,
  };
}
