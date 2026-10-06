'use client';
// Chalito's screens use their own paths ("/bandeja", "/r/<id>"). Inside the hub they live under
// /app/chalito: these wrap the hub's locale-aware navigation and add the prefix, so the copied
// components keep their hrefs unchanged.
import type { ComponentProps } from 'react';
import type { Route } from 'next';
import {
  Link as HubLink,
  usePathname as hubUsePathname,
  useRouter as hubUseRouter,
  redirect as hubRedirect,
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
const prefixHref = (href: Href): Href =>
  typeof href === 'string' ? chalitoPath(href) : { ...href, pathname: chalitoPath(href.pathname) };

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

export const useRouter = () => {
  const r = hubUseRouter();
  return {
    ...r,
    push: (href: string, o?: Parameters<typeof r.push>[1]) => r.push(chalitoPath(href) as Route, o),
    replace: (href: string, o?: Parameters<typeof r.replace>[1]) =>
      r.replace(chalitoPath(href) as Route, o),
    prefetch: (href: string) => r.prefetch(chalitoPath(href) as Route),
  };
};

export const redirect = (args: { href: string; locale: string }) =>
  hubRedirect({ href: chalitoPath(args.href) as Route, locale: args.locale } as Parameters<
    typeof hubRedirect
  >[0]);
