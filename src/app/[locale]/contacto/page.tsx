import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ContactPage } from '@/components/contact/contact-page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  // Bare page name only. The locale layout's `%s · Chalyb` template appends
  // the brand — spelling it out here is what produced "Contacto · Chalyb ·
  // Chalyb" in the tab.
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function ContactRoute({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return <ContactPage isAuthenticated={user !== null} />;
}
