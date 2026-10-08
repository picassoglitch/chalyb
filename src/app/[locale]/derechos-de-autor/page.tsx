import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';
import { TakedownForm } from '@/components/legal/takedown-form';
import { localizedPath, publicPageMetadata } from '@/lib/site';

// chalyb.com/derechos-de-autor: the copyright notice form Uso aceptable §5.1
// names. Public (claimants rarely have an account).

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'takedown' });
  return publicPageMetadata('/derechos-de-autor', locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export const dynamic = 'force-dynamic';

export default async function TakedownPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'takedown' });
  const user = await getCurrentUser();
  return (
    <LegalPage title={t('title')} meta={t('policy')} isAuthenticated={user !== null}>
      <p>{t('intro')}</p>
      <ul>
        <li>{t('steps.remove')}</li>
        <li>{t('steps.block')}</li>
        <li>{t('steps.notify')}</li>
        <li>{t('steps.counter')}</li>
      </ul>
      <p>
        {t('policyLinkLead')}{' '}
        <a
          href={`${localizedPath('/legal/acceptable-use', locale)}#5-procedimiento-de-aviso-y-retirada-derechos-de-autor`}
        >
          {t('policyLink')}
        </a>
      </p>
      <TakedownForm />
    </LegalPage>
  );
}
