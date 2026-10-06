// Plan changes (rebuild P2-9; Términos de Suscripción §4.4–§4.5, which win
// over BUILD-SPEC §6.10 per C13). Pure.
//
// - Monthly → annual of the same plan (Pro → Pro anual, VIP → VIP anual):
//   immediate, the annual charge today, with credit for the unused part of
//   the month.
// - Pro → VIP (either interval): immediate, with the same proration.
// - Annual → monthly, and VIP → Pro: at the end of the paid period.
// - During the trial: any switch keeps the charge date and gets its own
//   charge notice (T-6, owner O-17); every plan has the trial now.
// The credit is a refund on the last charge (Mercado Pago can't charge a
// first amount different from the recurring one); both are shown before
// confirming.

import { planHasTrial, planPrice, type PlanKey } from '@/config/pricing';

export type ChangeTiming = 'now' | 'period_end' | 'trial_end';

export function changeTiming(from: PlanKey, to: PlanKey, trialing: boolean): ChangeTiming {
  // TODO(owner O-17): Law to confirm the in-trial switch handling.
  if (trialing && planHasTrial(to)) return 'trial_end';
  const a = planPrice(from);
  const b = planPrice(to);
  if (a.tier === 'PRO' && b.tier === 'VIP') return 'now';
  if (a.tier === b.tier && a.interval === 'month' && b.interval === 'year') return 'now';
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

/** What an immediate change costs today and gives back (Términos §4.4–4.5):
 *  the new plan's price today, a refund of the unused part of the current
 *  paid period (none during a trial), then the new plan's price each period. */
export function upgradeQuote(input: {
  to: PlanKey;
  trialing: boolean;
  lastChargeCents: number | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  now: Date;
}): { chargeTodayCents: number; refundCents: number; thenCents: number } {
  const price = planPrice(input.to).totalCents;
  const refund =
    input.trialing || !input.lastChargeCents || !input.periodStart || !input.periodEnd
      ? 0
      : unusedCredit({
          lastChargeCents: input.lastChargeCents,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          now: input.now,
        });
  return { chargeTodayCents: price, refundCents: refund, thenCents: price };
}
