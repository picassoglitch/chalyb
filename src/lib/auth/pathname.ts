// The request path, carried from the middleware to the server components.
//
// App Router layouts don't receive the URL they're rendering, so the
// middleware stamps it on the request (see src/middleware.ts) and the auth
// guards read it back here. That's what lets /app/billing send the user to
// /sign-in?next=/app/billing instead of a generic /app.

import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';

export const PATHNAME_HEADER = 'x-chalyb-pathname';

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);

/** Same-origin check — mirrors the one the sign-in page runs on `?next=`.
 *  `//evil.com` is protocol-relative and browsers normalize `\` to `/`. */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

/**
 * The path currently being rendered, with its locale prefix and query string.
 * Falls back to `fallback` when the header is missing (a direct render with no
 * middleware hop, e.g. during a build).
 */
export async function currentPathname(fallback: string): Promise<string> {
  const header = (await headers()).get(PATHNAME_HEADER);
  return header && isSafePath(header) ? header : fallback;
}

/**
 * Where to send someone who isn't signed in. Keeps them in the locale they
 * were browsing (/en/app/billing → /en/sign-in) and carries the full
 * destination so auth can return them to it.
 */
export async function signInHref(fallback: string): Promise<string> {
  const path = await currentPathname(fallback);
  const prefix = LOCALE_PREFIX.exec(path)?.[0] ?? '';
  return `${prefix}/sign-in?next=${encodeURIComponent(path)}`;
}
