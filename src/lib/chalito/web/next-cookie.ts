import { APP_HOME, safeNextPath } from "@chalito/ui";
import { supabase } from "./supabase";

/**
 * The hub's launch route doesn't forward `next` (sign-in remembers only /auth/launch/chalito and
 * SSO lands on the default page). So before sending a signed-out person to the hub, Chalito keeps
 * where they were going in a short-lived first-party cookie (it survives a sign-in in a new tab)
 * and returns there after /auth/sso.
 */
export const NEXT_COOKIE = "chalito_next";
const MAX_AGE_S = 600;

/** A same-origin app path to come back to; never the api, Next internals or the SSO page itself. */
export const allowedNext = (raw: string | null | undefined): string => {
  const p = safeNextPath(raw);
  return /^\/(api|_next|_vercel)(\/|$)|^\/(en\/)?auth\/sso(\/|$|\?)/.test(p) ? APP_HOME : p;
};

export const rememberNext = (path: string): void => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(allowedNext(path))}; Max-Age=${MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
};

/** Reads and clears the remembered path (validated again: the cookie is client-controlled). */
export const takeNext = (): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${NEXT_COOKIE}=([^;]*)`));
  document.cookie = `${NEXT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  if (!m) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return allowedNext(raw);
};

/** One hub launch per page: effects that re-run (or a double tap) must not start a second one. */
let launching = false;

/**
 * Login CSRF guard (review R-M1): every sign-in Chalito starts gets a fresh nonce in a first-party
 * cookie (also sent to the hub as `state`). /auth/sso exchanges a launch token only when that
 * cookie is there (and matches `state` when the hub echoes it), so a token someone else sends you
 * can't sign you into their account.
 */
export const SSO_STATE_COOKIE = "chalito_sso_state";

/** Reads and clears the nonce of the sign-in this browser started (null if it started none). */
export const takeSsoState = (): string | null => {
  const m = document.cookie.match(new RegExp(`(?:^|; )${SSO_STATE_COOKIE}=([A-Za-z0-9_-]{43})(?:;|$)`));
  document.cookie = `${SSO_STATE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return m ? m[1]! : null;
};

/** The launch is ours: we started it here, and the hub's `state` (if it sends one) is the same. */
export const ssoStateMatches = (expected: string | null, received: string | null): boolean =>
  expected !== null && (received === null || received === expected);

/**
 * "Entrar con Chalyb", inside the hub: the person is already signed in to the hub, and the hub's
 * launch route for Chalito would land on /app/chalito/auth/sso, which the hub doesn't have (a 404).
 * So this drops Chalito's own session on this browser (local scope) and HubBridge signs in again in
 * place, with a fresh launch token, on this same page. `path` stays for callers' sake: the page
 * doesn't change.
 */
export const signInAndReturn = (path: string): void => {
  void path;
  if (launching) return;
  launching = true;
  void (supabase().auth as unknown as { signOut(o: { scope: "local" }): Promise<unknown> })
    .signOut({ scope: "local" })
    .catch(() => undefined)
    .finally(() => {
      launching = false;
    });
};
