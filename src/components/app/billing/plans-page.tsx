// Planes, with its data: active tools, the signed-in user's state and where
// each CTA goes. Shared by /planes (public) and /app/planes.

import { getCurrentUser, getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { isCustomerVisible } from '@/lib/billing/entitlement-core';
import { isAdminRole } from '@/lib/billing/tiers';
import { trialFlowEnabled } from '@/lib/config/flags';
import { loadBilling } from '@/lib/billing/subscription-store';
import { plansCta } from '@/lib/billing/plans-cta';
import { PlansView } from './plans-view';

export async function PlansSection() {
  const user = await getCurrentUser().catch(() => null);
  const session = user ? await getSessionUser() : null;
  const [engines, billing] = await Promise.all([
    session ? listEngines().catch(() => []) : Promise.resolve([]),
    session ? loadBilling(session.user.id).catch(() => null) : Promise.resolve(null),
  ]);
  // Anonymous visitors can't read the catalog; the three live tools are the
  // documented set until P4 serves the public list (§4).
  const tools = session
    ? engines.filter(isCustomerVisible).map((e) => e.name)
    : ['Clips', 'Señales', 'En vivo'];
  const flow = trialFlowEnabled();
  const cta = plansCta({
    signedIn: !!session,
    isAdmin: session ? isAdminRole(session.role) : false,
    flow,
    trialUsed: billing?.trialUsed ?? false,
    billing: billing?.primary ?? null,
    quebecBlocked: false,
  });
  return <PlansView tools={tools} cta={cta} trialOffered={flow && !(billing?.trialUsed ?? false)} quebecBlocked={false} />;
}
