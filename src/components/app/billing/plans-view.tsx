'use client';

// SCR-12 · Planes. Mensual/Anual toggle (Anual on), Gratis · Pro · VIP, "Qué
// incluye" and the FAQ. The free month comes only with Anual: on Mensual the
// trial CTA becomes "Elegir Pro mensual" and goes straight to its payment.
// Every amount comes from the pricing config; the annual comparison appears
// only as "vs. … pagando mes a mes", never struck through, and never
// "2 meses gratis".

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { annualMath, floorToPeso, planPrice } from '@/config/pricing';
import type { PriceDisplay } from '@/lib/billing/price-display';
import { ReferencePrice } from './reference-price';
import { formatMXN } from '@/lib/billing/format';
import { Pill } from '@/components/ui/primitives';

export interface PlansViewProps {
  /** Names of the active tools, for "Las {n} herramientas: {lista}". */
  tools: string[];
  /** Where each CTA goes, decided on the server (signed in or not, flow on
   *  or off, current plan). null = disabled ("Tu plan actual"). */
  cta: {
    gratis: { href: string | null; label: 'gratis' | 'current' };
    pro: { href: string | null; label: 'trial' | 'noTrial' | 'return' | 'current' | 'trialing' };
    vip: { href: string | null; label: 'choose' | 'up' | 'current' };
  };
  trialOffered: boolean;
  quebecBlocked: boolean;
  /** P5-6 · Mensual next to Anual (owner toggle). Off → Anual only. */
  monthlyOffered?: boolean;
  /** Reference price and tax footer, decided on the server. */
  priceDisplay: PriceDisplay;
}

