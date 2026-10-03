// Shared bits of the billing API routes. Pure.

import type { StartError } from './start-subscription';

export const PLAN_KEYS = ['pro_year', 'pro_month', 'vip_month', 'vip_year', 'pro_lealtad'] as const;

/** Plans sold today: VIP anual only with VIP_YEAR_ENABLED (and paid
 *  checkout); Pro Lealtad only with LEALTAD_ENABLED and open to new
 *  customers. */
export function planOnSale(key: string, vipYear: boolean, lealtad = false): boolean {
  if (!(PLAN_KEYS as readonly string[]).includes(key)) return false;
  if (key === 'vip_year') return vipYear;
  if (key === 'pro_lealtad') return lealtad;
  return true;
}

export function statusForStartError(code: StartError): number {
  switch (code) {
    case 'CONSENT_REQUIRED':
      return 422;
    case 'ADMIN':
    case 'QUEBEC':
      return 403;
    case 'CARD_TRIAL_USED':
      return 409;
    case 'BAD_TOKEN':
      return 400;
    case 'DECLINED':
      return 402;
    case 'NOT_CONFIGURED':
      return 503;
    default:
      return 502;
  }
}
