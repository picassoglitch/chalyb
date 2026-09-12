import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { signupHref } from './links';

export function FinalCta() {
  const t = useTranslations('landing.cta');

  return (
    <section className="lp-final">
      <div className="lp-wrap">
        <div className="lp-final-card">
          <h2>{t.rich('title', { em: (chunks) => <em>{chunks}</em> })}</h2>
          <p>{t('sub')}</p>
          <div className="lp-hero-cta">
            <Link href={signupHref()} className="lp-btn lp-btn-lg">
              {t('btn')} <span aria-hidden="true">→</span>
            </Link>
            <p className="lp-micro">{t('micro')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
