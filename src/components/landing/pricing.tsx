import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { CheckIcon } from './mock-bits';
import { signupHref, type LandingPlan } from './links';

interface Tier {
  name: string;
  amt: string;
  per: string;
  tag: string;
  features: string[];
  btn: string;
}

// Card order + which one is highlighted. Copy lives in messages/*.json under
// landing.pricing.tiers.<key>; the PARTNER tier is invite-only and never shown.
const TIERS: Array<{ key: LandingPlan; featured: boolean }> = [
  { key: 'free', featured: false },
  { key: 'pro', featured: true },
  { key: 'vip', featured: false },
];

export function Pricing() {
  const t = useTranslations('landing.pricing');

  return (
    <section className="lp-section" id="pricing">
      <div className="lp-wrap">
        <div className="lp-section-head center">
          <p className="lp-kicker">{t('kicker')}</p>
          <h2>{t.rich('title', { em: (chunks) => <em>{chunks}</em> })}</h2>
          <p>{t('desc')}</p>
        </div>
        <div className="lp-plans">
          {TIERS.map(({ key, featured }) => {
            const tier = t.raw(`tiers.${key}`) as Tier;
            return (
              <article key={key} className={`lp-plan${featured ? ' featured' : ''}`}>
                {featured && <span className="lp-plan-badge">{t('badge')}</span>}
                <p className="lp-plan-name">{tier.name}</p>
                <p className="lp-plan-price">
                  <b>{tier.amt}</b>
                  <span>{tier.per}</span>
                </p>
                <p className="lp-plan-tag">{tier.tag}</p>
                <ul>
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {/* Every tier converts through signup; the sign-in page turns
                    ?plan=pro|vip into a post-auth landing on /app/subscription. */}
                <Link
                  href={signupHref(key)}
                  className={`lp-btn${featured ? '' : ' lp-btn-outline'}`}
                >
                  {tier.btn}
                </Link>
              </article>
            );
          })}
        </div>
        <p className="lp-plans-note">{t('note')}</p>
      </div>
    </section>
  );
}
