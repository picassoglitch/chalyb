'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link, usePathname, routing } from '@/i18n/routing';

const LABELS: Record<string, string> = { es: 'Español', en: 'English' };

/**
 * Locale switcher for the public footer.
 *
 * The site had no way to change language: `/` resolves via Accept-Language, so
 * a visitor whose browser says `en-US` landed on /en with no route back to the
 * Spanish site (and vice versa). Switching here writes next-intl's NEXT_LOCALE
 * cookie, which takes priority over Accept-Language on every later visit — so
 * the choice sticks instead of being re-detected on each request.
 *
 * `usePathname()` from `@/i18n/routing` returns the locale-stripped path, so
 * the link keeps the visitor on the page they are reading.
 */
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="lp-lang" role="group" aria-label={t('label')}>
      {routing.locales.map((target) => {
        const isActive = target === locale;
        return (
          <Link
            key={target}
            href={pathname as Route}
            locale={target}
            className={`lp-lang-opt${isActive ? ' is-active' : ''}`}
            hrefLang={target}
            aria-current={isActive ? 'page' : undefined}
            prefetch={false}
          >
            {LABELS[target] ?? target.toUpperCase()}
          </Link>
        );
      })}
    </div>
  );
}
