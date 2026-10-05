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
    label: 'trial' | 'paid' | 'current' | 'trialing' | 'soon';
  };
  vip: {
    hrefYear: string | null;
    hrefMonth: string | null;
    label: 'trial' | 'choose' | 'up' | 'current' | 'soon';
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
  // Only reached while paid checkout is live (otherwise the card is "soon").
  const proTarget = (interval: Interval): string | null => {
    if (blocked) return null;
    if (!signedIn) {
      if (trial) return `${SIGNUP}&intent=trial&interval=${interval}`;
      return `${SIGNUP}&plan=pro&interval=${interval}`;
    }
    // The picker for the trial (it never preselects the annual charge); the
    // paid consent path without it.
    if (trial) return `/app/prueba?interval=${interval}`;
    return `/app/prueba/pago?plan=pro_${interval}`;
  };
  // Sales are closed while paid checkout is off (annualOffered mirrors it):
  // the paid cards say "Muy pronto" and lead nowhere, signed in or not.
  const soon = { hrefYear: null, hrefMonth: null, label: 'soon' } as const;
  const pro: PlansCta['pro'] = input.isAdmin
    ? { hrefYear: null, hrefMonth: null, label: 'current' }
    : state === 'trialing'
      ? { hrefYear: null, hrefMonth: null, label: 'trialing' }
      : paid && !onVip
        ? { hrefYear: null, hrefMonth: null, label: 'current' }
        : !input.annualOffered
          ? soon
          : {
              hrefYear: proTarget('year'),
              hrefMonth: proTarget('month'),
              label: trial ? 'trial' : 'paid',
            };

  // ── VIP: the trial too, for a first-time customer (owner, 2026-10-03) ──
  const vipTrial = trial && !paid;
  const vipTarget = (interval: Interval): string | null => {
    if (blocked) return null;
    if (interval === 'year' && !input.vipYearOffered) return null;
    if (!signedIn) {
      if (vipTrial) return `${SIGNUP}&intent=trial&plan=vip&interval=${interval}`;
      return `${SIGNUP}&plan=vip&interval=${interval}`;
    }
    if (vipTrial) return `/app/prueba?plan=vip&interval=${interval}`;
    return `/app/billing/cambiar?plan=vip_${interval}`;
  };
  const vip: PlansCta['vip'] =
    input.isAdmin || onVip
      ? { hrefYear: null, hrefMonth: null, label: 'current' }
      : !input.annualOffered
        ? soon
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
  // Sales closed (paid checkout off): nothing to buy, so the default landing.
  if (!paid) return null;
  if (plan === 'lealtad') return '/app/prueba/pago?plan=pro_lealtad';
  if (plan === 'pro') return interval ? `/app/prueba/pago?plan=pro_${interval}` : '/app/billing';
  if (plan === 'vip') {
    return interval ? `/app/billing/cambiar?plan=vip_${interval}` : '/app/billing';
  }
  return null;
}
