import { getSessionUser } from '@/lib/auth/session';
import { AdminShell } from '@/components/dashboard/admin/admin-shell';

// The six rebuilt owner-panel routes (P5): the app's light design system.

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  const meta = session?.user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    session?.user.email?.split('@')[0] ||
    'Admin';
  return <AdminShell ownerName={name}>{children}</AdminShell>;
}
