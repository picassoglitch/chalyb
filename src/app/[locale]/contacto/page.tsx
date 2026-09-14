import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { ContactPage } from '@/components/contact/contact-page';

// The root layout's title template is '%s · Chalyb', so the title here is the
// bare page name — the previous static 'Contacto · Chalyb' rendered as
// "Contacto · Chalyb · Chalyb". It also has to be per-locale, which a static
// `metadata` export can't be.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function ContactRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  return <ContactPage isAuthenticated={user !== null} />;
}
