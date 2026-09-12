import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { FusionMark } from '@/components/dashboard/fusion-mark';
import { LOGIN_HREF, signupHref } from './links';

// Sticky, two-action header. Brand on the left (→ home), auth on the right.
// Signed-in visitors get a single "Open app" button instead of login/signup;
// /account routes admins to /dashboard and everyone else to /app.
export function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations('landing.nav');

  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-inner">
        <Link href="/" className="lp-brand" aria-label={t('home')}>
          <FusionMark size={26} />
          <span>CHALYB</span>
        </Link>
        <nav className="lp-header-actions">
          {isAuthenticated ? (
            <Link href={'/account' as Route} className="lp-btn lp-btn-sm">
              {t('openApp')}
            </Link>
          ) : (
            <>
              <Link href={LOGIN_HREF} className="lp-link-login">
                {t('login')}
              </Link>
              <Link href={signupHref()} className="lp-btn lp-btn-sm">
                {t('signup')}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
