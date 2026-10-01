import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { publicPageMetadata } from '@/lib/site';
import { SellerDetails } from '@/components/app/billing/seller';
import '@/styles/chalyb-tokens.css';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seller' });
  return publicPageMetadata('/quien-vende', locale, { title: t('title'), description: t('title') });
}

// /quien-vende (art. 76 Bis fr. III LFPC; P2-13). P6 links it from the
// footer next to the legal pages.

export default async function QuienVendePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('seller');
  return (
    <main className="chalyb-app" style={{ padding: '48px 16px' }}>
      <div className="ch-card" style={{ maxWidth: 640, margin: '0 auto', padding: 32, display: 'grid', gap: 18 }}>
        <h1 className="ch-h1">{t('title')}</h1>
        <SellerDetails />
      </div>
    </main>
  );
}
