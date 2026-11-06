import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';
import { PublicNav } from '@/components/public/public-nav';
import { PublicFooter } from '@/components/public/public-footer';
import { PlansSection } from '@/components/app/billing/plans-page';
import { CatalogUnavailable } from '@/components/landing/catalog-unavailable';
import { listActiveTools } from '@/lib/tools/public-tools-server';
import '@/styles/chalyb-tokens.css';
import '@/styles/chalyb-public.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'plans' });
  if ((await listActiveTools()).length === 0) {
    const unavailable = await getTranslations({ locale, namespace: 'landing.meta' });
    return {
      ...publicPageMetadata('/planes', locale, {
        title: unavailable('unavailableTitle'),
        description: unavailable('unavailableDescription'),
      }),
      title: { absolute: unavailable('unavailableTitle') },
      robots: { index: false, follow: true },
    };
  }
  return publicPageMetadata('/planes', locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

// /planes (SCR-12), public, in the public site's chrome (P4-2).

export default async function PlanesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, tools] = await Promise.all([getCurrentUser().catch(() => null), listActiveTools()]);
  if (tools.length === 0) return <CatalogUnavailable signedIn={user !== null} />;
  const clipsActive = tools.some((tool) => tool.slug === 'chalybclip');
  return (
    <div className="chalyb-app pub">
      <PublicNav signedIn={user !== null} />
      <main id="main" style={{ padding: '48px 16px 64px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <PlansSection clipsActive={clipsActive} />
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
