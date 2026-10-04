import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';
import { formatFechaLarga } from '@/lib/billing/format';
import { legalPath, parseVersionSlug, versionMeta, versionSlug } from '@/lib/legal/registry';
import { localizedPath } from '@/lib/site';

// aceptacion-ux §8 · "Ver todos los cambios" (/terminos/cambios/{version}
// redirects here): what changed in a Términos version, with its date and a
// link to the full versioned text.
type Params = { params: Promise<{ locale: string; version: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'termsUpdate.changesPage' });
  return { title: t('title'), robots: { index: false, follow: true } };
}

export const dynamic = 'force-dynamic';

export default async function TermsChangesPage({ params }: Params) {
  const { locale, version: slug } = await params;
  setRequestLocale(locale);
  const version = parseVersionSlug(slug);
  const meta = version ? versionMeta('terminos', version) : null;
  if (!version || !meta) notFound();
  const t = await getTranslations({ locale, namespace: 'termsUpdate.changesPage' });
  const user = await getCurrentUser();
  const fecha = meta.effective ? formatFechaLarga(meta.effective, locale) : t('noDate');
  return (
    <LegalPage
      title={t('title')}
      lastUpdated={t('versionLine', { version, fecha })}
      isAuthenticated={user !== null}
    >
      {meta.changes.length ? (
        <ul>
          {meta.changes.map((c) => (
            <li key={c} lang="es">
              {c}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('none')}</p>
      )}
      <p>
        <a href={localizedPath(`${legalPath('terminos')}/${versionSlug(version)}`, locale)}>
          {t('fullText')}
        </a>
      </p>
    </LegalPage>
  );
}
