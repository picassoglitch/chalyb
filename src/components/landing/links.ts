import type { Route } from 'next';

/**
 * Every conversion path on the landing funnels into the auth flow.
 *
 * The registration surface lives at `/sign-in?mode=signup` (the `(auth)`
 * route group). `/signup` and `/login` are permanent redirects to it in
 * next.config.ts, so typed URLs keep working — but the landing links to the
 * canonical path directly to skip the extra hop.
 *
 * `plan` is carried through as a query param so the auth page can land the
 * new user on the right post-signup screen (see sign-in/page.tsx).
 */
export type PlanSlug = 'free' | 'pro' | 'vip';

export const LOGIN_HREF = '/sign-in' as Route;

/** Where a signed-in visitor should go instead of the funnel. */
export const APP_HREF = '/app' as Route;

export function signupHref(plan?: PlanSlug): Route {
  const qs = plan ? `?mode=signup&plan=${plan}` : '?mode=signup';
  return `/sign-in${qs}` as Route;
}
