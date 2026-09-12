import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { signupHref } from './links';
import { ProductPreview } from './product-preview';

export function Hero() {
  const t = useTranslations('landing.hero');

  return (
    <section className="lp-hero">
      <div className="lp-wrap">
        <p className="lp-kicker">{t('kicker')}</p>
        <h1>{t.rich('h1', { em: (chunks) => <em>{chunks}</em> })}</h1>
        <p className="lp-lead">{t('lead')}</p>
        <div className="lp-hero-cta">
          <Link href={signupHref()} className="lp-btn lp-btn-lg">
            {t('cta')} <span aria-hidden="true">→</span>
          </Link>
          <p className="lp-micro">{t('micro')}</p>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}
