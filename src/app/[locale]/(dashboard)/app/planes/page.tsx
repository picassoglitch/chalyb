import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlansSection } from '@/components/app/billing/plans-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('plans');
  return { title: t('metaTitle') };
}

export default async function AppPlanesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlansSection />;
}
