import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getSessionUser, requireUser } from '@/lib/auth/session';

// /account is a router stub: SUPER_ADMIN / ADMIN → /dashboard, everyone else → /app.
// Kept as a stable URL for the marketing-site CTA + bookmarks.
export default async function AccountRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser('/account');
  const session = await getSessionUser();
  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN';
  redirect(isAdmin ? '/dashboard' : '/app');
}
