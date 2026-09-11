import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['en', 'es'],
  // Mexican Spanish is the default; English-speaking browsers still get 'en'
  // via next-intl's Accept-Language detection (left on). With 'as-needed',
  // 'es' serves at the root with no prefix and 'en' is served under /en.
  defaultLocale: 'es',
  localePrefix: 'as-needed',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
