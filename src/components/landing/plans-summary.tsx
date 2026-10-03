import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { Gift } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { annualMath, floorToPeso, pct, planPrice } from '@/config/pricing';
import { loadPriceDisplay } from '@/lib/billing/price-display';
import { ReferencePrice } from '@/components/app/billing/reference-price';
import { formatMXN } from '@/lib/billing/format';
import { PLANES_HREF, freeCtaHref, vipCtaHref } from './links';
import { SectionHead } from './section-head';

// 6 · Planes (#planes, alias #pricing), the summary. Every amount comes from
// the pricing config. Pro leads with its monthly price (owner, 2026-10-02:
// a yearly total next to VIP's monthly one read as "Pro costs more"); the
// annual offer sits under it — 1er mes gratis, the monthly equivalent, the
// savings and the yearly total. The block says "IVA incluido". Never
// "2 meses gratis" and never a struck-through price.
// On mobile, Pro comes first (CSS order).

export async function PlansSummary({
  signedIn,
  trialHref,
}: {
  signedIn: boolean;
  trialHref: Route;
}) {
  const t = await getTranslations('landing');
  const priceDisplay = await loadPriceDisplay({});
  const tb = await getTranslations('billing.price');
  const math = annualMath();
  const year = planPrice('pro_year').totalCents;
  const month = planPrice('pro_month').totalCents;
  const vip = planPrice('vip_month').totalCents;

  return (
    <section id="planes" className="pub-band pub-band--white" aria-labelledby="plans-title">
      {/* Old links pointed at #pricing; keep them landing here. */}
      <span id="pricing" aria-hidden="true" />
      <div className="pub-wrap">
        <SectionHead
          id="plans-title"
          label={t('plans.label')}
          title={t('plans.title')}
          sub={t('plans.sub')}
        />
        <div className="pub-plans" data-testid="plans-summary">
          <section className="pub-pl pub-pl--gratis" aria-labelledby="pl-gratis">
            <h3 id="pl-gratis">{t('plans.gratis')}</h3>
            <p className="pub-pl__pr" data-price="gratis">
              {formatMXN(0)}
            </p>
            <p className="pub-pl__pn">{tb('free')}</p>
            <Link href={freeCtaHref(signedIn)} className="ch-btn ch-btn--secondary">
              {t('plans.gratisCta')}
            </Link>
          </section>

          <section className="pub-pl pub-pl--hi" aria-labelledby="pl-pro">
            <span className="pub-pl__tag">{t('plans.badge')}</span>
            <h3 id="pl-pro">{t('plans.pro')}</h3>
            <p className="pub-pl__pr" data-price="pro_month">
              {formatMXN(month)} <span className="pub-pl__per">{t('plans.perMonth')}</span>
            </p>
            <p className="pub-pl__pn">{t('plans.proMonthNote')}</p>
            <ReferencePrice state={priceDisplay.reference} />
            <div className="pub-pl__deal" data-price="pro_year">
              <p className="pub-pl__deal-t">
                <Gift aria-hidden="true" />
                {t('plans.dealTitle')}
              </p>
              <p>
                {math.yearSavingsCents > 0 &&
                  t('plans.dealSave', {
                    // Whole pesos, rounded down: never claim more than is saved.
                    ahorro: formatMXN(floorToPeso(math.yearSavingsCents)),
                    pct: pct('pro'),
                  })}
              </p>
              <p className="pub-pl__deal-s">{t('plans.dealTotal', { monto: formatMXN(year) })}</p>
            </div>
            <Link href={trialHref} className="ch-btn ch-btn--primary" data-cta="trial-plans">
              {t('plans.proCta')}
            </Link>
          </section>

          <section className="pub-pl pub-pl--vip" aria-labelledby="pl-vip">
            <h3 id="pl-vip">{t('plans.vip')}</h3>
            <p className="pub-pl__pr" data-price="vip_month">
              {formatMXN(vip)} <span className="pub-pl__per">{t('plans.perMonth')}</span>
            </p>
            <p className="pub-pl__pn">{tb('renewMonth')}</p>
            <Link href={vipCtaHref(signedIn)} className="ch-btn ch-btn--secondary">
              {t('plans.vipCta')}
            </Link>
          </section>
        </div>
        <p className="pub-plans__tax">{tb(priceDisplay.taxKey)}</p>
        <p className="pub-plans__all">
          <Link href={PLANES_HREF} className="ch-lnk">
            {t('plans.seeAll')}
          </Link>
        </p>
      </div>
    </section>
  );
}
