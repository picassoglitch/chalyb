import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { signupHref } from './links';

export function FinalCta() {
  const t = useTranslations('landing.cta');

  return (
    <section className="lp-cta">
      <div className="lp-container">
        <div className="lp-cta-banner">
          <h2>{t('title')}</h2>
          <p>{t('body')}</p>
          <Link href={signupHref()} className="lp-btn lp-btn-dark lp-btn-lg">
            {t('btn')}
            <span className="lp-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p className="lp-micro lp-micro-dark">{t('micro')}</p>
        </div>
      </div>
    </section>
  );
}
