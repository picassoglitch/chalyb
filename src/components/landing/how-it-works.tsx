import { useTranslations } from 'next-intl';

export function HowItWorks() {
  const t = useTranslations('landing.how');

  return (
    <section className="lp-section lp-section-alt" id="how-it-works">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-h2">{t('title')}</h2>
          <p className="lp-sub">{t('subtitle')}</p>
        </div>
        <ol className="lp-steps">
          {[1, 2, 3].map((n) => (
            <li key={n} className="lp-step">
              <span className="lp-step-num">0{n}</span>
              <h3>{t(`steps.${n}.title`)}</h3>
              <p>{t(`steps.${n}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
