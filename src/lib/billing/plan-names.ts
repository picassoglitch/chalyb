// The Spanish plan names used in emails, the Mercado Pago statement
// ("Chalyb VIP anual") and evidence. One table, so a new plan key can't be
// named in one place and forgotten in another. The UI uses
// messages myplan.planName.<key>.

import type { PlanKey } from '@/config/pricing';

export const PLAN_NAMES: Record<PlanKey, string> = {
  pro_month: 'Pro mensual',
  pro_year: 'Pro anual',
  vip_month: 'VIP',
  vip_year: 'VIP anual',
  pro_lealtad: 'Pro Lealtad',
};
