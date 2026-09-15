import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { KIT_TOOLS } from '@/lib/kit/tools';
import type { PublicFleet } from '@/lib/data/public-engines';
import { signupHref } from './links';

// The kit as the hero: one subscription, many inner tools, on equal footing.
// The preview shows the kit's REAL status from the catalog — no invented
// dashboard KPIs, no "live" badge the app would contradict.
export function Hero({ fleet }: { fleet: PublicFleet }) {
  const t = useTranslations('landing.hero');
  const tp = useTranslations('landing.hero.preview');

  // Catalog rows when we have them; the static kit list (all upcoming) when
  // the catalog is unreachable or empty.
  const tools =
    fleet.engines.length > 0
      ? fleet.engines.map((e) => ({ slug: e.slug, name: e.name, ready: e.ready }))
      : KIT_TOOLS.map((k) => ({ slug: k.slug, name: k.name, ready: false }));
  const readyCount = tools.filter((x) => x.ready).length;

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

        <div className="lp-preview lp-rise lp-d4" aria-hidden="true">
          <div className="lp-preview-bar">
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-dot" />
            <span className="lp-preview-url">chalyb.com/app</span>
          </div>
          <div className="lp-preview-body">
            <div className="lp-preview-main">
              <div className="lp-preview-head">
                <strong>{tp('title')}</strong>
                <span className="lp-status lp-status-kit">{tp('plan')}</span>
              </div>
              <div className="lp-tiles">
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat1')}</div>
                  <div className="lp-tile-val">{tools.length}</div>
                </div>
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat2')}</div>
                  <div className="lp-tile-val lp-up">1</div>
                </div>
                <div className="lp-tile">
                  <div className="lp-tile-label">{tp('stat3')}</div>
                  <div className="lp-tile-val">{readyCount}</div>
                </div>
              </div>
              <div className="lp-preview-foot">{tp('foot')}</div>
            </div>
            <div className="lp-engine-list">
              <div className="lp-engine-list-head">{tp('listTitle')}</div>
              {tools.map((tool) => (
                <div key={tool.slug} className="lp-engine">
                  <span className="lp-engine-name">
                    <i className="lp-engine-icon">◆</i>
                    {tool.name}
                  </span>
                  {tool.ready ? (
                    <span className="lp-status lp-status-live">
                      <i />
                      {tp('statusReady')}
                    </span>
                  ) : (
                    <span className="lp-status lp-status-soon">{tp('statusSoon')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
