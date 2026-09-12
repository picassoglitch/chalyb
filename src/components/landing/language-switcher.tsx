'use client';

import NextLink from 'next/link';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { getPathname, usePathname, routing } from '@/i18n/routing';

// ES ↔ EN switch for the public pages (landing, legal, contact).
//
// Locale detection is off (see src/i18n/routing.ts), so the URL is the only
// way to change language — this is that control. `usePathname` gives the
// current path with the locale prefix stripped, so the switch stays on the
// page the visitor is reading instead of dropping them on the home page.
// Each label is written in the language it selects, so it is recognizable
// from either side.
//
// The hrefs come from `getPathname` and go to a plain next/link: next-intl's
// own `Link` force-prefixes whenever it's given an explicit `locale`, which
// would point Spanish at /es/… and cost a redirect on every switch back to
// the unprefixed default.
const LOCALES = [
  routing.defaultLocale,
  ...routing.locales.filter((locale) => locale !== routing.defaultLocale),
];

export function LanguageSwitcher() {
  const t = useTranslations('localeSwitcher');
  const active = useLocale();
  const pathname = usePathname();

  return (
    <nav className="lp-lang" aria-label={t('label')}>
      {LOCALES.map((locale) => (
        <NextLink
          key={locale}
          href={getPathname({ href: pathname, locale }) as Route}
          hrefLang={locale}
          prefetch={false}
          className={`lp-lang-link${locale === active ? ' is-active' : ''}`}
          aria-current={locale === active ? 'true' : undefined}
        >
          {t(locale)}
        </NextLink>
      ))}
    </nav>
  );
}
