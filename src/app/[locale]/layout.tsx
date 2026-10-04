import type { Metadata } from 'next';
import { Familjen_Grotesk, Fraunces, Inter, Space_Mono } from 'next/font/google';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CookieConsent } from '@/components/public/cookie-banner';
import { routing } from '@/i18n/routing';
import { PUBLIC_CLIENT_NAMESPACES, pickNamespaces } from '@/i18n/client-messages';
import { HREFLANG } from '@/i18n/locales';
import { canonicalOrigin } from '@/lib/site';
import './globals.css';

// Lock the [locale] segment to real locales. Without this, requests for
// non-locale top-level paths (/favicon.ico, /robots.txt, …) match the dynamic
// segment and run generateMetadata with locale="favicon.ico", which threw
// MODULE_NOT_FOUND on `import('messages/favicon.ico.json')`. Now they 404 clean.
export const dynamicParams = false;

// The design system's font (Q27; LANDING-SPEC §7) for every page, public ones
// included: self-hosted by next/font, no request to Google at runtime. The
// tokens read it as var(--cc-body). Not preloaded: the 48 KB preload
// competed with the hero's LCP image, and the fallback is metric-adjusted, so
// the swap shifts nothing (LANDING-SPEC §7, CLS 0 measured).
const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--cc-body' });

// The legacy faces (globals.css --font-display/--font-serif/--font-mono) for
// the pages not yet rebuilt. Self-hosted too: the Google Fonts <link> they
// used to come from blocked the landing's first paint (LANDING-SPEC §7). Not
// preloaded, so a page that never uses them never downloads them.
const legacyDisplay = Familjen_Grotesk({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
  variable: '--font-familjen',
});
const legacySerif = Fraunces({
  subsets: ['latin'],
  // Variable weight (covers the 400/500 the <link> asked for) with opsz.
  axes: ['opsz'],
  display: 'swap',
  preload: false,
  variable: '--font-fraunces',
});
const legacyMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-space-mono',
});
const fontVars = [inter, legacyDisplay, legacySerif, legacyMono].map((f) => f.variable).join(' ');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Belt to dynamicParams' suspenders: never import a non-locale messages file.
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const messages = (await import(`../../../messages/${safeLocale}.json`)).default;
  // Title template: pages that export `metadata: { title: 'Engines' }` will
  // render as "Engines · Chalyb" in the browser tab. Pages without a title
  // fall back to the locale-level meta.title (the marketing tagline).
  return {
    // Relative metadata URLs resolve against the canonical www origin.
    metadataBase: new URL(canonicalOrigin()),
    title: {
      default: messages.meta.title,
      template: '%s · Chalyb',
    },
    // Every page's fallback: no trial claim (it depends on a runtime flag).
    description: messages.meta.descriptionNoTrial,
    // Icons come from the file conventions (app/favicon.ico, app/icon.png) and
    // from public/apple-touch-icon.png, which iOS requests by that exact path.
    // Declaring `icons` here would replace the convention's <link> tags, so we
    // don't — see src/app/favicon.ico and public/apple-touch-icon.png.
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={HREFLANG[locale]} data-scroll-behavior="smooth" className={fontVars}>
      <body>
        <NextIntlClientProvider messages={pickNamespaces(messages, PUBLIC_CLIENT_NAMESPACES)}>
          {children}
          {/* Loads Vercel Analytics only after cookie consent (P4-7). */}
          <CookieConsent />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
