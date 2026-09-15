// The welcome banner's "Ahora no" is remembered in a cookie rather than a
// database column. Shared between the client that sets it
// (welcome-gift-banner.tsx) and the server page that reads it (/app) so the
// banner is hidden from the first paint. The value is the user id: a second
// account signing in on the same browser still sees its own banner.

export const WELCOME_DISMISSED_COOKIE = 'chalyb_welcome_dismissed';

/** True when the cookie says THIS user dismissed the banner. */
export function isWelcomeDismissedFor(cookieValue: string | undefined, userId: string): boolean {
  if (!cookieValue) return false;
  let decoded = cookieValue;
  try {
    decoded = decodeURIComponent(cookieValue);
  } catch {
    return false;
  }
  return decoded === userId;
}
