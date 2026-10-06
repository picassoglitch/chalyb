// Gate for every Clips screen: signed in, and Clips included for this user.
// Anything else goes to the Clips tool page, which explains the offer.

import 'server-only';
import { redirect } from '@/i18n/routing';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { getEntitlements, type Entitlements } from '@/lib/billing/entitlement';

export async function requireClipsAccess(
  locale: string,
  next: string,
): Promise<{ session: SessionUser; entitlements: Entitlements }> {
  const session = await getSessionUser();
  if (!session) return redirect({ href: `/sign-in?next=${encodeURIComponent(next)}`, locale });
  const entitlements = await getEntitlements(session);
  if (entitlements.tools.chalybclip?.state !== 'included') {
    return redirect({ href: '/app/clips', locale });
  }
  return { session, entitlements };
}
