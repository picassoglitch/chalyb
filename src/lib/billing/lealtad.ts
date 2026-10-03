// Pro Lealtad rules (WS-7; PRICING-CARDS-SPEC §15.12; Términos §4 bis;
// Law REVISION §R). Pure: amounts come from config/pricing.ts.

import { LEALTAD, lealtadPriceCents, lealtadSchedule } from '@/config/pricing';

const DAY = 86_400_000;

/**
 * The charge dates, step by step: one month apart on the day of the first
 * charge; a day missing from a month falls on that month's last day
 * (Términos 3.2), and the next month goes back to the original day.
 */
export function lealtadDates(start: Date, count = LEALTAD.maxStep + 1): Date[] {
  const day = start.getUTCDate();
  return Array.from({ length: count }, (_, i) => {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + i;
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(
      Date.UTC(
        y,
        m,
        Math.min(day, last),
        start.getUTCHours(),
        start.getUTCMinutes(),
        start.getUTCSeconds(),
      ),
    );
  });
}

/** The schedule with its dates, for the checkout block, the consent record
 *  and the confirmation email. */
export function lealtadCalendar(start: Date) {
  const dates = lealtadDates(start);
  return lealtadSchedule().map((s, i) => ({ ...s, date: dates[i]! }));
}

/** After an approved charge the NEXT charge is one step lower (cap: month 7+). */
export function stepAfterCharge(step: number): number {
  return Math.min(step + 1, LEALTAD.maxStep);
}

/** Sums of 12-month spans (Law's check 2): months 1–12 and 13–24. */
export function lealtadTotal(fromMonth: number, toMonth: number): number {
  let total = 0;
  for (let m = fromMonth; m <= toMonth; m++) total += lealtadPriceCents(m - 1);
  return total;
}

export type ResetCause =
  | 'cancel_effective'
  | 'cancel_undone'
  | 'plan_change'
  | 'unpaid_after_grace'
  | 'paid_within_grace'
  | 'refund'
  | 'chargeback_filed'
  | 'chargeback_won_by_user'
  | 'chargeback_lost_unpaid_after_grace'
  | 'card_change'
  | 'chalyb_or_mp_cause'
  | 'hold';

/** Spec §15.12.5 / Términos 4 bis.4–4 bis.5: whether this resets the
 *  schedule. A reset always ends the subscription; coming back is a new
 *  one at month 1 with a fresh checkbox. */
export function resets(cause: ResetCause): boolean {
  return (
    cause === 'cancel_effective' ||
    cause === 'plan_change' ||
    cause === 'unpaid_after_grace' ||
    cause === 'chargeback_lost_unpaid_after_grace'
  );
}

export type GateResult =
  | { action: 'accept' }
  /** Below what was expected: accept, and tell ops. */
  | { action: 'accept_alert' }
  /** Above: grant access, refund the difference automatically
   *  (legal_7_2_d), alert; the step is unaffected. */
  | { action: 'refund_difference'; refundCents: number }
  | { action: 'reject' };

/**
 * The amount gate for a Pro Lealtad charge (spec §15.6/§15.12.10 #12): the
 * step's amount, or the previous step's within 48 h of an advance (MP may
 * still be on it), never above the base.
 */
export function lealtadGate(input: {
  chargedCents: number;
  step: number;
  advancedAt: Date | null;
  now: Date;
}): GateResult {
  const expected = lealtadPriceCents(input.step);
  const previous = lealtadPriceCents(Math.max(0, input.step - 1));
  const recent =
    input.advancedAt !== null && input.now.getTime() - input.advancedAt.getTime() <= 2 * DAY;
  if (input.chargedCents === expected) return { action: 'accept' };
  if (recent && input.chargedCents === previous) return { action: 'accept' };
  if (input.chargedCents <= 0) return { action: 'reject' };
  if (input.chargedCents > LEALTAD.baseCents) {
    return { action: 'refund_difference', refundCents: input.chargedCents - expected };
  }
  if (input.chargedCents > expected)
    return { action: 'refund_difference', refundCents: input.chargedCents - expected };
  return { action: 'accept_alert' };
}

/** The resume step when coming back within the optional return window
 *  (O-15, default off): the step the cancelled subscription was on, else 0. */
export function resumeStep(input: {
  windowDays: number;
  lastCancelledEndedAt: Date | null;
  lastStep: number | null;
  now: Date;
}): number {
  if (input.windowDays <= 0 || !input.lastCancelledEndedAt || input.lastStep === null) return 0;
  const within =
    input.now.getTime() - input.lastCancelledEndedAt.getTime() <= input.windowDays * DAY;
  return within ? input.lastStep : 0;
}
