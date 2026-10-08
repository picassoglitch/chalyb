'use client';
// Chalito's screens use their own paths ("/bandeja", "/r/<id>"). Inside the hub they live under
// /app/chalito: these wrap the hub's locale-aware navigation and add the prefix, so the copied
// components keep their hrefs unchanged.
import { useMemo, type ComponentProps } from 'react';
import type { Route } from 'next';
import {
  Link as HubLink,
  usePathname as hubUsePathname,
  useRouter as hubUseRouter,
  redirect as hubRedirect,
  getPathname as hubGetPathname,
} from '@/i18n/routing';

export const CHALITO_BASE = '/app/chalito';

/** "/bandeja" → "/app/chalito/bandeja"; "/" or "/inicio" → "/app/chalito"; other hub paths unchanged. */
export const chalitoPath = (href: string): string => {
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith(`${CHALITO_BASE}`))
    return href;
  if (href.startsWith('/app/') || href.startsWith('/api/') || href.startsWith('/auth/'))
    return href;
  if (href === '/' || href === '/inicio') return CHALITO_BASE;
  return `${CHALITO_BASE}${href}`;
};

type Href =
  string | { pathname: string; query?: Record<string, string>; params?: Record<string, unknown> };
/**
 * Chalito's routing had typed `pathnames` ("/r/[id]" + params); the hub's has none, so the
 * placeholders are filled in here and the result is a plain prefixed path (query kept).
 */
const resolveHref = (href: Href): string | { pathname: string; query?: Record<string, string> } => {
  if (typeof href === 'string') return chalitoPath(href);
  const pathname = chalitoPath(
    href.pathname.replace(/\[([^\]]+)\]/g, (_, k: string) =>
      encodeURIComponent(String(href.params?.[k] ?? '')),
    ),
  );
  return href.query ? { pathname, query: href.query } : pathname;
};
const prefixHref = resolveHref;

type HubLinkProps = ComponentProps<typeof HubLink>;
export const Link = ({ href, ...rest }: Omit<HubLinkProps, 'href'> & { href: Href }) => (
  <HubLink
    {...(rest as Omit<HubLinkProps, 'href'>)}
    href={prefixHref(href) as HubLinkProps['href']}
  />
);

/** The path inside Chalito ("/app/chalito/bandeja" → "/bandeja"). */
export const usePathname = (): string => {
  const p = hubUsePathname() as string;
  if (p === CHALITO_BASE) return '/';
  return p.startsWith(`${CHALITO_BASE}/`) ? p.slice(CHALITO_BASE.length) : p;
};

// Memoized on the hub router (itself stable), so an effect that depends on it (NewSession's
// "go to the session once it appears") doesn't rerun, and push again, on every render.
export const useRouter = () => {
  const r = hubUseRouter();
  return useMemo(
    () => ({
      ...r,
      push: (href: Href, o?: Parameters<typeof r.push>[1]) =>
        r.push(resolveHref(href) as Parameters<typeof r.push>[0], o),
      replace: (href: Href, o?: Parameters<typeof r.replace>[1]) =>
        r.replace(resolveHref(href) as Parameters<typeof r.replace>[0], o),
      prefetch: (href: string) => r.prefetch(chalitoPath(href) as Route),
    }),
    [r],
  );
};

export const redirect = (args: { href: string; locale: string }) =>
  hubRedirect({ href: chalitoPath(args.href) as Route, locale: args.locale } as Parameters<
    typeof hubRedirect
  >[0]);

/** The locale-aware URL of a Chalito path (for hrefs handed to the shared UI package). */
export const getPathname = (args: { href: Href; locale: string }): string =>
  hubGetPathname({ href: resolveHref(args.href), locale: args.locale } as Parameters<
    typeof hubGetPathname
  >[0]);
