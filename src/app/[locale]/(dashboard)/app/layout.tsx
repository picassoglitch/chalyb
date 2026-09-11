import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { BfcacheGuard } from '@/components/auth/bfcache-guard';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { WorkspaceProfileSubscriber } from '@/components/workspace/workspace-profile-subscriber';
import { effectiveTier, isAdminRole, tierLabelShort } from '@/lib/billing/tiers';
import { countUnreadForUser } from '@/lib/messages/messages-data';
import '../dashboard/dashboard.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
  const email = session?.user.email ?? 'operator@chalyb.com';
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    email.split('@')[0] ||
    'Operator';
  const initial = fullName.charAt(0).toUpperCase();
  // Stored tier from profiles.tier — only matters for non-admin users.
  // Admins get effective VIP no matter what, via effectiveTier().
  // The sidebar pill shows the EFFECTIVE tier so the experience matches what
  // they can actually do — admins see "ALL-ACCESS" regardless of billing row.
  const role = session?.role ?? 'VIEWER';
  const isAdmin = isAdminRole(role);
  const storedTier = session?.tier ?? 'FREE';
  const tier = effectiveTier(role, storedTier);
  const tierLabel = isAdmin ? `${tierLabelShort(tier)} · ADMIN` : tierLabelShort(tier);

  // Sidebar badge — admin-sent messages this user hasn't opened yet.
  // The /app/messages page auto-marks the thread read on render via
  // markThreadReadAsUser, so this drops to 0 as soon as they visit.
  //
  // Wrapped in try/catch because this fn is called on EVERY layout
  // render (including the re-render that fires after every server
  // action POST). If the messages table is missing (migration 0014
  // not applied) or the admin client can't initialize, an unhandled
  // throw here would 500 the whole layout — meaning every action
  // succeeds but the page can never re-render. That was the symptom
  // the operator hit on /app/usage: action OK, RSC re-render dies.
  let unreadMessages = 0;
  if (session?.user.id) {
    try {
      unreadMessages = await countUnreadForUser(session.user.id);
    } catch {
      unreadMessages = 0;
    }
  }

  return (
    <div className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <BfcacheGuard />
      {session?.user.id && <WorkspaceProfileSubscriber userId={session.user.id} />}
      <WorkspaceShell
        userInitial={initial}
        userName={fullName}
        tierLabel={tierLabel}
        isAdmin={isAdmin}
        unreadMessages={unreadMessages}
      >
        {children}
      </WorkspaceShell>
    </div>
  );
}
