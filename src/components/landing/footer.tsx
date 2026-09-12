import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { BrandMark } from './brand-mark';

const YEAR = 2026;

/** Minimal footer: brand, copyright, and the legal/status links only. */
export function LandingFooter() {
  const t = useTranslations('landing.footer');

  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer-inner">
        <div className="lp-footer-brand">
          <span className="lp-brand">
            <BrandMark size={20} />
            <span>CHALYB</span>
          </span>
          <span className="lp-footer-copy">{t('rights', { year: YEAR })}</span>
        </div>
        <nav className="lp-footer-links" aria-label="Legal">
          {/* Real legal pages — required public URLs for OAuth provider apps
              (Google, Mercado Pago) and consumer-law compliance in MX. */}
          <Link href={'/legal/terms' as Route}>{t('terms')}</Link>
          <Link href={'/legal/privacy' as Route}>{t('privacy')}</Link>
          <a href="/api/health" target="_blank" rel="noreferrer">
            {t('status')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
