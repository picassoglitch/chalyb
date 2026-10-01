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
      // P3: the tools list is Más herramientas now; tool pages stay put
      // (/app/engines/[slug] sends included tools to their own screens).
      { source: '/app/engines', destination: '/app/herramientas', permanent: true },
      { source: '/:locale(en|es)/app/engines', destination: '/:locale/app/herramientas', permanent: true },
      // Spanish aliases for the customer screens.
      { source: '/app/resultados', destination: '/app/history', permanent: false },
      { source: '/:locale(en|es)/app/resultados', destination: '/:locale/app/history', permanent: false },
      { source: '/app/ayuda', destination: '/app/help', permanent: false },
      { source: '/:locale(en|es)/app/ayuda', destination: '/:locale/app/help', permanent: false },
      { source: '/login', destination: '/sign-in', permanent: true },
      { source: '/register', destination: '/sign-in?mode=signup', permanent: true },
      { source: '/signup', destination: '/sign-in?mode=signup', permanent: true },
      // Locale-prefixed variants — next-intl middleware doesn't rewrite
      // these for us, so mirror them explicitly for /en and /es.
      { source: '/:locale(en|es)/login', destination: '/:locale/sign-in', permanent: true },
      {
        source: '/:locale(en|es)/register',
        destination: '/:locale/sign-in?mode=signup',
        permanent: true,
      },
      {
        source: '/:locale(en|es)/signup',
        destination: '/:locale/sign-in?mode=signup',
        permanent: true,
      },

      // The landing is a single page; pricing is the `#pricing` section of it,
      // not a route. /pricing (and the Spanish /precios) used to 404 — people
      // type them, and they are the obvious guess from a pricing CTA.
      { source: '/pricing', destination: '/#pricing', permanent: false },
      { source: '/precios', destination: '/#pricing', permanent: false },
      {
        source: '/:locale(en|es)/pricing',
        destination: '/:locale/#pricing',
        permanent: false,
      },
      {
        source: '/:locale(en|es)/precios',
        destination: '/:locale/#pricing',
        permanent: false,
      },

      // There is no public catalog page; the tools live in the landing's
      // #herramientas section. Temporary until P4 makes it permanent (B09).
      { source: '/engines', destination: '/#herramientas', permanent: false },
      {
        source: '/:locale(en|es)/engines',
        destination: '/:locale/#herramientas',
        permanent: false,
      },

      // Aliases people type (B14). /terminos and /privacidad are temporary:
      // P6 makes the legal slugs canonical. /planes is a real page since P2.
      { source: '/sign-up', destination: '/sign-in?mode=signup', permanent: true },
      {
        source: '/:locale(en|es)/sign-up',
        destination: '/:locale/sign-in?mode=signup',
        permanent: true,
      },
      { source: '/terminos', destination: '/legal/terms', permanent: false },
      { source: '/:locale(en|es)/terminos', destination: '/:locale/legal/terms', permanent: false },
      { source: '/privacidad', destination: '/legal/privacy', permanent: false },
      {
        source: '/:locale(en|es)/privacidad',
        destination: '/:locale/legal/privacy',
        permanent: false,
      },

      // BUILD-SPEC names Mi cuenta /app/cuenta; the existing route is
      // /app/settings (§0.1 reuse rule), so both work.
      { source: '/app/cuenta', destination: '/app/settings', permanent: true },
      {
        source: '/:locale(en|es)/app/cuenta',
        destination: '/:locale/app/settings',
        permanent: true,
      },

      // The contact page is ES-canonical at /contacto. English visitors (and
      // anyone linking from English copy) reach for /contact, which 404'd.
      { source: '/contact', destination: '/contacto', permanent: true },
      {
        source: '/:locale(en|es)/contact',
        destination: '/:locale/contacto',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
