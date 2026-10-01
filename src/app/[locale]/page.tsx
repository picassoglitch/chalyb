import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingPage } from '@/components/landing/landing-page';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  // The landing's tab title is the bare tagline, not "%s · Chalyb".
  const meta = publicPageMetadata('/', locale, {
    title: t('title'),
    description: t('description'),
  });
  return { ...meta, title: { absolute: t('title') } };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return <LandingPage isAuthenticated={user !== null} />;
}
