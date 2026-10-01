import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';
import { LandingNav } from '@/components/landing/nav';
import { LandingFooter } from '@/components/landing/footer';
import { PlansSection } from '@/components/app/billing/plans-page';
import '@/styles/chalyb-tokens.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plans' });
  return publicPageMetadata('/planes', locale, { title: t('metaTitle'), description: t('metaDescription') });
}

// /planes (SCR-12), public. P4 rebuilds the public chrome; the plans
// themselves are final.

export default async function PlanesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser().catch(() => null);
  return (
    <div className="lp">
      <LandingNav isAuthenticated={user !== null} />
      <main className="chalyb-app" style={{ padding: '48px 16px 64px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <PlansSection />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
