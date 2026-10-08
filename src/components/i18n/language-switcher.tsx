'use client';

import { Fragment } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link, usePathname, routing } from '@/i18n/routing';

const LABELS: Record<string, string> = { es: 'Español', en: 'English' };

// Spanish first, as the footer always read ("Español · English"); LOCALES
// itself is ordered en, es.
const ORDER = [...routing.locales].sort((a, b) =>
  a === routing.defaultLocale ? -1 : b === routing.defaultLocale ? 1 : 0,
);

/**
 * Locale switcher for the public footer.
 *
 * The URL is the only thing that decides the language (`localeDetection` is
 * off in src/i18n/routing.ts): `/…` is Spanish and `/en/…` is English. This
 * switcher is how a reader changes language, so it must link BOTH ways and
 * keep them on the page they are reading.
 *
 * `usePathname()` from `@/i18n/routing` returns the locale-stripped path, so
 * the link keeps the visitor on the page they are reading. The hash (e.g.
 * `#precios`) is not part of the pathname and is dropped, which is fine.
 */
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="pub-foot__lang" role="group" aria-label={t('label')}>
      {ORDER.map((target, i) => {
        const isActive = target === locale;
        return (
          <Fragment key={target}>
            {i > 0 && (
              <span className="pub-foot__lang-sep" aria-hidden="true">
                ·
              </span>
            )}
            <Link
              href={pathname as Route}
              locale={target}
              className={`pub-foot__lang-opt${isActive ? ' is-active' : ''}`}
              hrefLang={target}
              lang={target}
              aria-current={isActive ? 'page' : undefined}
              data-foot-target={target}
              prefetch={false}
            >
              {LABELS[target] ?? target.toUpperCase()}
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}
