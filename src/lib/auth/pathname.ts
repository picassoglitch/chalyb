import { headers } from 'next/headers';

/**
 * Request header stamped by `src/proxy.ts` with the locale-stripped path +
 * query of the incoming request.
 *
 * Server Components have no way to read the current URL, so the auth gates in
 * the protected layouts used to hardcode their `?next=` ("/app", "/dashboard").
 * That collapsed every deep link — /app/billing, /app/engines, /dashboard/revenue
 * all sent the user to the section root after signing in. The proxy runs on the
 * real request, so it is the only place that knows the answer.
 */
export const PATHNAME_HEADER = 'x-chalyb-pathname';

/**
 * Same-origin relative path, or null. Rejects anything that could be read as an
 * absolute/protocol-relative URL — `//evil.com`, and the `/\evil.com` variant
 * browsers normalize to `//evil.com`. The proxy overwrites this header on every
 * request it matches, so a client-supplied value never survives on a gated
 * route; this check is the backstop for anything that slips past the matcher.
 */
export function sanitizeDestination(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/')) return null;
  if (value.startsWith('//')) return null;
  if (value.includes('\\')) return null;
  return value;
}

/**
 * Where the user should land after authenticating: the path they actually
 * asked for. Falls back to `fallback` when the header is missing (a route
 * outside the proxy matcher, or a direct render in tests).
 */
export async function requestedDestination(fallback: string): Promise<string> {
  const headerList = await headers();
  return sanitizeDestination(headerList.get(PATHNAME_HEADER)) ?? fallback;
}
