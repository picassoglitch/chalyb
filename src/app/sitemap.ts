import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE } from '@/i18n/locales';
import { PUBLIC_PATHS, hreflangAlternates, localizedUrl } from '@/lib/site';

/**
 * `/sitemap.xml` — previously a 404.
 *
 * One entry per public path at the default locale, with `alternates.languages`
 * carrying the other locales so crawlers treat /legal/terms and /en/legal/terms
 * as the same document in two languages rather than duplicate content.
 */
const PRIORITY: Record<string, number> = {
  '/': 1,
  '/contacto': 0.6,
  '/legal/terms': 0.3,
  '/legal/privacy': 0.3,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_PATHS.map((path) => ({
    url: localizedUrl(path, DEFAULT_LOCALE),
    lastModified,
    changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: PRIORITY[path] ?? 0.5,
    alternates: { languages: hreflangAlternates(path) },
  }));
}
