import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/session';
import { ContactPage } from '@/components/contact/contact-page';
import { publicPageMetadata } from '@/lib/site';

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
  return publicPageMetadata('/contacto', locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function ContactRoute({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ categoria?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const { categoria } = await searchParams;
  return (
    <ContactPage
      isAuthenticated={user !== null}
      category={categoria === 'cobro' ? 'cobro' : undefined}
    />
  );
}
