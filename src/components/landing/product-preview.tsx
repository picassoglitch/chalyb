import { useTranslations } from 'next-intl';
import { Waveform } from './mock-bits';

interface PreviewRow {
  name: string;
  status: string;
}

// Static dashboard mockup under the hero. Decorative: the copy is what sells,
// this just shows the shape of the product, so it's hidden from the a11y tree.
export function ProductPreview() {
  const t = useTranslations('landing.hero.preview');
  const nav = t.raw('nav') as string[];
  const rows = t.raw('rows') as PreviewRow[];

  return (
    <div className="lp-preview" aria-hidden="true">
      <div className="lp-preview-bar">
        <i />
        <i />
        <i />
        <span className="lp-preview-url">{t('url')}</span>
      </div>
      <div className="lp-preview-body">
        <aside className="lp-preview-side">
          {nav.map((item, i) => (
            <span key={item} className={i === 0 ? 'on' : undefined}>
              {item}
            </span>
          ))}
        </aside>
        <div className="lp-preview-main">
          <div className="lp-preview-head">
            <h4>{t('title')}</h4>
            <span className="lp-pill">
              <i />
              {t('live')}
            </span>
          </div>
          <div className="lp-stats">
            <div className="lp-stat">
              <small>{t('stat1')}</small>
              <b>42</b>
            </div>
            <div className="lp-stat">
              <small>{t('stat2')}</small>
              <b className="up">318k</b>
            </div>
            <div className="lp-stat">
              <small>{t('stat3')}</small>
              <b>36</b>
            </div>
          </div>
          <div className="lp-wave">
            <Waveform />
          </div>
          <div className="lp-rows">
            {rows.map((row, i) => (
              <div key={row.name} className="lp-row">
                <span>{row.name}</span>
                <span className={i === 0 ? 'ok' : undefined}>{row.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
