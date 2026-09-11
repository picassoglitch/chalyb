'use client';

import { useTranslations } from 'next-intl';
import { usePath } from './use-path';

const PV_ICONS = ['◇', '◆', '⬡'];

export function PartnerWorld() {
  const t = useTranslations('partner');
  const tPv = useTranslations('pv');
  const tHow = useTranslations('how');
  const tEquity = useTranslations('equity');
  const { path } = usePath();
  const recede = path !== null && path !== 'partner';

  return (
    <section
      id="partner-world"
      className={`section-pad path-section${recede ? ' recede' : ''}`}
      data-world="partner"
    >
      <div className="section-head">
        <div>
          <div className="path-tag partner">
            <span className="pt-dot" />
            <span>{t('tag')}</span>
          </div>
          <div className="section-num">
            02 — <span>{t('num')}</span>
          </div>
          <h2
            className="section-title"
            dangerouslySetInnerHTML={{ __html: t.raw('title') as string }}
          />
        </div>
        <p className="section-desc">{t('desc')}</p>
      </div>

      <div className="partner-hero">
        <div>
          <h3 dangerouslySetInnerHTML={{ __html: t.raw('hero.title') as string }} />
          <p>{t('hero.p1')}</p>
          <p>{t('hero.p2')}</p>
        </div>
        <div className="partner-visual reveal">
          {[1, 2, 3].map((i) => (
            <div key={i} className="pv-row">
              <div className="pv-icon">{PV_ICONS[i - 1]}</div>
              <div className="pv-txt">
                <h5>{tPv(`${i}.title`)}</h5>
                <p>{tPv(`${i}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="partner-how">
        {[1, 2, 3, 4].map((i, idx) => (
          <div key={i} className={`how-step reveal${idx > 0 ? ` d${Math.min(idx, 3)}` : ''}`}>
            <div className="hs-num">{tHow(`${i}.num`)}</div>
            <h5>{tHow(`${i}.title`)}</h5>
            <p>{tHow(`${i}.body`)}</p>
          </div>
        ))}
      </div>

      <div className="equity-note reveal">
        <p dangerouslySetInnerHTML={{ __html: tEquity.raw('note') as string }} />
      </div>
    </section>
  );
}
