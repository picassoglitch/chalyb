'use client';

import { useTranslations } from 'next-intl';

export function BuildingSection() {
  const t = useTranslations('building');

  return (
    <section id="building" className="section-pad">
      <div className="section-head">
        <div>
          <div className="section-num">
            05 — <span>{t('num')}</span>
          </div>
          <h2
            className="section-title"
            dangerouslySetInnerHTML={{ __html: t.raw('title') as string }}
          />
        </div>
        <p className="section-desc">{t('desc')}</p>
      </div>

      <div className="bld-grid">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bld-card reveal">
            <div className="bld-tag">
              <span className="bld-dot" />
              {t(`items.${i}.tag`)}
            </div>
            <h4>{t(`items.${i}.title`)}</h4>
            <p>{t(`items.${i}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
