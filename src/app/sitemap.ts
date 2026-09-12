import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { appUrl } from '@/lib/app-url';

// Served at /sitemap.xml — the public hub only. Signed-in surfaces (/app,
// /dashboard, /account) are excluded here and in robots.txt.
//
// Paths are written unprefixed; the default locale serves them at the root
// and every other locale under its prefix (localePrefix: 'as-needed').
const PUBLIC_PATHS = [
  { path: '', priority: 1 },
  { path: '/contacto', priority: 0.7 },
  { path: '/sign-in', priority: 0.6 },
  { path: '/legal/terms', priority: 0.3 },
  { path: '/legal/privacy', priority: 0.3 },
] as const;

function href(locale: string, path: string): string {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const url = `${appUrl()}${prefix}${path}`;
  // The default locale's home page is the bare origin — give it a path.
  return prefix === '' && path === '' ? `${url}/` : url;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_PATHS.flatMap(({ path, priority }) =>
    routing.locales.map((locale) => ({
      url: href(locale, path),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority,
      // hreflang alternates so each locale's page points at the other.
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, href(l, path)])),
      },
    })),
  );
}
