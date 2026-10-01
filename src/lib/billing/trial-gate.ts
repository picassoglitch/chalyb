// Who may open the trial screens: signed in, not an admin (admins have VIP
// without paying), and only while TRIAL_FLOW_ENABLED is live. Otherwise the
// existing subscription page keeps working as before.

import 'server-only';
import { redirect } from '@/i18n/routing';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { trialFlowEnabled } from '@/lib/config/flags';

export async function requireTrialFlow(locale: string, next: string): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session)
    return redirect({
      href: `/sign-in?mode=signup&intent=trial&next=${encodeURIComponent(next)}`,
      locale,
    });
  if (!trialFlowEnabled() || isAdminRole(session.role))
    return redirect({ href: '/app/subscription', locale });
  return session;
}
