'use client';

// The plan cards and their Mensual / Anual toggle (PRICING-CARDS-SPEC §3–§5,
// §12.2, §16; all-pending K-1…K-9), shared by /planes, /app/planes and the
// landing so the two can't drift. Everything here comes from loadPlansProps()
// (server) and the pricing config; no amount is typed.
//
// Layout: one 3-column grid; every card has the same 6 rows (subgrid), so
// prices, buttons and lists line up and the cards are equal height. Pro is
// emphasised by its ring, its badge and the only primary button, never by a
// wider column (C16). Stacked below 1024 px with Pro first.

import { useState } from 'react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Check, Gift, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { PRICING, annualMath, floorToPeso, planPrice } from '@/config/pricing';
import { proCard, vipCard } from '@/lib/billing/plan-card-model';
import { formatMXN } from '@/lib/billing/format';
import type { PlansProps } from '@/lib/billing/plans-props';
import type { Interval } from '@/lib/billing/plans-cta';
import type { PlanFeature } from '@/lib/billing/plan-features';
import { trackClient } from '@/lib/analytics/track-client';
import { Markup } from '@/components/ui/markup';
import { ReferencePrice } from './reference-price';
import { LealtadPanel } from './lealtad-panel';

type Props = Pick<
  PlansProps,
  | 'cta'
  | 'trialOffered'
  | 'intervals'
  | 'defaultInterval'
  | 'vipYearOffered'
  | 'features'
  | 'current'
  | 'togglePct'
  | 'badge'
  | 'trialChargeDate'
  | 'priceDisplay'
  | 'lealtad'
> & { headingLevel: 2 | 3 };

