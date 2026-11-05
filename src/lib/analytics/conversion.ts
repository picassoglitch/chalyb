// Aldo 2026-11-05 "Count every first payment": callers fire on a DB transition so
// replays can't double-count; fire-and-forget so analytics never breaks billing. No PII.

import 'server-only';
import { track, type FunnelProps } from './track';
import { planPrice, type PlanKey } from '@/config/pricing';

/** Major units, two decimals: what Vercel's dashboard sums. */
function mxn(cents: number): number {
  return Math.round(cents) / 100;
}

function send(props: FunnelProps): void {
  try {
    void track('conversion', props).catch((err) =>
      console.warn('[analytics] conversion not sent', err instanceof Error ? err.message : err),
    );
  } catch (err) {
    console.warn('[analytics] conversion not sent', err instanceof Error ? err.message : err);
  }
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
  const interval = c.planKey ? planPrice(c.planKey).interval : 'month';
  send({
    // `plan` keeps the value trial conversions always sent, so existing
    // dashboards don't split; `plan_key` names the exact plan.
    plan: interval === 'year' ? 'anual' : 'mensual',
    plan_key: c.planKey ?? 'unknown',
    interval,
    amount_mxn: mxn(c.amountCents),
    kind: 'subscription_first',
    trial: c.trial,
    ...(c.returning === undefined ? {} : { returning: c.returning }),
  });
}

export function trackPackSettled(c: { packId: string; amountCents: number }): void {
  send({
    plan: 'pack',
    plan_key: c.packId,
    interval: 'once',
    amount_mxn: mxn(c.amountCents),
    kind: 'pack',
    trial: false,
  });
}
