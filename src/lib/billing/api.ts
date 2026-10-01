// Shared bits of the billing API routes. Pure.

import type { StartError } from './start-subscription';

export const PLAN_KEYS = ['pro_year', 'pro_month', 'vip_month'] as const;

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