export function PlanCards(props: Props) {
  const t = useTranslations('plans');
  const tp = useTranslations('billing.price');
  const [choice, setChoice] = useState<Interval | 'lealtad'>(props.defaultInterval);
  const interval: Interval = choice === 'lealtad' ? 'month' : choice;
  const H = props.headingLevel === 2 ? 'h2' : 'h3';

  function choose(next: Interval | 'lealtad') {
    setChoice(next);
    void trackClient('landing_pricing_toggle', { interval: next });
  }
  const options: (Interval | 'lealtad')[] = [
    ...props.intervals,
    ...(props.lealtad.offered ? (['lealtad'] as const) : []),
  ];

  const model = {
    cta: props.cta,
    trialOffered: props.trialOffered,
    vipYearOffered: props.vipYearOffered,
    intervals: props.intervals,
    current: props.current,
    badge: props.badge,
  };
  const pro = proCard(model, interval);
  const vip = vipCard(model, interval);
  const proNote =
    pro.noteKey === 'pro.note' || pro.noteKey === 'pro.noteMonth' ? (
      <Markup
        text={t.markup(pro.noteKey, {
          fecha: props.trialChargeDate,
          monto: formatMXN(pro.amountCents),
          b: (c) => `<b>${c}</b>`,
        })}
      />
    ) : pro.noteKey === 'notePaid' ? (
      t('notePaid')
    ) : null;

  const button = (href: string | null, label: string, primary: boolean, dataCta: string) =>
    href ? (
      <Link
        href={href as Route}
        className={`ch-btn ${primary ? 'ch-btn--primary' : 'ch-btn--secondary'} ch-pc__btn`}
        data-cta={dataCta}
      >
        {label}
      </Link>
    ) : (
      <span className="ch-btn ch-btn--gray ch-pc__btn" aria-disabled="true">
        {label}
      </span>
    );

  const price = (amount: number, unit: 'year' | 'month', live = false) => (
    <div className="ch-pc__pb" aria-live={live ? 'polite' : undefined}>
      <p className="ch-pc__pr">
        <span className="ch-pc__amt">{formatMXN(amount)}</span>
        <span className="ch-pc__unit">{tp(unit === 'year' ? 'unitYear' : 'unitMonth')}</span>
      </p>
      <p className="ch-pc__renew">{tp(unit === 'year' ? 'renewYear' : 'renewMonth')}</p>
    </div>
  );

  const feats = (list: PlanFeature[], title: string) => (
    <div className="ch-pc__ft">
      <p className="ch-pc__fth">{title}</p>
      <ul className="ch-feats">
        {list.map((f) =>
          f.included ? (
            <li key={f.key}>
              <Check aria-hidden="true" />
              {t(`feat.${f.key}`, f.values ?? {})}
            </li>
          ) : (
            <li key={f.key} className="ch-feats__no">
              <X aria-hidden="true" />
              <span className="ch-sr">{t('notIncluded')}: </span>
              {t(`feat.${f.key}`, f.values ?? {})}
            </li>
          ),
        )}
      </ul>
    </div>
  );

  return (
    <div className="ch-pc-wrap">
      {options.length > 1 && (
        <div
          role="radiogroup"
          aria-label={t('toggleAria')}
          // With Lealtad there are three options: they stack label over pill
          // on phones (mockup 88) and the year pill is the short one.
          className={`ch-pc-toggle${options.length > 2 ? ' ch-pc-toggle--3' : ''}`}
        >
          {options.map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={choice === i}
              className="ch-pc-toggle__opt"
              onClick={() => choose(i)}
            >
              {i === 'year'
                ? t('toggle.year')
                : i === 'lealtad'
                  ? t('toggle.lealtad')
                  : t('toggle.month')}
              {i === 'lealtad' && (
                <span className="ch-pc-toggle__pill">{t('toggle.lealtadPill')}</span>
              )}
              {i === 'year' && props.togglePct > 0 && (
                <span className="ch-pc-toggle__pill">
                  {t(options.length > 2 ? 'toggle.saveShort' : 'toggle.save', {
                    pct: props.togglePct,
                  })}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {choice === 'lealtad' ? (
        <>
          <LealtadPanel
            href={props.lealtad.href}
            current={props.lealtad.offered && !props.lealtad.href && props.current === 'pro'}
          />
          <p className="ch-muted">
            {t('lealtad.notOthers')}{' '}
            <button type="button" className="ch-lnk ch-pc__switch" onClick={() => choose('month')}>
              {t('lealtad.seeOthers')}
            </button>
          </p>
        </>
      ) : (
        <div className="ch-pc-grid" data-testid="plan-cards" data-interval={interval}>
          {/* Gratis */}
          <section
            className={`ch-pc${props.current === 'gratis' ? ' ch-pc--current' : ''}`}
            aria-labelledby="pc-gratis"
          >
            {props.current === 'gratis' && (
              <span className="ch-pc__badge ch-pc__badge--ink">{t('yourPlan')}</span>
            )}
            <div className="ch-pc__hd">
              <H id="pc-gratis" className="ch-pc__name">
                {t('gratis.name')}
              </H>
              <p className="ch-pc__tag">{t('gratis.tag')}</p>
            </div>
            <div className="ch-pc__pb">
              <p className="ch-pc__pr">
                <span className="ch-pc__amt">{formatMXN(0)}</span>
              </p>
              <p className="ch-pc__renew">{tp('free')}</p>
            </div>
            <div className="ch-pc__vl" />
            <div className="ch-pc__ct">
              {button(
                props.cta.gratis.href,
                props.cta.gratis.label === 'current'
                  ? t('current')
                  : props.cta.gratis.label === 'manage'
                    ? t('gratis.ctaManage')
                    : t('gratis.cta'),
                false,
                'gratis',
              )}
            </div>
            <div className="ch-pc__bn" />
            {feats(props.features.gratis, t('featsTitle'))}
          </section>

          {/* Pro */}
          <section
            className={`ch-pc ch-pc--pro${props.current === 'pro' ? ' ch-pc--current' : ''}`}
            aria-labelledby="pc-pro"
          >
            <span className={`ch-pc__badge${props.current === 'pro' ? ' ch-pc__badge--ink' : ''}`}>
              {t(pro.badgeKey)}
            </span>
            <div className="ch-pc__hd">
              <H id="pc-pro" className="ch-pc__name">
                {t('pro.name')}
              </H>
              <p className="ch-pc__tag">{t('pro.tag')}</p>
              {pro.chip && (
                <span className="ch-pc__chip">
                  <Gift aria-hidden="true" />
                  {t('trialChip', { dias: PRICING.trial.days })}
                </span>
              )}
            </div>
            {price(pro.amountCents, pro.unit, true)}
            <div className="ch-pc__vl">
              {pro.monthlyRef && (
                <p className="ch-pc__ref">
                  {tp('monthlyRef', { monto: formatMXN(planPrice('pro_month').totalCents) })}
                </p>
              )}
              {pro.saveCents > 0 && (
                <span className="ch-pill ch-pill--acc">
                  {t('pro.save', {
                    ahorro: formatMXN(floorToPeso(pro.saveCents)),
                    pct: pro.savePct,
                  })}
                </span>
              )}
              {pro.referenceLine && <ReferencePrice state={props.priceDisplay.reference} />}
              {pro.switchYear && (
                <button
                  type="button"
                  className="ch-lnk ch-pc__switch"
                  onClick={() => choose('year')}
                >
                  {t('pro.switchYear', {
                    ahorro: formatMXN(floorToPeso(annualMath('pro').yearSavingsCents)),
                  })}
                </button>
              )}
            </div>
            <div className="ch-pc__ct">
              {button(
                pro.href,
                t(pro.ctaKey),
                true,
                pro.ctaKey === 'pro.cta' ? `${pro.planKey}_trial` : pro.planKey,
              )}
            </div>
            <div className="ch-pc__bn">{proNote}</div>
            {feats(props.features.pro, t('featsTitle'))}
          </section>

          {/* VIP (the trial too, for a first-time customer) */}
          <section
            className={`ch-pc${props.current === 'vip' ? ' ch-pc--current' : ''}`}
            aria-labelledby="pc-vip"
          >
            {props.current === 'vip' && (
              <span className="ch-pc__badge ch-pc__badge--ink">{t('yourPlan')}</span>
            )}
            <div className="ch-pc__hd">
              <H id="pc-vip" className="ch-pc__name">
                {t('vip.name')}
              </H>
              <p className="ch-pc__tag">{t('vip.tag')}</p>
              {vip.chip && (
                <span className="ch-pc__chip">
                  <Gift aria-hidden="true" />
                  {t('trialChip', { dias: PRICING.trial.days })}
                </span>
              )}
            </div>
            {price(vip.amountCents, vip.unit)}
            <div className="ch-pc__vl">
              {vip.noYear && <p className="ch-pc__ref">{t('vip.noYear')}</p>}
              {vip.monthlyRef && (
                <p className="ch-pc__ref">
                  {tp('monthlyRef', { monto: formatMXN(planPrice('vip_month').totalCents) })}
                </p>
              )}
              {vip.saveCents > 0 && (
                <p className="ch-pc__save">
                  {t('vip.save', {
                    ahorro: formatMXN(floorToPeso(vip.saveCents)),
                    pct: vip.savePct,
                  })}
                </p>
              )}
              {vip.switchYear && (
                <button
                  type="button"
                  className="ch-lnk ch-pc__switch ch-pc__switch--ink"
                  onClick={() => choose('year')}
                >
                  {t('vip.switchYear', {
                    ahorro: formatMXN(floorToPeso(annualMath('vip').yearSavingsCents)),
                  })}
                </button>
              )}
            </div>
            <div className="ch-pc__ct">
              {button(
                vip.href,
                t(vip.ctaKey),
                false,
                `${vip.unit === 'year' ? 'vip_year' : 'vip_month'}${vip.chip ? '_trial' : ''}`,
              )}
            </div>
            <div className="ch-pc__bn">
              {vip.noteKey ? (
                <Markup
                  text={t.markup(vip.noteKey, {
                    fecha: props.trialChargeDate,
                    monto: formatMXN(vip.amountCents),
                    b: (c) => `<b>${c}</b>`,
                  })}
                />
              ) : vip.notePaid ? (
                t('notePaid')
              ) : null}
            </div>
            {feats(props.features.vip, t('vip.featsTitle'))}
          </section>
        </div>
      )}
    </div>
  );
}
