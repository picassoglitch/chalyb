// Which plan the trial picker starts on (C9; Law PRICING-CARDS-SPEC §16.2,
// aceptacion-ux §3.1). Pure.
//
// Never the annual charge: an annual charge preselected after only 7 days is
// the main chargeback / PROFECO risk. From a monthly CTA, the monthly plan;
// from an annual CTA (or none), nothing — the user picks. When only one
// interval is offered, it is the only answer.

import type { PlanKey } from '@/config/pricing';

export function initialTrialPlan(
  cameFrom: 'month' | 'year' | null,
  monthlyOffered: boolean,
  annualOffered = true,
  tier: 'pro' | 'vip' = 'pro',
): PlanKey | null {
  const month: PlanKey = tier === 'vip' ? 'vip_month' : 'pro_month';
  const year: PlanKey = tier === 'vip' ? 'vip_year' : 'pro_year';
  if (!monthlyOffered) return annualOffered ? year : null;
  if (!annualOffered) return month;
  return cameFrom === 'month' ? month : null;
}
