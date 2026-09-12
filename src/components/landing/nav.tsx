import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { BrandMark } from './brand-mark';
import { APP_HREF, LOGIN_HREF, signupHref } from './links';

/**
 * Sticky, minimal header shared by the landing, /contacto and the legal
 * pages. Left: brand (→ home). Right: a subtle "Log in" link and the single
 * high-contrast conversion button. No section links, no menus.
 */
export function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations('landing.nav');

  return (
    <header className="lp-nav">
      <Link href={'/' as Route} className="lp-brand" aria-label="Chalyb">
        <BrandMark />
        <span>CHALYB</span>
      </Link>
      <nav className="lp-nav-actions" aria-label="Account">
        {isAuthenticated ? (
          <Link href={APP_HREF} className="lp-btn lp-btn-primary lp-btn-sm">
            {t('app')}
          </Link>
        ) : (
          <>
            <Link href={LOGIN_HREF} className="lp-nav-login">
              {t('login')}
            </Link>
            <Link href={signupHref()} className="lp-btn lp-btn-primary lp-btn-sm">
              {t('signup')}
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
