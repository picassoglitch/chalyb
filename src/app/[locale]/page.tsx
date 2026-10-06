import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LandingPage } from '@/components/landing/landing-page';
import { getCurrentUser } from '@/lib/auth/session';
import { publicPageMetadata } from '@/lib/site';
import { trialFlowEnabled } from '@/lib/config/flags';

/** The landing's share card (LANDING-SPEC §6): the hero composite and the h1
 *  on --bg, no prices. Built by scripts/og-landing.mjs. */
const LANDING_OG_IMAGE = {
  url: '/og/landing.png',
  width: 1200,
  height: 630,
  type: 'image/png',
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });
  const tm = await getTranslations({ locale, namespace: 'meta' });
  const title = t('title');
  // The trial claim only when the trial can be started (K-7).
  const description = trialFlowEnabled() ? t('description') : tm('descriptionNoTrial');
  const meta = publicPageMetadata('/', locale, { title, description });
  const images = [{ ...LANDING_OG_IMAGE, alt: title }];
  // The landing's tab title is the bare tagline, not "%s · Chalyb".
  return {
    ...meta,
    title: { absolute: title },
    openGraph: { ...meta.openGraph, type: 'website', siteName: 'Chalyb', images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser().catch(() => null);
  return <LandingPage signedIn={user !== null} />;
}
