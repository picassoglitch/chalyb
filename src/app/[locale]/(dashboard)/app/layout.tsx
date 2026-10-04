import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { BfcacheGuard } from '@/components/auth/bfcache-guard';
import { AppShell } from '@/components/app/app-shell';
import { planLabelKey } from '@/components/app/shell-routes';
import { WorkspaceProfileSubscriber } from '@/components/workspace/workspace-profile-subscriber';
import { effectiveTier, isAdminRole } from '@/lib/billing/tiers';
import { BillingBanner } from '@/components/app/billing/billing-banner';
import { TermsNotice } from '@/components/app/legal/terms-notice';
import { unreadCount } from '@/lib/notifications/user';
// The legacy dark theme is still needed by the /app screens later phases
// rebuild (they render inside AppShell's legacy panel).
import '../dashboard/dashboard.css';
import '@/styles/chalyb-tokens.css';

// Inter is the new design system's web font (Q27) and the legacy body font.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--cc-body',
  display: 'swap',
});
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--cc-disp',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--cc-mono',
  display: 'swap',
});

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/app');
  const session = await getSessionUser();
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    // F8: never a truncated email. No name yet → the card says "Tu cuenta"
    // and leads to Mi perfil, where the name is asked once.
    '';
  const role = session?.role ?? 'VIEWER';
  // The user card shows the EFFECTIVE plan: admins read as VIP.
  const plan = effectiveTier(role, session?.tier ?? 'FREE');
  const unread = session ? await unreadCount(session.user.id).catch(() => 0) : 0;

  return (
    <div className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <BfcacheGuard />
      {session?.user.id && <WorkspaceProfileSubscriber userId={session.user.id} />}
      <AppShell
        userName={fullName}
        planKey={planLabelKey(plan)}
        isAdmin={isAdminRole(role)}
        unread={unread}
        banner={
          session && !isAdminRole(role) ? (
            <>
              <BillingBanner session={session} />
              <TermsNotice session={session} />
            </>
          ) : null
        }
      >
        {children}
      </AppShell>
    </div>
  );
}
