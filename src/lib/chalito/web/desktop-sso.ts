/**
 * Desktop SSO bridge: the desktop app opens /auth/desktop?state=…&redirect_uri=…, the person signs
 * in on the hub, and /auth/sso hands the launch token to the app instead of exchanging it here.
 */
export const DESKTOP_COOKIE = "chalito_desktop";
export const DESKTOP_MAX_AGE_S = 600;

/** 32 random bytes, base64url without padding. */
const STATE = /^[A-Za-z0-9_-]{43}$/;
const LOOPBACK = /^http:\/\/127\.0\.0\.1:(\d{1,5})\/auth\/sso$/;

/**
 * The loopback redirect is only for `tauri dev` (its debug-only listener): local dev and Vercel
 * previews accept it, production never does. An installed app always uses chalito://auth/sso.
 */
export const loopbackAllowed = (env: Record<string, string | undefined> = process.env): boolean =>
  env.VERCEL_ENV === "preview" || (env.VERCEL_ENV !== "production" && env.NODE_ENV === "development");

/**
 * Exactly `chalito://auth/sso`, or (dev/preview only) `http://127.0.0.1:<1024–65535>/auth/sso`.
 * Anything else is refused.
 */
export const validDesktopRedirect = (r: string | null, allowLoopback = loopbackAllowed()): string | null => {
  if (r === "chalito://auth/sso") return r;
  if (!allowLoopback) return null;
  const m = r ? LOOPBACK.exec(r) : null;
  if (!m) return null;
  const port = Number(m[1]);
  return port >= 1024 && port <= 65535 ? r : null;
};

export const validDesktopState = (s: string | null): string | null => (s && STATE.test(s) ? s : null);

export interface DesktopHandoff {
  state: string;
  redirect: string;
}

export const parseHandoff = (raw: string | undefined): DesktopHandoff | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { state?: unknown; redirect?: unknown };
    const state = validDesktopState(typeof v.state === "string" ? v.state : null);
    const redirect = validDesktopRedirect(typeof v.redirect === "string" ? v.redirect : null);
    return state && redirect ? { state, redirect } : null;
  } catch {
    return null;
  }
};

/** Where "Abrir Chalito" goes: the app's redirect with the hub's launch token, the state and next. */
export const handoffUrl = (h: DesktopHandoff, token: string, next: string | null): string => {
  const u = new URL(h.redirect);
  u.searchParams.set("token", token);
  u.searchParams.set("state", h.state);
  if (next) u.searchParams.set("next", next);
  return u.toString();
};

/**
 * The hub page the desktop app opens (its default SSO start URL). Inside the hub there is no
 * cookie hop: the person is signed in to the hub already, or the /app gate sends them through
 * /sign-in?next=<this path with its query> and back here.
 */
export const DESKTOP_START_PATH = "/app/chalito/auth/desktop";

/**
 * Response headers for that page (next.config.ts): its URL carries the app's state, so it's never
 * cached, never indexed and never sent on as a Referer (the original route's headers).
 */
export const DESKTOP_PAGE_HEADERS = [
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  { key: "Cache-Control", value: "no-store" },
] as const;

/** This page's own path with the app's state and redirect, used as the sign-in `next`. */
export const desktopStartPath = (h: DesktopHandoff): string => {
  const q = new URLSearchParams({ state: h.state, redirect_uri: h.redirect });
  return `${DESKTOP_START_PATH}?${q.toString()}`;
};

/** The desktop's query (`client=desktop&state=…&redirect_uri=…`), validated; null if anything is off. */
export const handoffFromQuery = (
  q: { state?: unknown; redirect_uri?: unknown },
  allowLoopback = loopbackAllowed(),
): DesktopHandoff | null => {
  const state = validDesktopState(typeof q.state === "string" ? q.state : null);
  const redirect = validDesktopRedirect(typeof q.redirect_uri === "string" ? q.redirect_uri : null, allowLoopback);
  return state && redirect ? { state, redirect } : null;
};

export type DesktopHandoffResult =
  | { ok: true; url: string }
  | { ok: false; reason: "signed_out" | "no_access" | "rate_limited" | "failed" };

/**
 * Asks the hub for a launch token (/api/tools/chalito/sso, same gates as a launch) and builds the
 * `chalito://auth/sso?token=…&state=…` link. The token is never exchanged in this browser: only the
 * desktop app that made `state` accepts it (apps/desktop/src/lib/sso.ts).
 */
export const desktopHandoff = async (h: DesktopHandoff, f: typeof fetch): Promise<DesktopHandoffResult> => {
  const r = await f("/api/tools/chalito/sso", { method: "POST", credentials: "same-origin" }).catch(() => null);
  if (!r) return { ok: false, reason: "failed" };
  if (r.status === 401) return { ok: false, reason: "signed_out" };
  if (r.status === 403) return { ok: false, reason: "no_access" };
  if (r.status === 429) return { ok: false, reason: "rate_limited" };
  const body = (await r.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
  if (!r.ok || !body?.ok || typeof body.token !== "string" || !body.token) return { ok: false, reason: "failed" };
  return { ok: true, url: handoffUrl(h, body.token, null) };
};
