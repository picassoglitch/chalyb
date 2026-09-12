// One place that decides whether a `?next=` value is safe to redirect to.
//
// Pure module — no Next, no Supabase — so the rule is unit-testable and the
// same rule applies everywhere a redirect target comes off the query string.
//
// THE ATTACK
// /auth/callback took `next` straight from the URL and did
// `redirect(`${url.origin}${next}`)`. Set next=//evil.com and the result is
// `https://chalyb.com//evil.com`, which browsers read as the protocol-relative
// URL `https://evil.com`. A phishing link that starts on the real domain,
// carries a real sign-in, and lands the user on an attacker's page with the
// referrer to prove they just authenticated with us.
//
// THE RULE
// A safe target is a path on THIS origin and nothing else: it starts with a
// single "/" and does not continue with a second "/" or a "\". Everything
// else — absolute URLs, protocol-relative URLs, backslash variants, and the
// bare empty string — falls back.
//
// Backslash matters on its own: browsers normalize "\" to "/" in the
// authority position, so "/\evil.com" is protocol-relative too even though it
// does not look it.

/** Default landing spot when the requested target is missing or unsafe. */
export const DEFAULT_SAFE_PATH = '/account';

/** C0 controls plus DEL. Browsers strip these while parsing a URL, so we
 *  strip them before judging one — otherwise a tab inside the value reads
 *  as a harmless path here and as a protocol-relative URL in the browser. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Returns `candidate` when it is a same-origin path, else `fallback`.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_SAFE_PATH,
): string {
  if (typeof candidate !== 'string') return fallback;

  const cleaned = candidate.replace(CONTROL_CHARS, '').trim();

  if (!cleaned.startsWith('/')) return fallback;
  // "//host" and "/\host" are both protocol-relative once the browser is
  // through with them.
  if (cleaned.startsWith('//') || cleaned.startsWith('/\\')) return fallback;
  // A backslash anywhere else is never needed in one of our paths, and is a
  // reliable smell of an encoding trick.
  if (cleaned.includes('\\')) return fallback;

  return cleaned;
}

/** True when `candidate` would be returned unchanged by safeInternalPath. */
export function isSafeInternalPath(candidate: string | null | undefined): boolean {
  const sentinel = 'not-a-path';
  return safeInternalPath(candidate, sentinel) !== sentinel;
}
