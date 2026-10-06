import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';
import { termsDocument } from '@/content/legal';
import { publicPageMetadata } from '@/lib/site';
import { legalPublished } from '@/lib/config/flags';
import { LegalDocPage, legalDocMetadata } from '@/components/legal/legal-doc-page';

// The root layout's title template is '%s · Chalyb', so the title here is the
// bare document name. Both title and description are per-locale, which a
// static `metadata` export can't express.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (legalPublished()) return legalDocMetadata('terminos', locale);
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return publicPageMetadata('/legal/terms', locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

// force-dynamic so Vercel's CDN never serves a stale 404 from before the
// route existed. The page is cheap (no DB, just getCurrentUser for nav
// state), so per-request rendering has no real cost.
export const dynamic = 'force-dynamic';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // WS-12 · Law's new text once LEGAL_PUBLISH takes effect; the current
  // document (what today's users accepted) until then.
  if (legalPublished()) return <LegalDocPage doc="terminos" locale={locale} />;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  const user = await getCurrentUser();
  return (
    <LegalPage title={t('title')} lastUpdated={t('lastUpdated')} isAuthenticated={user !== null}>
      {termsDocument(locale)}
    </LegalPage>
  );
}
