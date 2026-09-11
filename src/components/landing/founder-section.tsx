'use client';

import { useTranslations } from 'next-intl';
import { FusionLogo } from './fusion-logo';

export function FounderSection() {
  const t = useTranslations('founder');

  return (
    <section id="founder" className="section-pad fdr-section">
      <div className="fdr-card reveal">
        <div className="fdr-mark">
          <FusionLogo id="founderMark" />
        </div>
        <div className="fdr-body">
          <div className="section-num">
            06 — <span>{t('num')}</span>
          </div>
          <h3
            className="fdr-title"
            dangerouslySetInnerHTML={{ __html: t.raw('title') as string }}
          />
          <p>{t('body')}</p>
        </div>
      </div>
    </section>
  );
}
