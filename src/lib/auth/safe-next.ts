// Where a `?next=` is allowed to send someone.
//
// `next` rides through the whole auth flow — /sign-in?next=…, the Google OAuth
// redirect_to, /auth/callback?next=… — and every one of those ends in a
// redirect the browser follows while the user is being handed a session. An
// attacker-supplied absolute URL there is a phishing vector: the link starts on
// our domain, the user signs in, and lands on a lookalike page that asks them
// to "confirm" something.
//
// So: same-origin, path-only, and nothing a URL parser or a browser can re-read
// as an authority.

/** Longest path we'll echo back. A `next` in the kilobytes is not a real
 *  destination, and it would end up in a Location header. */
const MAX_LENGTH = 512;

/** Control characters. A newline in a Location header splits the response. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * Returns `raw` when it is a safe same-origin path, otherwise `fallback`.
 *
 * Rejected, and why:
 *   - `https://evil.com`, `mailto:…` — absolute, different origin.
 *   - `//evil.com` — protocol-relative; the browser reads `evil.com` as the host.
 *   - `/\evil.com` — browsers normalize `\` to `/`, so this is the
 *     protocol-relative case wearing a disguise.
 *   - `%2F%2Fevil.com`, `%5Cevil.com` — the same two after one decode pass,
 *     which is what happens when the value round-trips through a redirect.
 *   - anything not starting with `/` — a bare `evil.com` is a relative path to
 *     some parsers and an origin to others.
 */
export function safeNextPath(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.length > MAX_LENGTH) return fallback;

  // Check the decoded form too: the rule has to hold for what the browser
  // finally resolves, not just for the bytes we received.
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding — not something we're going to redirect to.
    return fallback;
  }

  for (const value of [raw, decoded]) {
    if (!value.startsWith('/')) return fallback;
    if (value.startsWith('//')) return fallback;
    if (value.includes('\\')) return fallback;
    if (CONTROL_CHARS.test(value)) return fallback;
  }

  return raw;
}

/**
 * `next` is locale-free by design (the proxy strips the prefix so next-intl
 * can re-add it). Anything that hands it to a plain browser redirect — the
 * email form's router, /auth/callback's Location header — has to put the
 * prefix back, or an English reader lands on the Spanish page. /auth/* are
 * route handlers outside the locale tree and stay as they are, and a path
 * that already carries a locale prefix is left alone.
 */
export function localizeNext(path: string, locale: string | null | undefined): string {
  if (!locale || locale === 'es') return path;
  if (path.startsWith('/auth/')) return path;
  if (/^\/(es|en)(?=[/?#]|$)/.test(path)) return path;
  if (path === '/') return `/${locale}`;
  if (path.startsWith('/?') || path.startsWith('/#')) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** The locale a (possibly prefixed) path is in — 'en' for /en/…, else 'es'. */
export function localeOfPath(path: string): 'es' | 'en' {
  return /^\/en(?=[/?#]|$)/.test(path) ? 'en' : 'es';
}
