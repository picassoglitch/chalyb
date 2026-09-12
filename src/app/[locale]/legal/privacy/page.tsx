import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';
import { LegalDoc } from '@/components/legal/legal-doc';

// force-dynamic so Vercel's CDN never serves a stale 404 from before the
// route existed. The page is cheap (no DB, just getCurrentUser for nav
// state), so per-request rendering has no real cost.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  // `title` is the bare page name — the `%s · Chalyb` template in the locale
  // layout appends the brand, so spelling it out here would double it.
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  const user = await getCurrentUser();
  return (
    <LegalPage title={t('title')} lastUpdated={t('updated')} isAuthenticated={user !== null}>
      <LegalDoc doc="privacy" />
    </LegalPage>
  );
}
