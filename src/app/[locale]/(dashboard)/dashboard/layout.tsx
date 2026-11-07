import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { interApp as inter, jetbrainsMono as mono, spaceGrotesk as grotesk } from '@/fonts';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { isAdminRole } from '@/lib/billing/tiers';
import { BfcacheGuard } from '@/components/auth/bfcache-guard';
import { ProfileSubscriber } from '@/components/workspace/profile-subscriber';
import './dashboard.css';
import '@/styles/chalyb-tokens.css';

// The owner panel's gate and fonts. Two shells below it: (admin) for the
// six rebuilt routes (P5), (legacy) for main's other screens.

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/dashboard');
  const session = await getSessionUser();
  // Fail closed: a session read that comes back empty (a transient Supabase
  // error after requireUser passed) must not render the admin panel.
  if (!session || !isAdminRole(session.role)) {
    return redirect({ href: '/app', locale: await getLocale() });
  }
  return (
    <div className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <BfcacheGuard />
      {/* Auto-refresh the admin's view when their own profile changes (e.g.
          if another super-admin demotes them, the redirect to /app fires on
          the next render instead of waiting for a manual reload). */}
      <ProfileSubscriber userId={session.user.id} />
      {children}
    </div>
  );
}
