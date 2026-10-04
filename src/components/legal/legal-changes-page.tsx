import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { LegalPage } from '@/components/legal/legal-page';
import { formatFechaLarga } from '@/lib/billing/format';
import { versionInForceAt } from '@/lib/legal/legal-server';
import { legalPath, parseVersionSlug, versionMeta, versionSlug } from '@/lib/legal/registry';
import { localizedPath } from '@/lib/site';
import type { ReacceptDoc } from '@/lib/legal/reaccept';

// aceptacion-ux §8 · "Ver todos los cambios": what changed in a version of
// a document people re-accept (Términos, Suscripción, Privacidad), with its
// date and a link to the full versioned text. /terminos/cambios/{version}
// redirects to the Términos one.
export type Params = { params: Promise<{ locale: string; version: string }> };

export async function legalChangesMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'termsUpdate.changesPage' });
  return { title: t('title'), robots: { index: false, follow: true } };
}

export async function LegalChangesPage({ doc, params }: { doc: ReacceptDoc } & Params) {
  const { locale, version: slug } = await params;
  setRequestLocale(locale);
  const version = parseVersionSlug(slug);
  const meta = version ? versionMeta(doc, version) : null;
  if (!version || !meta) notFound();
  const t = await getTranslations({ locale, namespace: 'termsUpdate.changesPage' });
  const user = await getCurrentUser();
  const inForceAt = await versionInForceAt(doc, version);
  const fecha = inForceAt ? formatFechaLarga(inForceAt, locale) : t('noDate');
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
        <a href={localizedPath(`${legalPath(doc)}/${versionSlug(version)}`, locale)}>
          {t('fullText')}
        </a>
      </p>
    </LegalPage>
  );
}
