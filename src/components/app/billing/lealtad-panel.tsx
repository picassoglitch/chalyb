'use client';

// Mockups 86 / 88 · the "Lealtad · Solo Pro" option of the plan cards
// (PRICING-CARDS-SPEC §15.12.2; aceptacion-ux §4.2, verbatim). Everything is
// visible before paying: the month-1 price, the explanation, the 7 bars,
// the rounding line, the comparison, the charge line and the reset rule
// next to the button. Every amount comes from lealtadSchedule(); the
// checkbox and the real dates are on the checkout.

import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { lealtadSchedule, planPrice } from '@/config/pricing';
import { formatMXN } from '@/lib/billing/format';
import { lealtadTotal } from '@/lib/billing/lealtad';
import { Markup } from '@/components/ui/markup';

export function LealtadPanel({ href, current }: { href: string | null; current: boolean }) {
  const t = useTranslations('plans');
  const schedule = lealtadSchedule();
  const m1 = formatMXN(schedule[0]!.cents);
  const piso = formatMXN(schedule.at(-1)!.cents);
  const max = schedule[0]!.cents;
  const pm = planPrice('pro_month').totalCents;
  const pa = planPrice('pro_year').totalCents;
  const b = (c: string) => `<b>${c}</b>`;

  return (
    <section className="ch-lp" aria-labelledby="lp-title">
      <span className="ch-pc__badge">{current ? t('yourPlan') : t('lealtad.badge')}</span>
      <div className="ch-lp__l">
        <h3 id="lp-title" className="ch-pc__name">
          {t('lealtad.name')}
        </h3>
        <p className="ch-pc__tag">{t('lealtad.tag')}</p>
        <p className="ch-pc__pr">
          <span className="ch-pc__amt">{m1}</span>
          <span className="ch-pc__unit">{t('lealtad.first')}</span>
        </p>
        <p className="ch-pc__renew">{t('lealtad.header')}</p>
        <p>
          <Markup text={t.markup('lealtad.explain', { piso, b })} />
        </p>
        <p className="ch-lp__charge">
          <Markup text={t.markup('lealtad.charge', { m1, b })} />
        </p>
        <p className="ch-lp__reset">
          <Markup text={t.markup('lealtad.reset', { m1, b })} />
        </p>
        {href ? (
          <Link
            href={href as Route}
            className="ch-btn ch-btn--primary ch-pc__btn"
            data-cta="pro_lealtad"
          >
            {t('lealtad.ctaContinue')}
          </Link>
        ) : (
          <span className="ch-btn ch-btn--gray ch-pc__btn" aria-disabled="true">
            {t('current')}
          </span>
        )}
      </div>

      <div className="ch-lp__r">
        <div className="ch-lp__head">
          <h4 className="ch-lp__title">{t('lealtad.chartTitle')}</h4>
          <span className="ch-muted">{t('lealtad.legend')}</span>
        </div>
        <ol className="ch-lp__bars">
          {schedule.map((s, i) => {
            const last = i === schedule.length - 1;
            const amount = formatMXN(s.cents);
            return (
              <li
                key={s.step}
                className={`ch-lp__bar${last ? ' ch-lp__bar--floor' : ''}${i === 0 ? ' ch-lp__bar--first' : ''}`}
                aria-label={
                  i === 0
                    ? t('lealtad.barAriaFirst', { monto: amount })
                    : t('lealtad.barAria', { n: i + 1, monto: amount, pct: s.pct })
                }
              >
                <span className="ch-lp__amt" aria-hidden="true">
                  {amount}
                </span>
                {/* Nothing under bar 1: it is month 1 of this plan, not a regular price (Law R). */}
                {i > 0 && (
                  <span className="ch-lp__pct" aria-hidden="true">
                    {t('lealtad.barPct', { pct: s.pct })}
                  </span>
                )}
                <span
                  className="ch-lp__col"
                  style={{ ['--w' as string]: `${Math.round((s.cents / max) * 100)}%` }}
                  aria-hidden="true"
                />
                <span className="ch-lp__mes" aria-hidden="true">
                  {last ? t('lealtad.monthLast', { n: i + 1 }) : t('lealtad.month', { n: i + 1 })}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="ch-muted">
          <Markup text={t.markup('lealtad.rounding', { b })} />
        </p>
        <div className="ch-lp__years">
          <div className="ch-lp__year ch-lp__year--on">
            <small>{t('lealtad.yearLealtad')}</small>
            <b>{formatMXN(lealtadTotal(1, 12))}</b>
            <small>{t('lealtad.yearLealtadSub', { total: formatMXN(lealtadTotal(13, 24)) })}</small>
          </div>
          <div className="ch-lp__year">
            <small>{t('lealtad.yearMonthly')}</small>
            <b>{formatMXN(12 * pm)}</b>
            <small>{t('lealtad.yearMonthlySub', { monto: formatMXN(pm) })}</small>
          </div>
          <div className="ch-lp__year">
            <small>{t('lealtad.yearAnnual')}</small>
            <b>{formatMXN(pa)}</b>
            <small>{t('lealtad.cheapest')}</small>
          </div>
        </div>
        <p className="ch-muted">
          {t('lealtad.compare', {
            pm: formatMXN(pm),
            pa: formatMXN(pa),
            l2: formatMXN(lealtadTotal(13, 24)),
            pm12: formatMXN(12 * pm),
          })}
        </p>
      </div>
    </section>
  );
}
