import { safeNextPath } from "@chalito/ui/safe-next";

/** Set by "Entrar con Chalyb" (next-cookie.ts) before it leaves for the hub launch. */
export const NEXT_COOKIE_NAME = "chalito_next";
/** next-cookie.ts SSO_STATE_COOKIE: only the old standalone /auth/sso read it; cleared here. */
export const SSO_STATE_COOKIE_NAME = "chalito_sso_state";

/**
 * Where /app/chalito/auth/sso sends someone. The hub's launch route (/auth/launch/chalito) mints a
 * token for the engine's external_url, which is now the hub itself, so it lands here. Inside the
 * hub HubBridge signs in on its own, so the token is dropped and the person goes back to the
 * Chalito page they left ("Entrar con Chalyb" remembers it in chalito_next), or Chalito's Inicio.
 */
export const ssoLandingPath = (remembered: string | undefined, locale: string): string => {
  const home = `${locale === "en" ? "/en" : ""}/app/chalito`;
  // Already decoded: Next's request.cookies decodes the value once.
  if (!remembered) return home;
  const p = safeNextPath(remembered);
  // Only Chalito's own pages, and never this landing again (a loop).
  if (!/^\/(en\/)?app\/chalito(\/|$|\?)/.test(p) || /^\/(en\/)?app\/chalito\/auth\/sso(\/|$|\?)/.test(p)) return home;
  return p;
};
