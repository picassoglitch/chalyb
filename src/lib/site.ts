import { routing } from '@/i18n/routing';
import { appUrl } from '@/lib/app-url';

/**
 * Absolute origin of the public site, without a trailing slash.
 *
 * Used to build the absolute URLs that robots.txt and sitemap.xml require —
 * both are served from the CDN edge with no request context to derive a host
 * from, so the origin has to come from configuration.
 *
 * Delegates to `appUrl()`, which is the single reader for this value across
 * the app: Mercado Pago's back_urls and notification_url read the same helper,
 * and they used to read a DIFFERENT variable from the one documented here, so
 * an environment that set only the documented name sent MP to localhost.
 * `NEXT_PUBLIC_APP_URL` is canonical; `NEXT_PUBLIC_SITE_URL` still works as a
 * deprecated alias.
 */
export function siteUrl(): string {
  return appUrl();
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
