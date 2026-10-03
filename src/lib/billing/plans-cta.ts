// Where each plan card's button leads (SCR-12 states; PRICING-CARDS-SPEC
// §4.3, all-pending K-2). Pure.
//
// Every paid card has a yearly and a monthly target; the card shows the one
// its toggle is on. null = nothing to buy there (not offered, Quebec, or it
// is already the user's plan).

import type { BillingState } from './billing-state';

export type Interval = 'month' | 'year';

export interface PlansCta {
  gratis: { href: string | null; label: 'gratis' | 'current' };
  pro: {
    hrefYear: string | null;
    hrefMonth: string | null;
    label: 'trial' | 'paid' | 'current' | 'trialing';
  };
  vip: {
    hrefYear: string | null;
    hrefMonth: string | null;
    label: 'trial' | 'choose' | 'up' | 'current';
  };
}

const SIGNUP = '/sign-in?mode=signup';

export function plansCta(input: {
  signedIn: boolean;
  isAdmin: boolean;
  /** The 7-day trial path is live (TRIAL_FLOW_ENABLED + paid checkout). */
  flow: boolean;
  /** Annual billing can be bought (PAID_CHECKOUT_ENABLED, V-1). */
  annualOffered: boolean;
  /** VIP anual exists (WS-5). */
  vipYearOffered: boolean;
  trialUsed: boolean;
  billing: BillingState | null;
  quebecBlocked: boolean;
}): PlansCta {
  const { signedIn, flow, trialUsed, billing, quebecBlocked } = input;
  const state = billing?.state ?? 'free';
  const paid =
    state === 'pro' || state === 'trialing' || state === 'past_due' || state === 'cancelled_active';
  const onVip =
    paid && (billing?.planKey === 'vip_month' || billing?.planKey === ('vip_year' as never));
  const blocked = quebecBlocked;

  // ── Pro ──────────────────────────────────────────────────────────
  const trial = flow && !trialUsed;
  const proTarget = (interval: Interval): string | null => {
    if (blocked) return null;
    if (interval === 'year' && !input.annualOffered) return null;
    const paid = input.annualOffered; // paid checkout live
    if (!signedIn) {
      if (trial) return `${SIGNUP}&intent=trial&interval=${interval}`;
      return paid ? `${SIGNUP}&plan=pro&interval=${interval}` : `${SIGNUP}&plan=pro`;
    }
    // The picker for the trial (it never preselects the annual charge); the
    // paid consent path without it; the legacy monthly checkout when paid
    // checkout is off.
    if (trial) return `/app/prueba?interval=${interval}`;
    if (paid) return `/app/prueba/pago?plan=pro_${interval}`;
    return interval === 'month' ? '/app/subscription' : null;
  };
  const pro: PlansCta['pro'] = input.isAdmin
    ? { hrefYear: null, hrefMonth: null, label: 'current' }
    : state === 'trialing'
      ? { hrefYear: null, hrefMonth: null, label: 'trialing' }
      : paid && !onVip
        ? { hrefYear: null, hrefMonth: null, label: 'current' }
        : {
            hrefYear: proTarget('year'),
            hrefMonth: proTarget('month'),
            label: trial ? 'trial' : 'paid',
          };

  // ── VIP: the trial too, for a first-time customer (owner, 2026-10-03) ──
  const vipTrial = trial && !paid;
  const vipTarget = (interval: Interval): string | null => {
    if (blocked) return null;
    if (interval === 'year' && !(input.annualOffered && input.vipYearOffered)) return null;
    const paidCheckout = input.annualOffered;
    if (!signedIn) {
      if (vipTrial) return `${SIGNUP}&intent=trial&plan=vip&interval=${interval}`;
      return paidCheckout ? `${SIGNUP}&plan=vip&interval=${interval}` : `${SIGNUP}&plan=vip`;
    }
    if (vipTrial) return `/app/prueba?plan=vip&interval=${interval}`;
    if (!paidCheckout) return interval === 'month' ? '/app/subscription' : null;
    return `/app/billing/cambiar?plan=vip_${interval}`;
  };
  const vip: PlansCta['vip'] =
    input.isAdmin || onVip
      ? { hrefYear: null, hrefMonth: null, label: 'current' }
      : {
          hrefYear: vipTarget('year'),
          hrefMonth: vipTarget('month'),
          label: paid ? 'up' : vipTrial ? 'trial' : 'choose',
        };

  const gratis: PlansCta['gratis'] =
    signedIn && !paid && !input.isAdmin
      ? { href: null, label: 'current' }
      : { href: signedIn ? '/app' : SIGNUP, label: 'gratis' };
  return { gratis, pro, vip };
}

/**
 * Where sign-up continues for a plan CTA (keeps `interval`, K-2). null =
 * the default landing after sign-in.
 */
export function signupNext(input: {
  intent?: string;
  plan?: string;
  interval?: string;
  /** The trial path is live. */
  flow: boolean;
  /** Paid checkout is live (defaults to `flow`, which implies it). */
  paid?: boolean;
}): string | null {
  const paid = input.paid ?? input.flow;
  const interval: Interval | null =
    input.interval === 'month' || input.interval === 'year' ? input.interval : null;
  const plan = input.plan?.toLowerCase();
  if (input.intent === 'trial' && input.flow) {
    const qs = [plan === 'vip' ? 'plan=vip' : null, interval ? `interval=${interval}` : null]
      .filter(Boolean)
      .join('&');
    return qs ? `/app/prueba?${qs}` : '/app/prueba';
  }
  if (plan === 'free') return '/app';
  if (plan === 'pro') {
    return paid && interval ? `/app/prueba/pago?plan=pro_${interval}` : '/app/billing';
  }
  if (plan === 'vip') {
    return paid && interval ? `/app/billing/cambiar?plan=vip_${interval}` : '/app/billing';
  }
  return null;
}
