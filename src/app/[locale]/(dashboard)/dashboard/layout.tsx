import { redirect } from 'next/navigation';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { BfcacheGuard } from '@/components/auth/bfcache-guard';
import { listEngines } from '@/lib/data/engines';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ProfileSubscriber } from '@/components/workspace/profile-subscriber';
import {
  countUnreadForAdmin,
  countUnreadInquiriesForAdmin,
} from '@/lib/messages/messages-data';
import './dashboard.css';

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

function roleLabel(role: string) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin · Org root';
    case 'ADMIN':
      return 'Admin';
    case 'OPERATOR':
      return 'Operator';
    case 'EDITOR':
      return 'Editor';
    case 'CLIENT':
      return 'Client';
    default:
      return 'Viewer';
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser('/dashboard');

  const session = await getSessionUser();

  // Role gate: only SUPER_ADMIN and ADMIN can see the operator command center.
  // Everyone else (OPERATOR / EDITOR / VIEWER / CLIENT) is silently redirected
  // to /app — the subscriber workspace they should be using.
  // This guards every /dashboard/* route below this layout, including any URL
  // typed directly into the address bar.
  if (
    session &&
    session.role !== 'SUPER_ADMIN' &&
    session.role !== 'ADMIN'
  ) {
    redirect('/app');
  }

  const email = session?.user.email ?? 'operator@chalyb.com';
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    email.split('@')[0] ||
    'Operator';
  const initial = fullName.charAt(0).toUpperCase();
  const role = session?.role ?? 'VIEWER';

  // listEngines is the heaviest fetch on this layout — wrapped in try so
  // a Supabase outage / missing engines table doesn't 500 the whole
  // admin shell. The shell can render with an empty engine list; the
  // /dashboard/* pages handle the empty case themselves.
  let engines: Awaited<ReturnType<typeof listEngines>> = [];
  try {
    engines = await listEngines();
  } catch (err) {
    console.error('[dashboard-layout] listEngines failed:', err);
  }

  // Sidebar badge — combine inbound subscriber messages + landing-form
  // partner inquiries into one number, since both surfaces live in the
  // same /dashboard/messages inbox. Two parallel COUNTs (HEAD requests
  // against the postgres count cache) — total round-trip stays sub-100 ms.
  //
  // Both calls wrapped in catch because the messages + partner_inquiries
  // tables are from migration 0014 and an unapplied migration on prod
  // would 500 the whole admin shell on every action POST re-render
  // (Next.js re-renders the layout too, not just the page).
  let unreadMessages = 0;
  try {
    const [unreadMsgs, unreadInquiries] = await Promise.all([
      countUnreadForAdmin().catch(() => 0),
      countUnreadInquiriesForAdmin().catch(() => 0),
    ]);
    unreadMessages = unreadMsgs + unreadInquiries;
  } catch {
    unreadMessages = 0;
  }

  return (
    <div className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <BfcacheGuard />
      {/* Auto-refresh the admin's view when their own profile changes (e.g.
          if another super-admin demotes them, the redirect to /app fires on
          the next render instead of waiting for a manual reload). */}
      {session?.user.id && <ProfileSubscriber userId={session.user.id} />}
      <DashboardShell
        initialEngines={engines}
        userInitial={initial}
        userName={fullName}
        userRole={roleLabel(role)}
        unreadMessages={unreadMessages}
      >
        {children}
      </DashboardShell>
    </div>
  );
}
