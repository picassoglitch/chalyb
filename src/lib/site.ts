import type { Metadata } from 'next';
import { DEFAULT_LOCALE, HREFLANG, LOCALES } from '@/i18n/locales';

/**
 * The canonical public origin, without a trailing slash (rebuild prompt §6.4).
 *
 * `https://www.chalyb.com` — the host Vercel 308s every other host to. Used
 * for metadataBase, canonical and hreflang links, the sitemap and robots.txt.
 * Previews override it with NEXT_PUBLIC_CANONICAL_ORIGIN.
 *
 * Deliberately NOT appUrl(): Mercado Pago's back_urls and notification_url
 * read that one, and moving it is an ops change (OPS-4), not a code change.
 */
export function canonicalOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_CANONICAL_ORIGIN || 'https://www.chalyb.com';
  return configured.replace(/\/+$/, '');
}

/** Absolute origin for robots.txt and sitemap.xml. */
export function siteUrl(): string {
  return canonicalOrigin();
}

/** Path for a public page in a locale, honoring `localePrefix: 'as-needed'`:
 *  the default locale (es) serves unprefixed, every other one under /<locale>. */
export function localizedPath(path: string, locale: string): string {
  const clean = path === '/' ? '' : path;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${prefix}${clean}` || '/';
}

/** Absolute URL for a public path in a given locale. */
export function localizedUrl(path: string, locale: string): string {
  const localized = localizedPath(path, locale);
  return `${siteUrl()}${localized === '/' ? '/' : localized}`;
}

/**
 * Public, indexable pages. Single source shared by the sitemap and the
 * language switcher's list of pages that exist in both locales.
 */
export const PUBLIC_PATHS = [
  '/',
  '/planes',
  '/contacto',
  '/legal/terms',
  '/legal/privacy',
  '/quien-vende',
] as const;

/** hreflang map for a public path: es-MX unprefixed, en under /en, and
 *  x-default pointing at Spanish. */
export function hreflangAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) languages[HREFLANG[locale]] = localizedUrl(path, locale);
  languages['x-default'] = localizedUrl(path, DEFAULT_LOCALE);
  return languages;
}

/**
 * Canonical, hreflang and Open Graph URL fields for a public page. Spread into
 * the page's metadata. Absolute URLs, so they don't depend on metadataBase.
 */
export function publicPageMetadata(
  path: string,
  locale: string,
  copy: { title: string; description: string },
): Metadata {
  const url = localizedUrl(path, locale);
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: url, languages: hreflangAlternates(path) },
    openGraph: {
      url,
      locale: locale === DEFAULT_LOCALE ? 'es_MX' : 'en_US',
      title: copy.title,
      description: copy.description,
    },
  };
}
