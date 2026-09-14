import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/**
 * `/robots.txt` — previously a 404, which left crawlers guessing and gave them
 * no pointer to the sitemap.
 *
 * Everything behind auth is disallowed: those routes redirect to /sign-in for
 * an anonymous crawler anyway, so indexing them only burns crawl budget and
 * surfaces sign-in pages in results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/auth/',
        '/app',
        '/dashboard',
        '/account',
        '/sign-in',
        '/forgot-password',
        '/reset-password',
        '/en/app',
        '/en/dashboard',
        '/en/account',
        '/en/sign-in',
        '/en/forgot-password',
        '/en/reset-password',
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
