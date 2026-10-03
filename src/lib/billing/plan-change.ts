// Plan changes (rebuild P2-9, BUILD-SPEC §6.10). Pure.
//
// - Upgrade to VIP: immediate. The VIP month is charged today in full; the
//   unused part of the current paid period comes back as a refund on its
//   last charge (Mercado Pago can't charge a first amount different from the
//   recurring one). Both numbers are shown before confirming.
// - Downgrades and Mensual ↔ Anual: at the end of the paid period.
// - During the trial: changes the plan the trial converts into (Pro mensual
//   ↔ Pro anual, Términos §2.4); no charge, the charge date stays, and the
//   new amount gets its own charge notice (T-6, owner O-17).

import { planHasTrial, planPrice, type PlanKey } from '@/config/pricing';

export type ChangeTiming = 'now' | 'period_end' | 'trial_end';

export function changeTiming(from: PlanKey, to: PlanKey, trialing: boolean): ChangeTiming {
  // TODO(owner O-17): Law to confirm the in-trial switch handling.
  if (trialing && planHasTrial(to)) return 'trial_end';
  if (to === 'vip_month' && from !== 'vip_month') return 'now';
  return 'period_end';
}

/**
 * When a reactivated plan (after a cancel) starts charging, or null for
 * today. Paid access left over is kept: the new plan starts after it. Access
 * left from an unpaid trial carries over only to a plan that has the trial
 * (Pro mensual, Pro anual); VIP starts charging today.
 */
export function reactivationStart(input: {
  to: PlanKey;
  accessUntil: string | null;
  /** The cancelled subscription never charged: its access is the trial. */
  unpaidTrial: boolean;
  now: Date;
}): Date | null {
  if (!input.accessUntil || Date.parse(input.accessUntil) <= input.now.getTime()) return null;
  if (input.unpaidTrial && !planHasTrial(input.to)) return null;
  return new Date(input.accessUntil);
}

/** Refund owed for the unused part of the current period, in centavos. */
export function unusedCredit(input: {
  lastChargeCents: number;
  periodStart: Date;
  periodEnd: Date;
  now: Date;
}): number {
  const total = input.periodEnd.getTime() - input.periodStart.getTime();
  if (total <= 0) return 0;
  const left = Math.min(Math.max(input.periodEnd.getTime() - input.now.getTime(), 0), total);
  return Math.floor((input.lastChargeCents * left) / total);
}

export function vipUpgradeQuote(input: {
  trialing: boolean;
  lastChargeCents: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  now: Date;
}): { chargeTodayCents: number; refundCents: number; thenMonthlyCents: number } {
  const vip = planPrice('vip_month').totalCents;
  const refund =
    input.trialing || !input.lastChargeCents || !input.periodStart || !input.periodEnd
      ? 0
      : unusedCredit({
          lastChargeCents: input.lastChargeCents,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          now: input.now,
        });
  return { chargeTodayCents: vip, refundCents: refund, thenMonthlyCents: vip };
}
