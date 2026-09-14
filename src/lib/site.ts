import { routing } from '@/i18n/routing';

/**
 * Absolute origin of the public site, without a trailing slash.
 *
 * Used to build the absolute URLs that robots.txt and sitemap.xml require —
 * both are served from the CDN edge with no request context to derive a host
 * from, so the origin has to come from configuration.
 *
 * `NEXT_PUBLIC_SITE_URL` is the source of truth (set it per environment in
 * Vercel). `VERCEL_PROJECT_PRODUCTION_URL` is the fallback so preview and
 * production deployments still emit a usable sitemap if the var is missing.
 */
export function siteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined);
  return (configured ?? 'https://chalyb.com').replace(/\/+$/, '');
}

/**
 * Absolute URL for a public path in a given locale, honoring the
 * `localePrefix: 'as-needed'` routing — the default locale (es) serves
 * unprefixed, every other locale under `/<locale>`.
 */
export function localizedUrl(path: string, locale: string): string {
  const clean = path === '/' ? '' : path;
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${siteUrl()}${prefix}${clean}` || `${siteUrl()}/`;
}

/**
 * Public, indexable pages. Single source shared by the sitemap and the
 * language switcher's list of pages that exist in both locales.
 */
export const PUBLIC_PATHS = ['/', '/contacto', '/legal/terms', '/legal/privacy'] as const;
