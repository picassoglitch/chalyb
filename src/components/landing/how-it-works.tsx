import { useTranslations } from 'next-intl';

interface Step {
  num: string;
  title: string;
  body: string;
}

export function HowItWorks() {
  const t = useTranslations('landing.how');
  const steps = t.raw('steps') as Step[];

  return (
    <section className="lp-section lp-section-alt" id="how-it-works">
      <div className="lp-wrap">
        <div className="lp-section-head center">
          <p className="lp-kicker">{t('kicker')}</p>
          <h2>{t('title')}</h2>
        </div>
        <ol className="lp-steps">
          {steps.map((step) => (
            <li key={step.num} className="lp-step">
              <p className="lp-step-num">{step.num}</p>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
