import { setRequestLocale } from 'next-intl/server';
import { LandingPage } from '@/components/landing/landing-page';
import { getCurrentUser } from '@/lib/auth/session';
import { getPublicFleet } from '@/lib/data/public-engines';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, fleet] = await Promise.all([getCurrentUser(), getPublicFleet()]);
  return <LandingPage isAuthenticated={user !== null} fleet={fleet} />;
}
