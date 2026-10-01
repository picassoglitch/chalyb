import { getSessionUser } from '@/lib/auth/session';
import { listEngines } from '@/lib/data/engines';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { countUnreadForAdmin, countUnreadInquiriesForAdmin } from '@/lib/messages/messages-data';
import { listNotifications } from '@/lib/data/ops';

// Main's admin screens that P5 didn't rebuild keep their shell (sidebar,
// metric strip, rail). The parent layout already checked the admin role.

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

export default async function LegacyDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  const email = session?.user.email ?? 'operator@chalyb.com';
  const meta = session?.user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    email.split('@')[0] ||
    'Operator';
  const initial = fullName.charAt(0).toUpperCase();
  const role = session?.role ?? 'VIEWER';

  let engines: Awaited<ReturnType<typeof listEngines>> = [];
  try {
    engines = await listEngines();
  } catch (err) {
    console.error('[dashboard-layout] listEngines failed:', err);
  }

  const [unreadMsgs, unreadInquiries, notifications] = await Promise.all([
    countUnreadForAdmin().catch(() => 0),
    countUnreadInquiriesForAdmin().catch(() => 0),
    listNotifications().catch(() => []),
  ]);

  return (
    <DashboardShell
      initialEngines={engines}
      userInitial={initial}
      userName={fullName}
      userRole={roleLabel(role)}
      unreadMessages={unreadMsgs + unreadInquiries}
      unreadNotifications={notifications.filter((n) => !n.read_at).length}
    >
      {children}
    </DashboardShell>
  );
}
