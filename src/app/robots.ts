import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/app-url';

// Served at /robots.txt. Lives outside [locale] so it isn't matched by the
// locale segment (and the middleware skips it — the matcher excludes paths
// with a dot).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Everything behind auth. Crawling these only ever yields a redirect
        // to /sign-in, and /api/* is machine surface, not content.
        disallow: ['/app', '/dashboard', '/account', '/api/', '/auth/'],
      },
    ],
    sitemap: `${appUrl()}/sitemap.xml`,
    host: appUrl(),
  };
}
