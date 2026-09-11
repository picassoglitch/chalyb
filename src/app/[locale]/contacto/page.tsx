import { setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ContactPage } from '@/components/contact/contact-page';

export const metadata = {
  title: 'Contacto · Chalyb',
  description:
    'Hablemos. Escríbenos sobre integraciones, alianzas, demos o cualquier duda sobre la plataforma.',
};

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
