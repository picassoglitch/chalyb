// /dashboard/overview — merged into the Centro de mando at /dashboard.
//
// Overview and Operaciones were two nav items rendering the same engines
// two ways; the command center now answers both. This redirect keeps old
// links, bookmarks and anything that deep-linked here working.

import { redirect } from '@/i18n/routing';

export default async function OverviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/dashboard', locale });
}
