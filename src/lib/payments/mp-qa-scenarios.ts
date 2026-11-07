// Fixture mapper for Mercado Pago QA unit tests.
//
// This is NOT a live adapter, NOT a sandbox SDK, and does NOT fulfill the
// official approved / rejected / duplicate / canceled test scenarios against
// Mercado Pago. Those need genuine test-app credentials, an isolated
// database, and MP's own confirmation. Never label a result from this file
// as a real payment.

import {
  entitlementFor,
  isLiveStatus,
  normalizePreapprovalStatus,
  type Entitlement,
  type PreapprovalStatus,
} from './subscription-reference';

export type MpQaScenario = 'approved' | 'rejected' | 'duplicate' | 'canceled';

/** MP test-card holder names (docs/payments/mercadopago.md §5). */
export function mpQaScenarioFromCardholder(name: string): 'approved' | 'rejected' | null {
  const n = name.trim().toUpperCase();
  if (n === 'APRO') return 'approved';
  if (n === 'OTHE' || n === 'FUND' || n === 'CONT') return 'rejected';
  return null;
}

export interface MpQaPersistInput {
  scenario: MpQaScenario;
  /** A live authorised/pending preapproval for the same tier already exists. */
  existingLiveSameTier: boolean;
  mpStatus: string;
  nextPaymentDate: string | null;
  now?: Date;
}

export interface MpQaPersistResult {
  action: 'create' | 'skip_duplicate' | 'none';
  storedStatus: PreapprovalStatus;
  entitlement: Entitlement;
}

/**
 * What our copy would do with an MP status, without calling Mercado Pago.
 * Duplicate matches authorizeTierSubscription: same live tier → create nothing.
 */
export function mpQaPersistedState(input: MpQaPersistInput): MpQaPersistResult {
  const status = normalizePreapprovalStatus(input.mpStatus);
  if (input.scenario === 'duplicate' || (input.existingLiveSameTier && isLiveStatus(status))) {
    return {
      action: 'skip_duplicate',
      storedStatus: status === 'unknown' ? 'authorized' : status,
      entitlement: entitlementFor({
        status: 'authorized',
        tier: 'PRO',
        nextPaymentDate: input.nextPaymentDate,
        now: input.now,
      }),
    };
  }
  if (input.scenario === 'rejected' || status === 'unknown') {
    return {
      action: 'none',
      storedStatus: status,
      entitlement: entitlementFor({
        status,
        tier: 'PRO',
        nextPaymentDate: input.nextPaymentDate,
        now: input.now,
      }),
    };
  }
  return {
    action: 'create',
    storedStatus: status,
    entitlement: entitlementFor({
      status,
      tier: 'PRO',
      nextPaymentDate: input.nextPaymentDate,
      now: input.now,
    }),
  };
}
