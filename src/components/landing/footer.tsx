import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { FusionMark } from '@/components/dashboard/fusion-mark';

// Minimal footer: copyright + the three links a SaaS landing actually needs.
// The legal pages live under /legal/ (see the comment history in git for the
// CDN-cache reason); /health is the public status endpoint.
export function LandingFooter() {
  const t = useTranslations('landing.footer');

  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer-inner">
        <p className="lp-footer-copy">
          <FusionMark size={18} />
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
        <nav className="lp-footer-links">
          <Link href={'/legal/terms' as Route}>{t('terms')}</Link>
          <Link href={'/legal/privacy' as Route}>{t('privacy')}</Link>
          <Link href={'/health' as Route}>{t('status')}</Link>
        </nav>
      </div>
    </footer>
  );
}
