import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { LayoutGrid } from 'lucide-react';
import { SectionHead } from './section-head';

// 3 · "Así de fácil: 3 pasos" (#como, LANDING-SPEC §3.4). Real crops of the
// Clips wizard (mockups 02, 03, 05) over the app's own step indicator.

const STEPS = [1, 2, 3] as const;

export async function HowItWorks() {
  const t = await getTranslations('landing.how');
  return (
    <section id="como" className="pub-band" aria-labelledby="how-title">
      <div className="pub-wrap">
        <SectionHead id="how-title" label={t('label')} title={t('title')} sub={t('sub')} />
        <ol className="pub-steps">
          {STEPS.map((n) => (
            <li key={n} className="pub-step">
              <div className="pub-step__shot">
                <Image
                  src={`/landing/paso-${n}.webp`}
                  alt={t('alt', { n, titulo: t(`s${n}`) })}
                  width={680}
                  height={270}
                  sizes="(max-width: 1023px) 92vw, 340px"
                  loading="lazy"
                />
              </div>
              <div className="pub-step__ind" aria-hidden="true">
                <span className="pub-step__n">{n}</span>
                <span className="pub-step__bar">
                  {STEPS.map((k) => (
                    <i key={k} data-on={k <= n} />
                  ))}
                </span>
                <span className="pub-step__of">{t('stepOf', { n })}</span>
              </div>
              <h3>{t(`s${n}`)}</h3>
              <p>{t(`s${n}p`)}</p>
            </li>
          ))}
        </ol>
        <p className="pub-pillnote">
          <LayoutGrid aria-hidden="true" />
          {t('note')}
        </p>
      </div>
    </section>
  );
}
