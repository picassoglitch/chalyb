// The owner panel's gate, for pages, actions and route handlers. Same rule
// as the /dashboard layout: ADMIN or SUPER_ADMIN; anyone else goes to /app.

import 'server-only';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser, type SessionUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';

export async function adminSession(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session && isAdminRole(session.role) ? session : null;
}

/** For pages: redirect non-admins exactly as the layout does. */
export async function requireAdminPage(): Promise<SessionUser> {
  const session = await adminSession();
  // next-intl's redirect keeps the reader's language (/en/dashboard → /en/app).
  if (!session) return redirect({ href: '/app', locale: await getLocale() });
  return session;
}

export function adminName(s: SessionUser): string {
  const m = s.user.user_metadata ?? {};
  return (typeof m.full_name === 'string' && m.full_name) || s.user.email || 'Admin';
}
