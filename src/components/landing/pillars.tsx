import { useTranslations } from 'next-intl';

/* ── Illustrations ──────────────────────────────────────────────────────
   Static, CSS-built UI snippets. Each mirrors a real /app surface so the
   copy next to it is describing something the visitor will actually see. */

function LibraryVisual() {
  const t = useTranslations('landing.pillars.visuals');
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('libraryTitle')}</div>
      <div className="lp-engine-list">
        <div className="lp-engine">
          <span className="lp-engine-name">
            <i className="lp-engine-icon">◆</i>ChalybClip
            <small>{t('libraryClip')}</small>
          </span>
          <span className="lp-status lp-status-live">
            <i />
            {t('ready')}
          </span>
        </div>
        <div className="lp-engine">
          <span className="lp-engine-name">
            <i className="lp-engine-icon">▲</i>ChalybCrypto
            <small>{t('libraryCrypto')}</small>
          </span>
          <span className="lp-status lp-status-live">
            <i />
            {t('ready')}
          </span>
        </div>
        <div className="lp-engine">
          <span className="lp-engine-name">
            <i className="lp-engine-icon">●</i>ChalybOBS
            <small>{t('libraryObs')}</small>
          </span>
          <span className="lp-status lp-status-soon">{t('soon')}</span>
        </div>
      </div>
    </div>
  );
}

function SimulationVisual() {
  const t = useTranslations('landing.pillars.visuals');
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('modeTitle')}</div>
      <div className="lp-mode-row">
        <div>
          <div className="lp-mode-name">ChalybClip</div>
          <div className="lp-mode-sub">{t('modeSim')}</div>
        </div>
        <span className="lp-switch" data-on="false" />
      </div>
      <div className="lp-mode-row lp-mode-row-on">
        <div>
          <div className="lp-mode-name">ChalybClip</div>
          <div className="lp-mode-sub lp-up">{t('modeLive')}</div>
        </div>
        <span className="lp-switch" data-on="true" />
      </div>
      <div className="lp-visual-foot">{t('modeFoot')}</div>
    </div>
  );
}

function UsageVisual() {
  const t = useTranslations('landing.pillars.visuals');
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('usageTitle')}</div>
      <div className="lp-meter">
        <div className="lp-meter-row">
          <span>{t('usageTokens')}</span>
          <strong>312k / 1M</strong>
        </div>
        <div className="lp-meter-bar">
          <i style={{ width: '31%' }} />
        </div>
      </div>
      <div className="lp-history">
        <div className="lp-history-row">
          <span>ChalybClip · {t('usageRun')} #1284</span>
          <span className="lp-up">{t('usageOk')}</span>
        </div>
        <div className="lp-history-row">
          <span>ChalybClip · {t('usageRun')} #1283</span>
          <span className="lp-up">{t('usageOk')}</span>
        </div>
        <div className="lp-history-row">
          <span>ChalybCrypto · {t('usageRun')} #0912</span>
          <span className="lp-up">{t('usageOk')}</span>
        </div>
      </div>
    </div>
  );
}

const VISUALS = [LibraryVisual, SimulationVisual, UsageVisual] as const;

/** Exactly three benefit pillars in an alternating two-column layout. */
export function Pillars() {
  const t = useTranslations('landing.pillars');

  return (
    <section className="lp-section" id="features">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-h2">{t('title')}</h2>
          <p className="lp-sub">{t('subtitle')}</p>
        </div>

        {VISUALS.map((Visual, idx) => {
          const n = idx + 1;
          return (
            <article key={n} className={`lp-pillar${idx % 2 === 1 ? ' lp-pillar-flip' : ''}`}>
              <div className="lp-pillar-copy">
                <p className="lp-kicker">{t(`items.${n}.kicker`)}</p>
                <h3>{t(`items.${n}.title`)}</h3>
                <p>{t(`items.${n}.body`)}</p>
                <ul className="lp-checks">
                  {[1, 2, 3].map((b) => (
                    <li key={b}>
                      <span className="lp-check" aria-hidden="true">
                        ✓
                      </span>
                      {t(`items.${n}.bullets.${b}`)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lp-pillar-visual" aria-hidden="true">
                <Visual />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
