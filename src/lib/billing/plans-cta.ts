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
    label: 'choose' | 'up' | 'current';
  };
}

const SIGNUP = '/sign-in?mode=signup';

export function plansCta(input: {
  signedIn: boolean;
  isAdmin: boolean;
  /** The 7-day trial path is live (TRIAL_FLOW_ENABLED + prerequisites). */
  flow: boolean;
  /** Annual billing can be bought (today: the trial flow's checkout). */
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
    if (!signedIn) {
      if (!flow) return `${SIGNUP}&plan=pro`;
      return trial
        ? `${SIGNUP}&intent=trial&interval=${interval}`
        : `${SIGNUP}&plan=pro&interval=${interval}`;
    }
    if (!flow) return interval === 'month' ? '/app/subscription' : null;
    // The picker for the trial (it never preselects the annual charge);
    // the paid consent path once the trial is used.
    return trial ? `/app/prueba?interval=${interval}` : `/app/prueba/pago?plan=pro_${interval}`;
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

  // ── VIP (never a trial) ──────────────────────────────────────────
  const vipTarget = (interval: Interval): string | null => {
    if (blocked) return null;
    if (interval === 'year' && !(input.annualOffered && input.vipYearOffered)) return null;
    if (!signedIn) return flow ? `${SIGNUP}&plan=vip&interval=${interval}` : `${SIGNUP}&plan=vip`;
    if (!flow) return interval === 'month' ? '/app/subscription' : null;
    return `/app/billing/cambiar?plan=vip_${interval}`;
  };
  const vip: PlansCta['vip'] =
    input.isAdmin || onVip
      ? { hrefYear: null, hrefMonth: null, label: 'current' }
      : {
          hrefYear: vipTarget('year'),
          hrefMonth: vipTarget('month'),
          label: paid ? 'up' : 'choose',
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
  flow: boolean;
}): string | null {
  const interval: Interval | null =
    input.interval === 'month' || input.interval === 'year' ? input.interval : null;
  if (input.intent === 'trial' && input.flow) {
    return interval ? `/app/prueba?interval=${interval}` : '/app/prueba';
  }
  const plan = input.plan?.toLowerCase();
  if (plan === 'free') return '/app';
  if (plan === 'pro') {
    return input.flow && interval ? `/app/prueba/pago?plan=pro_${interval}` : '/app/billing';
  }
  if (plan === 'vip') {
    return input.flow && interval ? `/app/billing/cambiar?plan=vip_${interval}` : '/app/billing';
  }
  return null;
}
