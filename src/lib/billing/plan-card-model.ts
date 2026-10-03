// What each paid card shows for a given toggle position (PRICING-CARDS-SPEC
// §4.4 truth table + §12.2, Law §16.1/§16.5–16.6, all-pending K-2…K-6).
// Pure, so the rules are tested without rendering. PlanCards renders it.

import { PRICE_CENTS, annualMath, pct, planPrice, type PlanKey } from '@/config/pricing';
import type { Interval, PlansCta } from './plans-cta';

export interface CardInput {
  cta: PlansCta;
  trialOffered: boolean;
  vipYearOffered: boolean;
  intervals: Interval[];
  current: 'gratis' | 'pro' | 'vip' | null;
  badge: 'recomendado' | 'masPopular';
}

export interface ProCard {
  planKey: PlanKey;
  amountCents: number;
  unit: Interval;
  /** "7 días gratis" (both modes, only when the trial is offered). */
  chip: boolean;
  /** plans.<badgeKey>: Tu plan > Más popular / Recomendado. Never "Mejor oferta". */
  badgeKey: 'yourPlan' | 'pro.badge' | 'pro.badgePopular';
  /** Annual only: "o paga mes a mes: …" (Q5). */
  monthlyRef: boolean;
  /** Annual: accent pill "Ahorras … · %"; 0 = none. */
  saveCents: number;
  savePct: number;
  /** Monthly: the struck reference (if its flag) or the launch line. */
  referenceLine: boolean;
  /** Monthly: "Cambia a Anual y ahorra …" (only if annual is offered). */
  switchYear: boolean;
  href: string | null;
  ctaKey: 'current' | 'trialing' | 'pro.cta' | 'pro.ctaYear' | 'pro.ctaMonth';
  noteKey: 'pro.note' | 'pro.noteMonth' | 'notePaid' | null;
}

export function proCard(input: CardInput, interval: Interval): ProCard {
  const yearly = interval === 'year';
  const planKey: PlanKey = yearly ? 'pro_year' : 'pro_month';
  const math = annualMath('pro');
  const href = yearly ? input.cta.pro.hrefYear : input.cta.pro.hrefMonth;
  const label = input.cta.pro.label;
  return {
    planKey,
    amountCents: planPrice(planKey).totalCents,
    unit: interval,
    chip: input.trialOffered,
    badgeKey:
      input.current === 'pro'
        ? 'yourPlan'
        : input.badge === 'masPopular'
          ? 'pro.badgePopular'
          : 'pro.badge',
    monthlyRef: yearly,
    saveCents: yearly ? math.yearSavingsCents : 0,
    savePct: yearly ? pct('pro') : 0,
    referenceLine: !yearly,
    switchYear: !yearly && input.intervals.includes('year') && math.yearSavingsCents > 0,
    href,
    ctaKey:
      label === 'current'
        ? 'current'
        : label === 'trialing'
          ? 'trialing'
          : label === 'trial'
            ? 'pro.cta'
            : yearly
              ? 'pro.ctaYear'
              : 'pro.ctaMonth',
    noteKey:
      label === 'trial'
        ? yearly
          ? 'pro.note'
          : 'pro.noteMonth'
        : label === 'paid' && href
          ? 'notePaid'
          : null,
  };
}

export interface VipCard {
  amountCents: number;
  unit: Interval;
  /** VIP has no annual option yet: "Solo plan mensual". */
  noYear: boolean;
  monthlyRef: boolean;
  /** Annual: plain grey "Ahorras … · %". */
  saveCents: number;
  savePct: number;
  switchYear: boolean;
  href: string | null;
  ctaKey: 'current' | 'vip.ctaUp' | 'vip.cta' | 'vip.ctaYear' | 'vip.ctaMonth';
  notePaid: boolean;
}

export function vipCard(input: CardInput, interval: Interval): VipCard {
  const yearly = interval === 'year' && input.vipYearOffered;
  const math = annualMath('vip');
  const href = yearly ? input.cta.vip.hrefYear : input.cta.vip.hrefMonth;
  const label = input.cta.vip.label;
  return {
    amountCents: yearly ? PRICE_CENTS.vip.year : planPrice('vip_month').totalCents,
    unit: yearly ? 'year' : 'month',
    noYear: !input.vipYearOffered && input.intervals.includes('year'),
    monthlyRef: yearly,
    saveCents: yearly ? math.yearSavingsCents : 0,
    savePct: yearly ? pct('vip') : 0,
    switchYear:
      input.vipYearOffered &&
      !yearly &&
      input.intervals.includes('year') &&
      math.yearSavingsCents > 0,
    href,
    ctaKey:
      label === 'current'
        ? 'current'
        : label === 'up'
          ? 'vip.ctaUp'
          : !input.vipYearOffered
            ? 'vip.cta'
            : yearly
              ? 'vip.ctaYear'
              : 'vip.ctaMonth',
    notePaid: label !== 'current' && !!href,
  };
}

/** C8: a superlative deal claim may render only when Pro's saving is
 *  strictly the best of the plans offered annually. */
export function superlativeAllowed(vipYearOffered: boolean): boolean {
  return !vipYearOffered || pct('pro') > pct('vip');
}