export function PlansView({
  tools,
  cta,
  trialOffered,
  quebecBlocked,
  monthlyOffered = true,
  priceDisplay,
}: PlansViewProps) {
  const t = useTranslations('plans');
  const tb = useTranslations('billing');
  const [yearlyChoice, setYearly] = useState(true);
  const yearly = monthlyOffered ? yearlyChoice : true;
  const math = annualMath();
  const month = planPrice('pro_month').totalCents;
  const year = planPrice('pro_year').totalCents;
  const vip = planPrice('vip_month').totalCents;
  const list = new Intl.ListFormat('es', { type: 'conjunction' }).format(tools);

  const proLabel = {
    trial: yearly ? t('pro.cta') : t('pro.ctaMonth'),
    noTrial: t('pro.ctaNoTrial'),
    return: t('pro.ctaReturn'),
    current: t('current'),
    trialing: t('trialing'),
  }[cta.pro.label];
  // Mensual has no free month: skip the picker and go to its payment.
  const proHref =
    !yearly && cta.pro.href === '/app/prueba' ? '/app/prueba/pago?plan=pro_month' : cta.pro.href;
  const vipLabel = { choose: t('vip.cta'), up: t('vip.ctaUp'), current: t('current') }[
    cta.vip.label
  ];
  const gratisLabel = cta.gratis.label === 'current' ? t('current') : t('gratis.cta');

  const button = (href: string | null, label: string, primary: boolean) =>
    href ? (
      <Link
        href={href as Route}
        className={`ch-btn ${primary ? 'ch-btn--primary' : 'ch-btn--secondary'}`}
        style={{ width: '100%' }}
      >
        {label}
      </Link>
    ) : (
      <span
        className="ch-btn ch-btn--gray"
        aria-disabled="true"
        style={{ width: '100%', cursor: 'default' }}
      >
        {label}
      </span>
    );

  return (
    <div style={{ display: 'grid', gap: 32 }}>
      <header style={{ textAlign: 'center', display: 'grid', gap: 10, justifyItems: 'center' }}>
        <h1 className="ch-h1">{t('title')}</h1>
        <p className="ch-sub">{trialOffered ? t('sub') : t('subNoTrial')}</p>
        {monthlyOffered && (
          <div
            role="radiogroup"
            aria-label={t('toggleAria')}
            className="ch-seg"
            style={{ marginTop: 8 }}
          >
            {([false, true] as const).map((y) => (
              <button
                key={String(y)}
                type="button"
                role="radio"
                aria-checked={yearly === y}
                className={`ch-chip${yearly === y ? ' ch-chip--on' : ''}`}
                onClick={() => setYearly(y)}
              >
                {y ? t('toggle.year') : t('toggle.month')}
                {y && math.yearSavingsCents > 0 && (
                  <Pill kind="acc">
                    {t('toggle.save', { ahorro: formatMXN(floorToPeso(math.yearSavingsCents)) })}
                  </Pill>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      {quebecBlocked && (
        <p role="status" className="ch-card" style={{ padding: 16, textAlign: 'center' }}>
          {t('quebec')}
        </p>
      )}

      <div className="ch-plans">
        <section className="ch-card ch-plancard" aria-labelledby="plan-gratis">
          <h2 id="plan-gratis" className="ch-h2">
            {t('gratis.name')}
          </h2>
          <p className="ch-muted">{t('gratis.tag')}</p>
          <p className="ch-plancard__price">{formatMXN(0)}</p>
          <p className="ch-muted">{t('gratis.note')}</p>
          {button(cta.gratis.href, gratisLabel, false)}
          <ul className="ch-feats">
            <li>
              <Check aria-hidden="true" />
              {t('gratis.f1')}
            </li>
            <li>
              <Check aria-hidden="true" />
              {t('gratis.f2')}
            </li>
            <li>
              <Check aria-hidden="true" />
              {t('gratis.f3')}
            </li>
            <li className="ch-feats__no">
              <X aria-hidden="true" />
              <span className="ch-sr">{t('notIncluded')}: </span>
              {t('gratis.fNo')}
            </li>
          </ul>
        </section>

        <section className="ch-card ch-plancard ch-plancard--pro" aria-labelledby="plan-pro">
          <Pill kind="acc">{t('pro.badge')}</Pill>
          <h2 id="plan-pro" className="ch-h2">
            {t('pro.name')}
          </h2>
          <p className="ch-muted">{t('pro.tag')}</p>
          <p className="ch-plancard__price">
            {yearly
              ? tb('price.proYearBig', { monto: formatMXN(year) })
              : tb('price.proMonthBig', { monto: formatMXN(month) })}
          </p>
          <p className="ch-muted">{yearly ? tb('price.renewYear') : tb('price.renewMonth')}</p>
          {!yearly && <ReferencePrice state={priceDisplay.reference} />}
          {yearly && (
            <p className="ch-muted" style={{ fontSize: 15.5 }}>
              {tb('price.monthlyRef', { monto: formatMXN(month) })}
            </p>
          )}
          {button(proHref, proLabel, true)}
          {trialOffered && cta.pro.label === 'trial' && (
            <p className="ch-muted" style={{ fontSize: 15 }}>
              {yearly ? t('pro.note') : t('pro.monthNoTrial')}
            </p>
          )}
          {yearly && monthlyOffered && (
            <p className="ch-muted" style={{ fontSize: 15 }}>
              {t('pro.monthAlt', { monto: formatMXN(month) })}
            </p>
          )}
          <ul className="ch-feats">
            <li>
              <Check aria-hidden="true" />
              {t('pro.f1', { n: tools.length, lista: list })}
            </li>
            <li>
              <Check aria-hidden="true" />
              {t('pro.f3')}
            </li>
          </ul>
        </section>

        <section className="ch-card ch-plancard" aria-labelledby="plan-vip">
          <h2 id="plan-vip" className="ch-h2">
            {t('vip.name')}
          </h2>
          <p className="ch-muted">{t('vip.tag')}</p>
          <p className="ch-plancard__price">{tb('price.proMonthBig', { monto: formatMXN(vip) })}</p>
          <p className="ch-muted">{`${tb('price.renewMonth')} · ${t('vip.noYear')}`}</p>
          {button(cta.vip.href, vipLabel, false)}
          <ul className="ch-feats">
            <li>
              <Check aria-hidden="true" />
              {t('vip.f1')}
            </li>
            <li>
              <Check aria-hidden="true" />
              {t('vip.f2')}
            </li>
            <li>
              <Check aria-hidden="true" />
              {t('vip.f4')}
            </li>
          </ul>
        </section>
      </div>

      <p className="ch-muted" style={{ textAlign: 'center' }}>
        {tb(`price.${priceDisplay.taxKey}`)}
      </p>

      <section aria-labelledby="faq-title" style={{ display: 'grid', gap: 12 }}>
        <h2 id="faq-title" className="ch-h2">
          {t('faqTitle')}
        </h2>
        {(['1', '2', '3', '4'] as const).map((n) => (
          <details key={n} className="ch-card" style={{ padding: '16px 20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 32 }}>
              {t(`faq.q${n}`)}
            </summary>
            <p className="ch-muted" style={{ marginTop: 8 }}>
              {t(`faq.a${n}`)}
            </p>
          </details>
        ))}
      </section>
    </div>
  );
}
