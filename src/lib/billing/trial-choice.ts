// Which plan the trial picker starts on (C9; Law PRICING-CARDS-SPEC §16.2,
// aceptacion-ux §3.1). Pure.
//
// Never the annual charge: a $9,970 charge preselected after only 7 days is
// the main chargeback / PROFECO risk. From a monthly CTA, Pro mensual; from
// an annual CTA (or none), nothing — the user picks. From the VIP card, VIP.
// When the owner turned Mensual off and VIP wasn't chosen, Pro anual.

import type { PlanKey } from '@/config/pricing';

export function initialTrialPlan(
  cameFrom: 'month' | 'year' | 'vip' | null,
  monthlyOffered: boolean,
): PlanKey | null {
  if (cameFrom === 'vip') return 'vip_month';
  if (!monthlyOffered) return 'pro_year';
  return cameFrom === 'month' ? 'pro_month' : null;
}
