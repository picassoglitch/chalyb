import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import { PlansSection } from '@/components/app/billing/plans-page';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plans' });
  return publicPageMetadata('/planes', locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

// /planes (SCR-12), public, in the public site's chrome (P4-2).

export default async function PlanesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="chalyb-app pub">
      <PublicNav signedIn={user !== null} />
      <main id="main" style={{ padding: '48px 16px 64px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <PlansSection />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
