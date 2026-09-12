import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Vanity / habitual URLs that should land on the real auth page.
  // The auth surface lives at /sign-in (Next route group `(auth)`), but
  // users type "login" / "register" by reflex. Permanent redirects so
  // shared links — emails, docs, partner outreach — resolve cleanly even
  // if we rename the canonical path later.
  async redirects() {
    return [
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/register', destination: '/sign-in?mode=signup', permanent: true },
      { source: '/signup', destination: '/sign-in?mode=signup', permanent: true },
      // Locale-prefixed variants — next-intl middleware doesn't rewrite
      // these for us, so mirror them explicitly for /en and /es.
      { source: '/:locale(en|es)/login', destination: '/:locale/sign-in', permanent: true },
      { source: '/:locale(en|es)/register', destination: '/:locale/sign-in?mode=signup', permanent: true },
      { source: '/:locale(en|es)/signup', destination: '/:locale/sign-in?mode=signup', permanent: true },
      // The contact page has always lived at /contacto in both locales.
      // /contact is what English readers (and old links) type — send them to
      // the real page instead of a 404.
      { source: '/contact', destination: '/contacto', permanent: true },
      { source: '/:locale(en|es)/contact', destination: '/:locale/contacto', permanent: true },
      // Pricing is a section of the landing, not a page of its own.
      { source: '/pricing', destination: '/#pricing', permanent: true },
      { source: '/:locale(en|es)/pricing', destination: '/:locale/#pricing', permanent: true },
    ];
  },
};

export default withNextIntl(nextConfig);
