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
