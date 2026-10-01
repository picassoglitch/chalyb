'use client';

// SCR-14 · Tu prueba: pick the plan the free month turns into. The billing
// block under it updates on every change, with the real amount and period
// (aceptacion-ux §3.1–3.2). Anual is preselected; its big number is the
// yearly total, never the monthly equivalent.

import { useMemo, useState } from 'react';
import type { Route } from 'next';
import { useLocale, useTranslations } from 'next-intl';
import { Info } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { annualMath, planPrice, type PlanKey } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { trialDates } from '@/lib/billing/trial-dates';
import { disclosureParagraphs } from '@/lib/billing/billing-copy';
import { Markup } from '@/components/ui/markup';
import { Pill } from '@/components/ui/primitives';
import { useBillingT } from './use-billing-t';

export function TrialPicker({ choiceEnabled, trialUsed }: { choiceEnabled: boolean; trialUsed: boolean }) {
  const locale = useLocale();
  const t = useTranslations('checkout');
  const tb = useTranslations('billing');
  const bt = useBillingT();
  const [plan, setPlan] = useState<PlanKey>('pro_year');
  const math = annualMath();
  const year = planPrice('pro_year').totalCents;
  const month = planPrice('pro_month').totalCents;
  // The dates the disclosure promises, from now (the server recomputes them
  // at submit, from its own clock).
  const dates = useMemo(() => trialDates(new Date()), []);
  const paragraphs = disclosureParagraphs(bt, { planKey: plan, dates, cardLast4: null, locale });

  const options: { key: PlanKey; show: boolean }[] = [
    { key: 'pro_year', show: true },
    { key: 'pro_month', show: choiceEnabled },
  ];

  return (
    <div className="ch-center-col" style={{ alignItems: 'stretch', textAlign: 'left' }}>
      <header style={{ textAlign: 'center' }}>
        <h1 className="ch-h1">{trialUsed ? t('paid.title') : t('trial.title')}</h1>
        {!trialUsed && <p className="ch-sub">{t('trial.sub')}</p>}
      </header>

      <fieldset className="ch-fieldset" style={{ alignItems: 'stretch' }}>
        <legend className="ch-h2" style={{ textAlign: 'center', width: '100%' }}>
          {t('trial.q')}
        </legend>
        <div style={{ display: 'grid', gap: 14 }}>
          {options
            .filter((o) => o.show)
            .map(({ key }) => (
              <label key={key} className="ch-plan-opt" data-on={plan === key}>
                <input type="radio" name="plan" value={key} checked={plan === key} onChange={() => setPlan(key)} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <b style={{ fontSize: 20 }}>{key === 'pro_year' ? t('trial.year') : t('trial.month')}</b>
                    {key === 'pro_year' && <Pill kind="acc">{t('trial.recommended')}</Pill>}
                    {key === 'pro_year' && (
                      <Pill kind="ok">{tb('price.saveYear', { ahorro: formatMXN(math.yearSavingsCents) })}</Pill>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                    {key === 'pro_year'
                      ? tb('price.proYearBig', { monto: formatMXN(year) })
                      : tb('price.proMonthBig', { monto: formatMXN(month) })}
                  </span>
                  <span className="ch-muted" style={{ display: 'block', fontSize: 16 }}>
                    {key === 'pro_year'
                      ? `${tb('price.proYearEq', { mensual: formatMXN(math.yearMonthlyEquivalentCents) })} · ${tb('price.renewYear')}`
                      : tb('price.renewMonth')}
                  </span>
                </span>
              </label>
            ))}
        </div>
      </fieldset>

      {!trialUsed ? (
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
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <Link href={`/app/prueba/pago?plan=${plan}` as Route} className="ch-btn ch-btn--primary ch-btn--xl">
          {t('trial.cta')}
        </Link>
        <p className="ch-muted" style={{ fontSize: 16 }}>
          {tb('price.tax')}
        </p>
      </div>
    </div>
  );
}
