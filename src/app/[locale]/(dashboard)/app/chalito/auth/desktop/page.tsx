import { setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { requireUser } from '@/lib/auth/session';
import { desktopStartPath, handoffFromQuery } from '@/lib/chalito/web/desktop-sso';
import { DesktopHandoff } from '@/components/tools/chalito/DesktopHandoff';

// /app/chalito/auth/desktop?client=desktop&state=…&redirect_uri=chalito://auth/sso: the desktop
// app's "Iniciar sesión" (ADR 0016, First Run A). Signed out → hub sign-in and back here with the
// same query; malformed → Chalito's Inicio.
export default async function DesktopSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const handoff = handoffFromQuery(await searchParams);
  if (!handoff) return redirect({ href: '/app/chalito', locale });
  await requireUser(desktopStartPath(handoff));
  return <DesktopHandoff state={handoff.state} redirect={handoff.redirect} />;
}
