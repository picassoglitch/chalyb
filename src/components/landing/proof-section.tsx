'use client';

import { useTranslations } from 'next-intl';

export function ProofSection() {
  const t = useTranslations('proof');
  const tPos = useTranslations('position');
  return (
    <section id="proof" className="section-pad">
      <div className="section-head">
        <div>
          <div className="section-num">
            00 — <span>{t('num')}</span>
          </div>
          <h2
            className="section-title"
            dangerouslySetInnerHTML={{ __html: t.raw('title') as string }}
          />
        </div>
        <p className="section-desc">{t('desc')}</p>
      </div>

      <p className="position-line reveal">{tPos('line')}</p>

      <div className="proof-stats proof-stats-8 reveal">
        <div className="stat">
          <div className="num">
            14<span className="unit">+</span>
          </div>
          <div className="label">{t('stat1')}</div>
        </div>
        <div className="stat">
          <div className="num">
            PCI<span className="unit"> DSS 4.0</span>
          </div>
          <div className="label">{t('stat2')}</div>
        </div>
        <div className="stat">
          <div className="num">
            8<span className="unit">+</span>
          </div>
          <div className="label">{t('stat3')}</div>
        </div>
        <div className="stat">
          <div className="num">
            3<span className="unit"> {t('units.verticals')}</span>
          </div>
          <div className="label">{t('stat4')}</div>
        </div>
        <div className="stat">
          <div className="num">
            99.9<span className="unit">%</span>
          </div>
          <div className="label">{t('stat5')}</div>
        </div>
        <div className="stat">
          <div className="num">24/7</div>
          <div className="label">{t('stat6')}</div>
        </div>
        <div className="stat">
          <div className="num">
            MX<span className="unit"> · USA</span>
          </div>
          <div className="label">{t('stat7')}</div>
        </div>
        <div className="stat">
          <div className="num">
            IaC<span className="unit"> · multi-env</span>
          </div>
          <div className="label">{t('stat8')}</div>
        </div>
      </div>

      <p
        className="proof-line reveal d1"
        dangerouslySetInnerHTML={{ __html: t.raw('line') as string }}
      />
    </section>
  );
}
