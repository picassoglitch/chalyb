// Where each Planes CTA leads (SCR-12 states). Pure.

import type { PlansViewProps } from '@/components/app/billing/plans-view';
import type { BillingState } from './billing-state';

export function plansCta(input: {
  signedIn: boolean;
  isAdmin: boolean;
  flow: boolean;
  trialUsed: boolean;
  billing: BillingState | null;
  quebecBlocked: boolean;
}): PlansViewProps['cta'] {
  const { signedIn, flow, trialUsed, billing, quebecBlocked } = input;
  const signup = '/sign-in?mode=signup';
  const state = billing?.state ?? 'free';
  const paid =
    state === 'pro' || state === 'trialing' || state === 'past_due' || state === 'cancelled_active';
  const onVip = paid && billing?.planKey === 'vip_month';

  const proHref = !signedIn ? `${signup}&intent=trial` : flow ? '/app/prueba' : '/app/subscription';
  const pro: PlansViewProps['cta']['pro'] = input.isAdmin
    ? { href: null, label: 'current' }
    : state === 'trialing'
      ? { href: null, label: 'trialing' }
      : paid && !onVip
        ? { href: null, label: 'current' }
        : {
            href: quebecBlocked ? null : proHref,
            label: !flow ? 'noTrial' : trialUsed ? 'return' : 'trial',
          };
  const vip: PlansViewProps['cta']['vip'] =
    input.isAdmin || onVip
      ? { href: null, label: 'current' }
      : {
          href: quebecBlocked
            ? null
            : !signedIn
              ? signup
              : flow
                ? '/app/billing/cambiar?plan=vip_month'
                : '/app/subscription',
          label: paid ? 'up' : 'choose',
        };
  const gratis: PlansViewProps['cta']['gratis'] =
    signedIn && !paid && !input.isAdmin
      ? { href: null, label: 'current' }
      : { href: signedIn ? '/app' : signup, label: 'gratis' };
  return { gratis, pro, vip };
}
