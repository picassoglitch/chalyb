'use client';

import { useTranslations } from 'next-intl';
import { usePath } from './use-path';

const CPC_STACKS: string[][] = [
  ['Sensors', 'Vision', 'Kiosk'],
  ['Laravel', 'Angular', 'MySQL'],
  ['AWS', 'Terraform', 'PCI DSS'],
];

export function ClientWorld() {
  const t = useTranslations('client');
  const tProcess = useTranslations('process');
  const tSvc = useTranslations('svc');
  const tCpc = useTranslations('cpc');
  const { path } = usePath();
  const recede = path !== null && path !== 'client';

  return (
    <section
      id="client-world"
      className={`section-pad path-section${recede ? ' recede' : ''}`}
      data-world="client"
    >
      <div className="section-head">
        <div>
          <div className="path-tag client">
            <span className="pt-dot" />
            <span>{t('tag')}</span>
          </div>
          <div className="section-num">
            01 — <span>{t('num')}</span>
          </div>
          <h2 className="section-title" dangerouslySetInnerHTML={{ __html: t.raw('title') as string }} />
        </div>
        <p className="section-desc">{t('desc')}</p>
      </div>

      <div className="services-list">
        {[1, 2, 3, 4, 5].map((i, idx) => (
          <div key={i} className={`service-row reveal${idx > 0 ? ` d${Math.min(idx, 3)}` : ''}`}>
            <div className="service-idx">/0{i}</div>
            <div
              className="service-name"
              dangerouslySetInnerHTML={{ __html: tSvc.raw(`${i}.name`) as string }}
            />
            <div className="service-meta">
              {tSvc(`${i}.meta`)} <span className="service-arrow">→</span>
            </div>
          </div>
        ))}
      </div>

      <div className="process-block">
        <div className="process-head">
          <div className="section-num" style={{ color: 'var(--cyan)' }}>
            {tProcess('num')}
          </div>
          <h3 className="process-title">{tProcess('title')}</h3>
        </div>
        <div className="process-grid">
          {[1, 2, 3, 4, 5].map((i, idx) => (
            <div
              key={i}
              className={`process-step reveal${idx > 0 ? ` d${Math.min(idx, 3)}` : ''}`}
            >
              <div className="ps-num">{tProcess(`${i}.num`)}</div>
              <h5 dangerouslySetInnerHTML={{ __html: tProcess.raw(`${i}.title`) as string }} />
              <p>{tProcess(`${i}.body`)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="proof-grid">
        {[1, 2, 3].map((i, idx) => (
          <div key={i} className={`proof-card reveal${idx > 0 ? ` d${idx}` : ''}`}>
            <div className="pc-tag">{tCpc(`${i}.tag`)}</div>
            <h4>{tCpc(`${i}.title`)}</h4>
            <p>{tCpc(`${i}.body`)}</p>
            <dl className="pc-meta">
              <dt>Scale</dt>
              <dd>{tCpc(`${i}.scale`)}</dd>
              <dt>Timeline</dt>
              <dd>{tCpc(`${i}.timeline`)}</dd>
            </dl>
            <div className="pc-stack">
              {CPC_STACKS[i - 1]?.map((s) => <span key={s}>{s}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
