// Everything the plan cards need, computed once on the server and shared by
// /planes, /app/planes and the landing (PRICING-CARDS-SPEC §4.2, K-1), so
// the two surfaces can't drift.

import 'server-only';
import { getCurrentUser, getSessionUser } from '@/lib/auth/session';
import { isAdminRole } from './tiers';
import {
  freeIncludesClips,
  planFeatureClipLimitsEnforced,
  lealtadEnabled,
  lealtadOpenToNewCustomers,
  paidCheckoutEnabled,
  proBadgeMostPopular,
  trialFlowEnabled,
  vipYearEnabled,
} from '@/lib/config/flags';
import { billingToggleEnabled } from '@/lib/config/settings';
import { loadBilling } from './subscription-store';
import { plansCta, type Interval, type PlansCta } from './plans-cta';
import { planFeatures, type PlanFeature } from './plan-features';
import { loadPriceDisplay, type PriceDisplay } from './price-display';
import { trialDates } from './trial-dates';
import { formatFechaLarga } from './format';
import { PRICING, togglePct } from '@/config/pricing';

export interface PlansProps {
  cta: PlansCta;
  signedIn: boolean;
  /** The 7-day trial can be started from these cards right now. */
  trialOffered: boolean;
  intervals: Interval[];
  defaultInterval: Interval;
  /** VIP anual is sold (WS-5); otherwise VIP shows monthly in both modes. */
  vipYearOffered: boolean;
  features: Record<'gratis' | 'pro' | 'vip', PlanFeature[]>;
  current: 'gratis' | 'pro' | 'vip' | null;
  /** "Ahorra hasta {pct}%": 0 = no pill. */
  togglePct: number;
  badge: 'recomendado' | 'masPopular';
  quebecBlocked: boolean;
  /** "El {fecha} se cobran…" in the card notes: today + the trial. */
  trialChargeDate: string;
  priceDisplay: PriceDisplay;
  /** WS-7 · the "Lealtad · Solo Pro" toggle option and its target. */
  lealtad: { offered: boolean; href: string | null };
}

/** Pro Lealtad on the cards (spec §15.3/§15.12): flag on, open to new
 *  customers, paid checkout live; MXN only (USD_MARKET_ENABLED keeps MXN on
 *  these cards today). Gratis signs up → the Lealtad checkout; Pro moves at
 *  the end of the period; an existing Lealtad subscriber sees it as theirs. */
function lealtadProps(input: {
  signedIn: boolean;
  isAdmin: boolean;
  state: string;
  planKey: string | null;
  paidCheckout: boolean;
}): PlansProps['lealtad'] {
  const offered = lealtadEnabled() && lealtadOpenToNewCustomers() && input.paidCheckout;
  if (!offered) return { offered: false, href: null };
  if (input.isAdmin || input.planKey === 'pro_lealtad') return { offered: true, href: null };
  if (!input.signedIn) return { offered: true, href: '/sign-in?mode=signup&plan=lealtad' };
  if (input.state === 'free') return { offered: true, href: '/app/prueba/pago?plan=pro_lealtad' };
  return { offered: true, href: '/app/billing/cambiar?plan=pro_lealtad' };
}

/** Which Pro intervals are on sale: annual needs the new paid checkout
 *  (V-1), monthly the owner's toggle. Shared with the landing's FAQ so its
 *  answers quote only what the cards sell. */
export async function offeredIntervals(): Promise<Interval[]> {
  const annualOffered = paidCheckoutEnabled();
  const monthlyOffered = await billingToggleEnabled();
  return annualOffered ? (monthlyOffered ? ['month', 'year'] : ['year']) : ['month'];
}

export async function loadPlansProps(locale: string): Promise<PlansProps> {
  const user = await getCurrentUser().catch(() => null);
  const session = user ? await getSessionUser() : null;
  const billing = session ? await loadBilling(session.user.id).catch(() => null) : null;
  const isAdmin = session ? isAdminRole(session.role) : false;
  const flow = trialFlowEnabled();
  // Annual plans need the new paid checkout (V-1); the trial needs it too.
  const annualOffered = paidCheckoutEnabled();
  const vipYearOffered = vipYearEnabled();
  const quebecBlocked = false;
  const intervals = await offeredIntervals();
  const defaultInterval: Interval = intervals.includes(PRICING.defaultInterval)
    ? PRICING.defaultInterval
    : intervals[0]!;

  const state = billing?.primary.state ?? 'free';
  const planKey = billing?.primary.planKey ?? null;
  const paid = state !== 'free';
  const onVip = paid && planKey?.startsWith('vip');
  const trialUsed = billing?.trialUsed ?? false;
  const proBusy = isAdmin || state === 'trialing' || (paid && !onVip);
  const trialOffered = flow && !trialUsed && !proBusy && !quebecBlocked;

  const opts = {
    freeIncludesClips: freeIncludesClips(),
    clipLimitsEnforced: planFeatureClipLimitsEnforced(),
  };
  return {
    cta: plansCta({
      signedIn: !!session,
      isAdmin,
      flow,
      annualOffered,
      vipYearOffered,
      trialUsed,
      billing: billing?.primary ?? null,
      quebecBlocked,
    }),
    signedIn: !!session,
    trialOffered,
    intervals,
    defaultInterval,
    vipYearOffered,
    features: {
      gratis: planFeatures('FREE', opts),
      pro: planFeatures('PRO', opts),
      vip: planFeatures('VIP', opts),
    },
    current: isAdmin ? null : !session ? null : !paid ? 'gratis' : onVip ? 'vip' : 'pro',
    togglePct: intervals.includes('year')
      ? togglePct(vipYearOffered ? ['pro', 'vip'] : ['pro'])
      : 0,
    badge: proBadgeMostPopular() ? 'masPopular' : 'recomendado',
    quebecBlocked,
    trialChargeDate: formatFechaLarga(trialDates(new Date()).chargeAt, locale),
    lealtad: lealtadProps({
      signedIn: !!session,
      isAdmin,
      state,
      planKey,
      paidCheckout: annualOffered,
    }),
    priceDisplay: await loadPriceDisplay({
      currentAmountCents: (billing?.primaryRow?.amount_cents as number | undefined) ?? null,
    }),
  };
}
