// Aldo 2026-11-05 "Count every first payment": callers fire on a DB transition so
// replays can't double-count; fire-and-forget so analytics never breaks billing. No PII.

import 'server-only';
import { track, type FunnelProps } from './track';
import { planPrice, type PlanKey } from '@/config/pricing';

/** Major units, two decimals: what Vercel's dashboard sums. */
function mxn(cents: number): number {
  return Math.round(cents) / 100;
}

// track() catches its own failures and never rejects.
function send(props: FunnelProps): void {
  void track('conversion', props);
}

export interface FirstChargeConversion {
  planKey: PlanKey | null;
  amountCents: number;
  /** The subscription started with a trial (trial_ends_at set). */
  trial: boolean;
  /** Already had a charged subscription: a plan change or a win-back. */
  returning?: boolean;
}

export function trackFirstCharge(c: FirstChargeConversion): void {
  // A plan_key outside PlanKey (legacy row) has no price: say unknown, never guess monthly.
  const interval = (c.planKey && planPrice(c.planKey)?.interval) || 'unknown';
  // Most important first: Vercel Pro keeps 2 properties per event, Analytics Plus 8.
  send({
    // `plan` keeps the values trial conversions always sent, so dashboards don't split.
    plan: interval === 'year' ? 'anual' : interval === 'month' ? 'mensual' : 'unknown',
    kind: 'subscription_first',
    amount_mxn: mxn(c.amountCents),
    interval,
    trial: c.trial,
    plan_key: c.planKey ?? 'unknown',
    ...(c.returning === undefined ? {} : { returning: c.returning }),
  });
}

export function trackPackSettled(c: { packId: string; amountCents: number }): void {
  send({
    plan: 'pack',
    kind: 'pack',
    amount_mxn: mxn(c.amountCents),
    interval: 'once',
    trial: false,
    plan_key: c.packId,
  });
}
