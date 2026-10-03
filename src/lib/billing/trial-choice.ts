// Which plan the trial picker starts on (C9; Law PRICING-CARDS-SPEC §16.2,
// aceptacion-ux §3.1). Pure.
//
// Never the annual charge: a $9,970 charge preselected after only 7 days is
// the main chargeback / PROFECO risk. From a monthly CTA, Pro mensual; from
// an annual CTA (or none), nothing — the user picks. When the owner turned
// Mensual off, Pro anual is the only option, so it is the only answer.

import type { PlanKey } from '@/config/pricing';

export function initialTrialPlan(
  cameFrom: 'month' | 'year' | null,
  monthlyOffered: boolean,
): PlanKey | null {
  if (!monthlyOffered) return 'pro_year';
  return cameFrom === 'month' ? 'pro_month' : null;
}
