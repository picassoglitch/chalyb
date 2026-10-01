import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { signupHref, type PlanSlug } from './links';
import { planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';

// Display copy lives in messages/*.json; every amount comes from the one
// pricing source (src/config/pricing.ts), IVA included. P4 rebuilds this
// section; until then it must at least show the real totals.
const AMOUNT: Record<PlanSlug, string> = {
  free: formatMXN(0),
  pro: formatMXN(planPrice('pro_month').totalCents),
  vip: formatMXN(planPrice('vip_month').totalCents),
};
const TIERS: Array<{ slug: PlanSlug; featured: boolean; features: number }> = [
  { slug: 'free', featured: false, features: 4 },
  { slug: 'pro', featured: true, features: 5 },
  { slug: 'vip', featured: false, features: 5 },
];

export function Pricing() {
  const t = useTranslations('landing.pricing');

  return (
    <section className="lp-section" id="pricing">
      <div className="lp-container">
        <div className="lp-section-head">
          <h2 className="lp-h2">{t('title')}</h2>
          <p className="lp-sub">{t('subtitle')}</p>
        </div>
        <div className="lp-plans">
          {TIERS.map((tier) => (
            <div key={tier.slug} className={`lp-plan${tier.featured ? ' lp-plan-featured' : ''}`}>
              {tier.featured && <span className="lp-plan-badge">{t('badge')}</span>}
              <div className="lp-plan-name">{t(`tiers.${tier.slug}.name`)}</div>
              <div className="lp-plan-price">
                {AMOUNT[tier.slug]}
                <span className="lp-plan-per">{t(`tiers.${tier.slug}.per`)}</span>
              </div>
              <p className="lp-plan-tag">{t(`tiers.${tier.slug}.tagline`)}</p>
              <ul className="lp-plan-feats">
                {Array.from({ length: tier.features }, (_, i) => i + 1).map((f) => (
                  <li key={f}>
                    <span className="lp-check" aria-hidden="true">
                      ✓
                    </span>
                    {t(`tiers.${tier.slug}.features.${f}`)}
                  </li>
                ))}
              </ul>
              <Link
                href={signupHref(tier.slug)}
                className={`lp-btn lp-btn-block ${tier.featured ? 'lp-btn-primary' : 'lp-btn-secondary'}`}
                prefetch={false}
              >
                {t(`tiers.${tier.slug}.cta`)}
              </Link>
            </div>
          ))}
        </div>
        <p className="lp-plans-note">{t('note')}</p>
      </div>
    </section>
  );
}
