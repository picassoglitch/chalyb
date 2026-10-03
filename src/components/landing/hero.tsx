import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Check } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { ToolTile } from './tool-tile';
import { heroRows, type PublicTool } from '@/lib/tools/public-tools';

// 1 · Hero. The "Mientras dormías" panel is an illustration: one example row
// per active tool (at most 4), an example clip still, and the "Ejemplo" tag
// (P4-4). No real names or invented numbers. The clip still is a Kick-style
// stream reaction (neon green), without any platform logo or UI.

const OK_PILL = new Set(['chalybclip', 'chalybobs', 'chalybbot', 'chalybtrade']);

export async function Hero({ tools, trialHref }: { tools: PublicTool[]; trialHref: Route }) {
  const t = await getTranslations('landing');
  const rows = heroRows(tools);

  return (
    <section id="hero" className="pub-wrap pub-hero" aria-labelledby="hero-title">
      <div className="pub-hero__copy">
        <p className="pub-kick">
          <span>{t('hero.eyebrowTag')}</span>
          {t('hero.eyebrow')}
        </p>
        <h1 id="hero-title">{t.rich('hero.title', { em: (chunks) => <em>{chunks}</em> })}</h1>
        <p className="pub-hero__sub">
          <span className="pub-only-desk">{t('hero.sub')}</span>
          <span className="pub-only-mob">{t('hero.subMobile')}</span>
        </p>
        <div className="pub-hero__cta">
          <Link
            href={trialHref}
            className="ch-btn ch-btn--primary ch-btn--xl"
            data-cta="trial-hero"
          >
            {t('cta')}
          </Link>
          <small>{t('ctaSub')}</small>
        </div>
        <ul className="pub-trust">
          {(['seal1', 'seal2', 'seal3'] as const).map((k) => (
            <li key={k}>
              <Check aria-hidden="true" />
              {t(`hero.${k}`)}
            </li>
          ))}
        </ul>
      </div>

      <div className="pub-vis" aria-label={t('hero.panel')} role="group">
        <div className="pub-vis__panel">
          <div className="pub-vis__head">
            <h2>{t('hero.panel')}</h2>
            <span className="ch-tag-ej">{t('hero.example')}</span>
          </div>
          <ul>
            {rows.map((tool) => (
              <li key={tool.slug} className="pub-vis__it">
                <ToolTile slug={tool.slug} color={tool.color} />
                <span className="pub-vis__tx">
                  <b>{t(`hero.rows.${tool.slug}.label`)}</b>
                  <small>{t(`hero.rows.${tool.slug}.detail`)}</small>
                </span>
                <span
                  className={`ch-pill ${OK_PILL.has(tool.slug) ? 'ch-pill--ok' : 'ch-pill--acc'}`}
                >
                  {t(`hero.rows.${tool.slug}.pill`)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div
          className="pub-vis__float pub-thumb pub-thumb--hero"
          role="img"
          aria-label={t('hero.frameAlt')}
        />
      </div>
    </section>
  );
}
