import { getTranslations } from 'next-intl/server';
import { SectionHead } from './section-head';

// 3 · Cómo funciona (#como), 3 steps.

export async function HowItWorks() {
  const t = await getTranslations('landing.how');
  return (
    <section id="como" className="pub-band" aria-labelledby="how-title">
      <div className="pub-wrap">
        <SectionHead id="how-title" label={t('label')} title={t('title')} />
        <ol className="pub-steps">
          {(['1', '2', '3'] as const).map((n) => (
            <li key={n} className="pub-step">
              <span className="pub-step__n" aria-hidden="true">
                {n}
              </span>
              <h3>{t(`s${n}`)}</h3>
              <p>{t(`s${n}p`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
