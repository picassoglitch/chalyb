import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingPage } from '@/components/landing/landing-page';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';
import { trialFlowEnabled } from '@/lib/config/flags';

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
    // The trial claim only when the trial can be started (K-7).
    description: trialFlowEnabled() ? t('description') : t('descriptionNoTrial'),
  });
  return { ...meta, title: { absolute: t('title') } };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser().catch(() => null);
  return <LandingPage signedIn={user !== null} />;
}
