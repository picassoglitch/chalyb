'use client';

import { useTranslations } from 'next-intl';

export function OperatingSection() {
  const t = useTranslations('operate');
  const tWhy = useTranslations('operate.why');

  return (
    <section id="operate" className="section-pad path-section">
      <div className="section-head">
        <div>
          <div className="section-num">
            01.0 — <span>{t('num')}</span>
          </div>
          <h2
            className="section-title"
            dangerouslySetInnerHTML={{ __html: t.raw('title') as string }}
          />
        </div>
        <p className="section-desc">{t('desc')}</p>
      </div>

      <div className="op-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="op-card reveal">
            <div className="op-idx">/0{i}</div>
            <h5>{t(`items.${i}.title`)}</h5>
            <p>{t(`items.${i}.body`)}</p>
          </div>
        ))}
      </div>

      <div className="op-why reveal">
        <h4>{tWhy('title')}</h4>
        <ul>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <li key={i}>
              <span className="op-tick">✓</span>
              {tWhy(`items.${i}`)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
