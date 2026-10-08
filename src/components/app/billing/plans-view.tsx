// SCR-12 · Planes: header, the shared plan cards, the tax line and trial
// footnote, and the FAQ (PRICING-CARDS-SPEC §5.2). Every claim follows the
// same flags as the cards: no trial wording unless the trial is offered.

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PRICING } from '@/config/pricing';
import type { PlansProps } from '@/lib/billing/plans-props';
import { PlanCards } from './plan-cards';

export function PlansView(props: PlansProps) {
  const t = useTranslations('plans');
  const tb = useTranslations('billing.price');
  const faq = (['1', '2', '3', '4'] as const).filter((n) => n !== '1' || props.trialOffered);

  return (
    <div style={{ display: 'grid', gap: 32 }}>
      <header style={{ textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">
          {props.trialOffered ? t('sub', { dias: PRICING.trial.days }) : t('subNoTrial')}
        </p>
      </header>

      {props.quebecBlocked && (
        <p role="status" className="ch-card" style={{ padding: 16, textAlign: 'center' }}>
          {t('quebec')}
        </p>
      )}

      <PlanCards {...props} headingLevel={2} />

      <div className="ch-pc-foot">
        <p>{tb(props.priceDisplay.taxKey)}</p>
        {props.trialOffered && (
          <p className="ch-pc-foot__note">{t('trialFootnote', { dias: PRICING.trial.days })}</p>
        )}
      </div>

      <section aria-labelledby="faq-title" style={{ display: 'grid', gap: 12 }}>
        <h2 id="faq-title" className="ch-h2">
          {t('faqTitle')}
        </h2>
        {faq.map((n) => (
          <details key={n} className="ch-card ch-faq">
            <summary>
              {t(`faq.q${n}`)}
              <ChevronDown aria-hidden="true" />
            </summary>
            <p className="ch-muted">{t(`faq.a${n}`, { dias: PRICING.trial.days })}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
