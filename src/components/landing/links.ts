import type { Route } from 'next';

/**
 * Where the public site's buttons go (rebuild P4-1).
 *
 * The trial CTA "Empezar mis 7 días gratis" opens SCR-13 (`intent=trial`) when
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

/** Which label the trial button wears (K-7): the trial only when the flow can
 *  honour it, "Ver planes" for a signed-in visitor (Planes knows their
 *  state), else "Empieza gratis". messages: landing.<key> and
 *  landing.publicNav.<key>. */
export function trialCtaLabel(opts: {
  trialFlowEnabled: boolean;
  signedIn: boolean;
}): 'cta' | 'ctaNoTrial' | 'ctaSignedIn' {
  if (opts.signedIn) return 'ctaSignedIn';
  return opts.trialFlowEnabled ? 'cta' : 'ctaNoTrial';
}

export function vipCtaHref(signedIn: boolean): Route {
  return signedIn ? PLANES_HREF : signupHref('vip');
}

export function freeCtaHref(signedIn: boolean): Route {
  return signedIn ? APP_HREF : signupHref('free');
}

/** LANDING-SPEC §4 `cta_id`s that start the trial. */
export type TrialCtaId =
  | 'nav_trial'
  | 'hero_trial'
  | 'tools_trial'
  | 'final_trial'
  | 'sticky_trial'
  | 'menu_trial'
  | 'pricing_pro';

/**
 * A trial CTA's destination (LANDING-SPEC §4): sign-up with the trial intent,
 * the interval the pricing toggle shows (display only: /app/prueba never
 * preselects the annual charge) and `from` for attribution without cookies.
 * Without the trial flow it's the plain Pro sign-up; a signed-in visitor goes
 * to the app's trial step.
 */
export function landingTrialHref(opts: {
  from: TrialCtaId;
  interval?: 'year' | 'month';
  trialFlowEnabled: boolean;
  signedIn: boolean;
}): Route {
  if (opts.signedIn) return '/app/prueba' as Route;
  const interval = opts.interval ?? 'year';
  if (!opts.trialFlowEnabled)
    return `/sign-in?mode=signup&plan=pro&interval=${interval}&from=${opts.from}` as Route;
  return `/sign-in?mode=signup&plan=pro&intent=trial&interval=${interval}&from=${opts.from}` as Route;
}

/** The landing's pricing cards tag their sign-up links (LANDING-SPEC §4):
 *  `from=pricing_{plan}`, and the plan when the trial link lacks it. Links
 *  into the app are left alone. */
export function tagPricingHref(href: string | null, plan: PlanSlug): string | null {
  if (!href || !href.startsWith('/sign-in')) return href;
  const url = new URL(href, 'https://x');
  if (!url.searchParams.has('plan')) url.searchParams.set('plan', plan);
  url.searchParams.set('from', `pricing_${plan}`);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
