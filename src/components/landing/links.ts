import type { Route } from 'next';

/**
 * Where the public site's buttons go (rebuild P4-1).
 *
 * The trial CTA "Prueba Pro gratis 1 mes" opens SCR-13 (`intent=trial`) when
 * the trial flow is live, and the existing sign-up otherwise. A signed-in
 * visitor goes to Planes, which knows their plan. Pure: tests check both flag
 * values.
 */
export type PlanSlug = 'free' | 'pro' | 'vip';

export const LOGIN_HREF = '/sign-in' as Route;

/** Where a signed-in visitor should go instead of the funnel. */
export const APP_HREF = '/app' as Route;

export const PLANES_HREF = '/planes' as Route;

export function signupHref(plan?: PlanSlug): Route {
  const qs = plan ? `?mode=signup&plan=${plan}` : '?mode=signup';
  return `/sign-in${qs}` as Route;
}

export const TRIAL_SIGNUP_HREF = '/sign-in?mode=signup&intent=trial' as Route;

export function trialCtaHref(opts: { trialFlowEnabled: boolean; signedIn: boolean }): Route {
  if (opts.signedIn) return PLANES_HREF;
  return opts.trialFlowEnabled ? TRIAL_SIGNUP_HREF : signupHref('pro');
}

export function vipCtaHref(signedIn: boolean): Route {
  return signedIn ? PLANES_HREF : signupHref('vip');
}

export function freeCtaHref(signedIn: boolean): Route {
  return signedIn ? APP_HREF : signupHref('free');
}
