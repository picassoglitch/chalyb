import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { PRICING } from '@/config/pricing';
import type { PlansProps } from '@/lib/billing/plans-props';
import { PlanCards } from '@/components/app/billing/plan-cards';
import { PLANES_HREF, tagPricingHref } from './links';
import { SectionHead } from './section-head';

// 6 · Precios (#precios, aliases #planes and #pricing; LANDING-SPEC §3.7).
// The same PlanCards as /planes
// (PRICING-CARDS-SPEC §5.4), so the two can't drift: the yearly charge leads
// in Anual, every amount comes from the pricing config, and every trial claim
// follows trialOffered. The block says "IVA incluido".

export async function PlansSummary(props: PlansProps) {
  const t = await getTranslations('landing');
  const tp = await getTranslations('plans');
  const tb = await getTranslations('billing.price');
  const cta = props.cta;
  const tagged = {
    ...props,
    cta: {
      gratis: { ...cta.gratis, href: tagPricingHref(cta.gratis.href, 'free') },
      pro: {
        ...cta.pro,
        hrefYear: tagPricingHref(cta.pro.hrefYear, 'pro'),
        hrefMonth: tagPricingHref(cta.pro.hrefMonth, 'pro'),
      },
      vip: {
        ...cta.vip,
        hrefYear: tagPricingHref(cta.vip.hrefYear, 'vip'),
        hrefMonth: tagPricingHref(cta.vip.hrefMonth, 'vip'),
      },
    },
  };

  return (
    <section id="precios" className="pub-band pub-band--white" aria-labelledby="plans-title">
      {/* Old links pointed at #planes and #pricing; keep them landing here. */}
      <span id="planes" aria-hidden="true" />
      <span id="pricing" aria-hidden="true" />
      <div className="pub-wrap" data-testid="plans-summary">
        <SectionHead
          id="plans-title"
          label={t('plans.label')}
          title={tp('title')}
          sub={props.trialOffered ? tp('sub', { dias: PRICING.trial.days }) : tp('subNoTrial')}
        />
        <PlanCards {...tagged} headingLevel={3} />
        <div className="ch-pc-foot">
          <p className="pub-plans__tax">{tb(props.priceDisplay.taxKey)}</p>
          <p className="ch-pc-foot__note">{t('plans.secure')}</p>
          {props.trialOffered && (
            <p className="ch-pc-foot__note">{t('plans.trialNote', { dias: PRICING.trial.days })}</p>
          )}
          <p className="pub-plans__all">
            <Link href={PLANES_HREF} className="ch-lnk">
              {t('plans.seeAll')}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
