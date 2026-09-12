import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'es'],
  // Mexican Spanish is the default. With 'as-needed', 'es' serves at the root
  // with no prefix and 'en' is served under /en.
  defaultLocale: 'es',
  localePrefix: 'as-needed',
  // The URL is the only thing that decides the language. Accept-Language and
  // cookie detection are OFF, so `/` is always Spanish and `/en` is always
  // English — for every visitor, every time, cached or not. Detection made `/`
  // non-deterministic: the same URL answered in different languages depending
  // on browser settings and on whether the visitor had been served a locale
  // cookie earlier. The footer language switcher is how a reader changes
  // language, and it lands them on a URL that keeps the choice.
  localeDetection: false,
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
