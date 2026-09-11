import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Analytics } from '@vercel/analytics/next';
import { routing } from '@/i18n/routing';
import './globals.css';

// Lock the [locale] segment to real locales. Without this, requests for
// non-locale top-level paths (/favicon.ico, /robots.txt, …) match the dynamic
// segment and run generateMetadata with locale="favicon.ico", which threw
// MODULE_NOT_FOUND on `import('messages/favicon.ico.json')`. Now they 404 clean.
export const dynamicParams = false;

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
    title: {
      default: messages.meta.title,
      template: '%s · Chalyb',
    },
    description: messages.meta.description,
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
    <html lang={locale} data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Space+Mono:wght@400;700&family=Fraunces:opsz,wght@9..144,400;9..144,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>

        <Analytics />
      </body>
    </html>
  );
}
