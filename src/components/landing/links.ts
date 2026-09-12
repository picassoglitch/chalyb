import type { Route } from 'next';

/**
 * Pricing tiers exposed on the landing. Maps 1:1 to the `plan` query param the
 * sign-in page reads to decide where a freshly created account lands after auth.
 */
export type LandingPlan = 'free' | 'pro' | 'vip';

/** Secondary action — every "Log in" link on the marketing surface. */
export const LOGIN_HREF = '/sign-in' as Route;

/**
 * Primary conversion route. `/signup` is a permanent redirect to this path in
 * next.config.ts; linking to the canonical target saves the extra hop.
 */
export function signupHref(plan?: LandingPlan): Route {
  const params = new URLSearchParams({ mode: 'signup' });
  if (plan) params.set('plan', plan);
  return `/sign-in?${params.toString()}` as Route;
}
