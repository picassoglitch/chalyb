import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** Old tool URLs → their screens inside the app (most specific first). */
const TOOL_REDIRECTS: [string, string][] = [
  ['/app/engines', '/app/herramientas'],
  ['/app/engines/chalybclip/:rest*', '/app/clips'],
  ['/app/engines/chalybcrypto/:rest*', '/app/senales'],
  ['/app/engines/chalybobs/:rest*', '/app/en-vivo'],
  ['/app/engines/:slug/:rest*', '/app/herramientas'],
  // Señales' first activation moved under /app/senales/empezar.
  ['/app/senales/avisos', '/app/senales/empezar/avisos'],
  ['/app/senales/listo', '/app/senales/empezar/listo'],
];

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
      // WS-11 (TOOLS-SPEC §2): the tools open inside the app now. The old
      // /app/engines URLs answer 307 for the first 4 weeks (then 308), keep
      // the query string (Next appends it) and never 404: an unknown or
      // retired slug lands on Tus herramientas.
      ...TOOL_REDIRECTS.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: false },
        { source: `/:locale(en|es)${from}`, destination: `/:locale${to}`, permanent: false },
      ]),
      // Spanish aliases for the customer screens.
      { source: '/app/resultados', destination: '/app/history', permanent: false },
      { source: '/:locale(en|es)/app/resultados', destination: '/:locale/app/history', permanent: false },
      { source: '/app/ayuda', destination: '/app/help', permanent: false },
      { source: '/:locale(en|es)/app/ayuda', destination: '/:locale/app/help', permanent: false },
      // P5: main's Dinero, Actividad and Ajustes screens folded into the
      // rebuilt owner panel.
      { source: '/dashboard/billing', destination: '/dashboard/dinero', permanent: true },
      { source: '/:locale(en|es)/dashboard/billing', destination: '/:locale/dashboard/dinero', permanent: true },
      { source: '/dashboard/activity', destination: '/dashboard/actividad', permanent: true },
      { source: '/:locale(en|es)/dashboard/activity', destination: '/:locale/dashboard/actividad', permanent: true },
      { source: '/dashboard/settings', destination: '/dashboard/ajustes', permanent: true },
      { source: '/:locale(en|es)/dashboard/settings', destination: '/:locale/dashboard/ajustes', permanent: true },
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

      // Pricing lives at /planes (SCR-12). /pricing and the Spanish /precios
      // are the obvious guesses, so they 308 there (P4-2).
      { source: '/pricing', destination: '/planes', permanent: true },
      { source: '/precios', destination: '/planes', permanent: true },
      { source: '/:locale(en|es)/pricing', destination: '/:locale/planes', permanent: true },
      { source: '/:locale(en|es)/precios', destination: '/:locale/planes', permanent: true },

      // There is no public catalog page; the tools live in the landing's
      // #herramientas section (P4-3, B09).
      { source: '/engines', destination: '/#herramientas', permanent: true },
      {
        source: '/:locale(en|es)/engines',
        destination: '/:locale/#herramientas',
        permanent: true,
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
