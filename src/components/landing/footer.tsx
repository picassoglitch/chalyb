import { useTranslations } from 'next-intl';
import type { Route } from 'next';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { BrandMark } from './brand-mark';

const YEAR = 2026;

/** Minimal footer: brand, copyright, language switcher, and the legal/contact/status links. */
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
          {/* /contacto is the only support channel we publish; without this
              link the page was reachable only by typing the URL. */}
          <Link href={'/contacto' as Route}>{t('contact')}</Link>
          <Link href={'/partners' as Route}>{t('partners')}</Link>
          <a href="/api/health" target="_blank" rel="noreferrer">
            {t('status')}
          </a>
        </nav>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
