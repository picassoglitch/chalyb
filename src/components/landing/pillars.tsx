import { useTranslations } from 'next-intl';
import { KIT_TOOLS } from '@/lib/kit/tools';
import type { PublicFleet } from '@/lib/data/public-engines';

/* ── Illustrations ──────────────────────────────────────────────────────
   Static, CSS-built UI snippets. Each mirrors a real /app surface and shows
   only what the visitor will actually see: the kit list carries the real
   catalog status, the plan ladder states plan facts, the usage tile lists the
   token allocations from the plans — no invented runs or meters. */

function LibraryVisual({ fleet }: { fleet: PublicFleet }) {
  const t = useTranslations('landing.pillars.visuals');
  const tools =
    fleet.engines.length > 0
      ? fleet.engines.slice(0, 4)
      : KIT_TOOLS.slice(0, 4).map((k) => ({ slug: k.slug, name: k.name, ready: false }));
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('libraryTitle')}</div>
      <div className="lp-engine-list">
        {tools.map((tool) => (
          <div key={tool.slug} className="lp-engine">
            <span className="lp-engine-name">
              <i className="lp-engine-icon">◆</i>
              {tool.name}
            </span>
            {tool.ready ? (
              <span className="lp-status lp-status-live">
                <i />
                {t('ready')}
              </span>
            ) : (
              <span className="lp-status lp-status-soon">{t('soon')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanLadderVisual() {
  const t = useTranslations('landing.pillars.visuals');
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('modeTitle')}</div>
      <div className="lp-mode-row">
        <div>
          <div className="lp-mode-name">{t('modeFree')}</div>
        </div>
        <span className="lp-switch" data-on="false" />
      </div>
      <div className="lp-mode-row lp-mode-row-on">
        <div>
          <div className="lp-mode-name">{t('modePro')}</div>
        </div>
        <span className="lp-switch" data-on="true" />
      </div>
      <div className="lp-mode-row lp-mode-row-on">
        <div>
          <div className="lp-mode-name">{t('modeVip')}</div>
        </div>
        <span className="lp-switch" data-on="true" />
      </div>
      <div className="lp-visual-foot">{t('modeFoot')}</div>
    </div>
  );
}

function IncludedVisual() {
  const t = useTranslations('landing.pillars.visuals');
  const rows = [
    { plan: t('usageFree'), tokens: '50k', pct: 5 },
    { plan: t('usagePro'), tokens: '1M', pct: 20 },
    { plan: t('usageVip'), tokens: '5M', pct: 100 },
  ];
  return (
    <div className="lp-visual">
      <div className="lp-visual-head">{t('usageTitle')}</div>
      <div className="lp-meter">
        <div className="lp-meter-row">
          <span>{t('usageTokens')}</span>
        </div>
        {rows.map((r) => (
          <div key={r.plan} className="lp-meter-row lp-meter-row-plan">
            <span>{r.plan}</span>
            <span className="lp-meter-bar">
              <i style={{ width: `${r.pct}%` }} />
            </span>
            <strong>{r.tokens}</strong>
          </div>
        ))}
      </div>
      <div className="lp-visual-foot">{t('usageFoot')}</div>
    </div>
  );
}

/** Exactly three benefit pillars in an alternating two-column layout. */
export function Pillars({ fleet }: { fleet: PublicFleet }) {
  const t = useTranslations('landing.pillars');
  const visuals = [
    <LibraryVisual key="lib" fleet={fleet} />,
    <PlanLadderVisual key="plan" />,
    <IncludedVisual key="inc" />,
  ];

  return (
    <section className="lp-section" id="features">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-h2">{t('title')}</h2>
          <p className="lp-sub">{t('subtitle')}</p>
        </div>

        {visuals.map((visual, idx) => {
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
                {visual}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
