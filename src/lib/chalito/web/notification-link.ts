import { safeNextPath } from "@chalito/ui/safe-next";

/**
 * Where a notification may send someone: an approval, a mesa, a room, a session, credits, or
 * Inicio. Nothing else. Matches packages/protocol DeepLink, which also allows an "/en" prefix
 * (the notifier's caps alerts for English accounts) and "/" (recovery and account-deletion alerts).
 */
const TARGET = /^\/(a|m|r|s)\/[A-Za-z0-9_-]{1,128}$|^\/creditos$|^\/$/;

/**
 * The notification's deepLink, localized and under the hub's /app/chalito, or null when it isn't
 * one of ours. Deep links stay Chalito paths ("/a/<id>"); the prefix is added here. The locale is
 * the person's current one, not the deep link's. A session ("/s/<id>") is /sesiones/<id> here.
 */
export const notificationTarget = (deepLink: string, locale: "es" | "en"): string | null => {
  const raw = safeNextPath(deepLink);
  const p = raw === "/en" ? "/" : raw.startsWith("/en/") ? raw.slice(3) : raw;
  if (!TARGET.test(p)) return null;
  const path = p === "/" ? "" : p.startsWith("/s/") ? `/sesiones/${p.slice(3)}` : p;
  return `${locale === "en" ? "/en" : ""}/app/chalito${path}`;
};

/**
 * How the person arrived, for acked_via: WhatsApp's link wrapper shows up as the referrer; the
 * notifier may also say it explicitly with ?via=, and the service worker opens push taps with
 * ?via=push. SMS apps send no referrer, so without ?via=sms it counts as "app".
 */
export const ackVia = (referrer: string, via: string | null): "whatsapp" | "sms" | "push" | "app" => {
  if (via === "whatsapp" || via === "sms" || via === "push") return via;
  return /(^|\.)whatsapp\.com|(^|\/\/)wa\.me|l\.wl\.co/.test(referrer) ? "whatsapp" : "app";
};
