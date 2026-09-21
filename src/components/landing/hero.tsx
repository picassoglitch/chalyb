import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { signupHref } from './links';
import { ENGINE_DISPLAY_NAMES } from '@/lib/engines/display-names';

const CHART_LINE =
  'M0,88 L28,80 L56,84 L84,66 L112,70 L140,52 L168,58 L196,40 L224,46 L252,30 L280,36 L308,22 L336,28 L364,14 L392,18';

export function Hero() {
  const t = useTranslations('landing.hero');
  const tp = useTranslations('landing.hero.preview');

  return (
    <section className="lp-hero">
      <div className="lp-container">
        <p className="lp-kicker lp-rise">{t('kicker')}</p>
        <h1 className="lp-h1 lp-rise lp-d1">{t('h1')}</h1>
        <p className="lp-lead lp-rise lp-d2">{t('lead')}</p>
        <div className="lp-hero-cta lp-rise lp-d3">
          <Link href={signupHref()} className="lp-btn lp-btn-primary lp-btn-lg">
            {t('cta')}
            <span className="lp-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <p className="lp-micro">{t('micro')}</p>
        </div>

        {/* Product preview — a static, CSS-built snapshot of the /app engines
            dashboard. No live data, no animation loops. */}
        <div className="lp-preview lp-rise lp-d4" aria-hidden="true">
          <div className="lp-preview-bar">
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-preview-url">app.chalyb.com/app</span>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-main">
              <div className="lp-preview-head">
                <strong>{tp('title')}</strong>
                <span className="lp-status lp-status-live">
                  <i />
                  {tp('live')}
                </span>
              </div>
              <div className="lp-tiles">
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat1')}</div>
                  <div className="lp-tile-val">1</div>
                </div>
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat2')}</div>
                  <div className="lp-tile-val lp-up">34</div>
                </div>
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat3')}</div>
                  <div className="lp-tile-val">312k</div>
                </div>
              </div>
              <div className="lp-chart">
                <div className="lp-chart-label">{tp('chart')}</div>
                <svg viewBox="0 0 392 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lpChartFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f7ce87" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#f7ce87" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${CHART_LINE} L392,100 L0,100 Z`} fill="url(#lpChartFill)" />
                  <path d={CHART_LINE} fill="none" stroke="#f7ce87" strokeWidth="2" />
                </svg>
              </div>
            </div>
            <div className="lp-engine-list">
              <div className="lp-engine">
                <span className="lp-engine-name">
                  <i className="lp-engine-icon">◆</i>
                  {ENGINE_DISPLAY_NAMES.chalybclip}
                </span>
                <span className="lp-status lp-status-live">
                  <i />
                  {tp('statusLive')}
                </span>
              </div>
              <div className="lp-engine">
                <span className="lp-engine-name">
                  <i className="lp-engine-icon">▲</i>
                  {ENGINE_DISPLAY_NAMES.chalybcrypto}
                </span>
                <span className="lp-status lp-status-sim">{tp('statusSim')}</span>
              </div>
              <div className="lp-engine">
                <span className="lp-engine-name">
                  <i className="lp-engine-icon">●</i>
                  {ENGINE_DISPLAY_NAMES.chalybobs}
                </span>
                <span className="lp-status lp-status-soon">{tp('statusSoon')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
