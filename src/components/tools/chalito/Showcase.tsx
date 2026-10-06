import { getLocale, getTranslations } from 'next-intl/server';
import { ROSTER } from '@chalito/roster';
import type { AppLocale } from '@/i18n/locales';
import { showcase, type ShowcaseAsset } from '@/lib/chalito/web/showcase';

// The standalone landing's renders, inside the hub: under Chalito's Inicio, for people who are
// already in (no sign-in CTA, no plans — the hub's plan pill covers that).
export const HERO = showcase('hero-chalito');
const ROSTER_CARDS = ROSTER.map((r) => ({ name: r.name, asset: showcase(`roster-${r.id}`) }));
const TRYON = [
  showcase('tryon-chalito-viking'),
  showcase('tryon-luna-crown'),
  showcase('tryon-bruno-cape'),
];
const RECHARGE = showcase('recharge-chalito');
const ROOM = showcase('room-portal');

/** A real render. Animated ones fall back to their poster under prefers-reduced-motion. */
export const Render = ({
  asset,
  locale,
  eager = false,
  className = '',
}: {
  asset: ShowcaseAsset;
  locale: AppLocale;
  eager?: boolean;
  className?: string;
}) => (
  <picture>
    {asset.poster ? (
      <source media="(prefers-reduced-motion: reduce)" srcSet={asset.poster} type="image/webp" />
    ) : null}
    <img
      src={asset.src}
      width={asset.w}
      height={asset.h}
      alt={asset.alt[locale]}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
      decoding="async"
      data-showcase={asset.id}
      className={`h-auto w-full ${className}`}
    />
  </picture>
);

export const Showcase = async () => {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations('chalito.landing');
  return (
    <div className="grid gap-16 pb-8">
      <section className="grid gap-4" aria-labelledby="chalito-roster">
        <h2 id="chalito-roster" className="text-2xl font-semibold">
          {t('roster.title')}
        </h2>
        <p>{t('roster.body')}</p>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {ROSTER_CARDS.map((c) => (
            <li key={c.asset.id} className="grid gap-1 text-center">
              <Render asset={c.asset} locale={locale} />
              <span className="font-medium">{c.name[locale]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4" aria-labelledby="chalito-tryon">
        <h2 id="chalito-tryon" className="text-2xl font-semibold">
          {t('tryon.title')}
        </h2>
        <p>{t('tryon.body')}</p>
        <div className="grid grid-cols-3 gap-4">
          {TRYON.map((a) => (
            <Render key={a.id} asset={a} locale={locale} />
          ))}
        </div>
      </section>

      <section className="grid items-center gap-6 sm:grid-cols-2" aria-labelledby="chalito-together">
        <Render asset={ROOM} locale={locale} />
        <div className="grid gap-3">
          <h2 id="chalito-together" className="text-2xl font-semibold">
            {t('together.title')}
          </h2>
          <p>{t('together.body')}</p>
        </div>
      </section>

      <section className="grid items-center gap-6 sm:grid-cols-2" aria-labelledby="chalito-recharge">
        <div className="grid gap-3">
          <h2 id="chalito-recharge" className="text-2xl font-semibold">
            {t('recharge.title')}
          </h2>
          <p>{t('recharge.body')}</p>
        </div>
        <Render asset={RECHARGE} locale={locale} className="mx-auto max-w-xs" />
      </section>
    </div>
  );
};
