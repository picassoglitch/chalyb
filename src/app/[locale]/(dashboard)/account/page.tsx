import { cookies } from 'next/headers';
import { redirect } from '@/i18n/routing';
import { setRequestLocale } from 'next-intl/server';
import { getSessionUser, requireUser } from '@/lib/auth/session';
import { LANG_COOKIE, accountLocale } from '@/lib/tools/routes';

// /account is a router stub: SUPER_ADMIN / ADMIN → /dashboard, everyone else → /app.
// It is the default landing after sign-in, so it follows the toggle's saved language.
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
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  redirect({ href: isAdmin ? '/dashboard' : '/app', locale: accountLocale(locale, saved) });
}
