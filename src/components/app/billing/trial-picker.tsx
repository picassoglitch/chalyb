'use client';

// SCR-14 · Tu prueba (aceptacion-ux §3.1–3.2, verbatim): pick the plan that
// starts when the 7 days end, Pro mensual or Pro anual. The charge block
// under it updates live with the real amount and period.
//
// Preselection (C9, Law §16.2): never the annual charge. Coming from a
// monthly CTA, Pro mensual is preselected; from an annual one, nothing is,
// the annual row is highlighted with "Elegiste Pro anual en la tarjeta", and
// the button waits for a choice. The "o paga mes a mes" line belongs to the
// price cards only, never here (Q5).

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Link } from '@/i18n/routing';
import {
  PRICING,
  annualMath,
  floorToPeso,
  planHasTrial,
  planPrice,
  type PlanKey,
} from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { trialDates } from '@/lib/billing/trial-dates';
import { disclosureParagraphs } from '@/lib/billing/billing-copy';
import { initialTrialPlan } from '@/lib/billing/trial-choice';
import { Markup } from '@/components/ui/markup';
import { useBillingT } from './use-billing-t';

export function TrialPicker({
  choiceEnabled,
  trialUsed,
  cameFrom,
  allToolsClaim,
}: {
  choiceEnabled: boolean;
  trialUsed: boolean;
  /** The interval of the CTA that opened this screen, if any. */
  cameFrom: 'month' | 'year' | null;
  /** C4: "Todas las herramientas incluidas." only when true. */
  allToolsClaim: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('checkout');
  const tb = useTranslations('billing');
  const bt = useBillingT();
  const [plan, setPlan] = useState<PlanKey | null>(initialTrialPlan(cameFrom, choiceEnabled));
  const math = annualMath('pro');
  const year = planPrice('pro_year').totalCents;
  const month = planPrice('pro_month').totalCents;
  // The dates the block promises, from now (the server recomputes them at
  // submit, from its own clock).
  const dates = useMemo(() => trialDates(new Date()), []);
  const paragraphs = plan
    ? disclosureParagraphs(bt, { planKey: plan, dates, cardLast4: null, locale })
    : [];
  const trial = !trialUsed && !!plan && planHasTrial(plan);

  const options: { key: PlanKey; show: boolean }[] = [
    { key: 'pro_month', show: choiceEnabled },
    { key: 'pro_year', show: true },
  ];

  return (
    <div className="ch-center-col" style={{ alignItems: 'stretch', textAlign: 'left' }}>
      <header style={{ textAlign: 'center' }}>
        <h1 className="ch-h1">
          {trialUsed ? t('paid.title') : t('trial.title', { dias: PRICING.trial.days })}
        </h1>
        {!trialUsed && (
          <p className="ch-sub">{allToolsClaim ? t('trial.subAllTools') : t('trial.sub')}</p>
        )}
      </header>

      <fieldset className="ch-fieldset" style={{ alignItems: 'stretch' }}>
        <legend className="ch-h2" style={{ textAlign: 'center', width: '100%' }}>
          {trialUsed ? t('paid.q') : t('trial.q', { dias: PRICING.trial.days })}
        </legend>
        <div style={{ display: 'grid', gap: 14 }}>
          {options
            .filter((o) => o.show)
            .map(({ key }) => {
              const highlighted = key === 'pro_year' && cameFrom === 'year' && plan === null;
              return (
                <label
                  key={key}
                  className="ch-plan-opt"
                  data-on={plan === key}
                  data-highlight={highlighted || undefined}
                >
                  <input
                    type="radio"
                    name="plan"
                    value={key}
                    checked={plan === key}
                    onChange={() => setPlan(key)}
                  />
                  <span style={{ flex: 1 }}>
                    <b style={{ fontSize: 20, display: 'block' }}>
                      {key === 'pro_year'
                        ? t('trial.yearRow', { monto: formatMXN(year) })
                        : t('trial.monthRow', { monto: formatMXN(month) })}
                    </b>
                    {key === 'pro_year' && (
                      <span
                        className="ch-muted"
                        style={{ display: 'block', fontSize: 16, marginTop: 4 }}
                      >
                        {t('trial.yearOnce')}
                        {choiceEnabled &&
                          math.yearSavingsCents > 0 &&
                          ` · ${t('trial.yearSave', { ahorro: formatMXN(floorToPeso(math.yearSavingsCents)) })}`}
                      </span>
                    )}
                    {highlighted && (
                      <span style={{ display: 'block', fontSize: 15, marginTop: 6 }}>
                        {t('trial.cameFromYear')}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
        </div>
      </fieldset>

      {plan &&
        (trial ? (
          <div className="ch-disc" aria-live="polite">
            <span className="ch-disc__ic" aria-hidden="true">
              <Info />
            </span>
            <div style={{ display: 'grid', gap: 8 }}>
              {paragraphs.map((p, i) => (
                <p key={i}>
                  <Markup text={p} />
                </p>
              ))}
            </div>
          </div>
        ) : (
          <div className="ch-disc" aria-live="polite">
            <span className="ch-disc__ic" aria-hidden="true">
              <Info />
            </span>
            <p>
              <b>{t('paid.today', { monto: formatMXN(planPrice(plan).totalCents) })}</b>
            </p>
          </div>
        ))}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        {plan ? (
          <Link
            href={`/app/prueba/pago?plan=${plan}` as Route}
            className="ch-btn ch-btn--primary ch-btn--xl"
          >
            {t('trial.cta')}
          </Link>
        ) : (
          <>
            <span className="ch-btn ch-btn--primary ch-btn--xl" aria-disabled="true" role="link">
              {t('trial.cta')}
            </span>
            <p className="ch-muted" style={{ fontSize: 15 }}>
              {t('trial.pickFirst')}
            </p>
          </>
        )}
        <p className="ch-muted" style={{ fontSize: 16 }}>
          {tb('price.tax')}
        </p>
      </div>
    </div>
  );
}
