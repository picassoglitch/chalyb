// /app/billing — Mi plan. The view is shared with /app/subscription
// (FIX-3 §A.1): components/app/billing/mi-plan-view.tsx.

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/routing';
import { getSessionUser } from '@/lib/auth/session';
import { MiPlanView } from '@/components/app/billing/mi-plan-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myplan');
  return { title: t('title') };
}

export default async function MiPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cancelar?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const session = await getSessionUser();
  if (!session) return redirect({ href: '/sign-in?next=/app/billing', locale });
  // The notice's 1-click cancel link opens the confirmation directly.
  return (
    <MiPlanView
      locale={locale}
      session={session}
      openCancel={sp.cancelar === '1'}
      returnStatus={sp.status}
    />
  );
}
