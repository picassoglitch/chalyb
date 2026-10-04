// A legal document rendered from Law's Markdown (WS-12, old P6-1): the
// current version at its fixed path (/legal/subscription) and every archived
// version at its versioned URL (/legal/subscription/v1-0), which consent
// events cite and which never changes once published.
//
// Until LEGAL_PUBLISH takes effect (flag on AND no draft/placeholder left,
// flags.ts legalPublished()) the page says it's a draft that isn't in force
// yet, and is kept out of search (noindex, not in the sitemap).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { legalPublished } from '@/lib/config/flags';
import {
  archived,
  currentVersion,
  legalPath,
  listVersions,
  parseVersionSlug,
  renderedBlocks,
  versionMeta,
  versionSlug,
  type LegalDoc,
} from '@/lib/legal/registry';
import { inlineText } from '@/lib/legal/markdown';
import { formatFechaLarga } from '@/lib/billing/format';
import { localizedPath, publicPageMetadata } from '@/lib/site';
import { LegalPage } from './legal-page';
import { LegalMarkdown } from './legal-markdown';

/** messages: legal.<key>.{title,metaTitle,metaDescription} */
const MESSAGE_KEY: Record<LegalDoc, string> = {
  terminos: 'terms',
  suscripcion: 'subscription',
  privacidad: 'privacy',
  uso_aceptable: 'acceptableUse',
};

/** A version page is live when that version is published; the draft of the
 *  current version is shown (marked) so the footer never links a 404. */
function resolveVersion(doc: LegalDoc, slug?: string): string | null {
  if (slug === undefined) return currentVersion(doc);
  const v = parseVersionSlug(slug);
  return v && archived(doc, v) ? v : null;
}

export async function legalDocMetadata(
  doc: LegalDoc,
  locale: string,
  versionSlugParam?: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: `legal.${MESSAGE_KEY[doc]}` });
  const v = resolveVersion(doc, versionSlugParam);
  const path = versionSlugParam && v ? `${legalPath(doc)}/${versionSlug(v)}` : legalPath(doc);
  const meta = publicPageMetadata(path, locale, {
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
  const draft = !legalPublished() || (v !== null && !versionMeta(doc, v)?.published);
  return draft ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export async function LegalDocPage({
  doc,
  locale,
  versionSlugParam,
}: {
  doc: LegalDoc;
  locale: string;
  versionSlugParam?: string;
}) {
  setRequestLocale(locale);
  const version = resolveVersion(doc, versionSlugParam);
  const list = version ? renderedBlocks(doc, version) : null;
  if (!version || !list) notFound();

  const t = await getTranslations({ locale, namespace: 'legal' });
  const user = await getCurrentUser();
  const meta = versionMeta(doc, version);
  const live = legalPublished() && Boolean(meta?.published);
  const title = list.find((b) => b.t === 'h' && b.level === 1);
  const effective = meta?.effective ? formatFechaLarga(meta.effective, locale) : t('doc.noDate');
  const others = listVersions(doc).filter((v) => v !== version);
  const sha = archived(doc, version)?.sha256 ?? '';

  return (
    <LegalPage
      title={title && title.t === 'h' ? inlineText(title.c) : t(`${MESSAGE_KEY[doc]}.title`)}
      lastUpdated={t('doc.versionLine', { version, fecha: effective })}
      isAuthenticated={user !== null}
    >
      {!live && (
        <p className="legal-callout" role="note">
          <strong>{t('doc.draftTitle')}</strong> {t('doc.draftBody')}
        </p>
      )}
      {locale !== 'es' && (
        <p className="legal-callout" lang="en">
          {t('doc.spanishPrevails')}
        </p>
      )}
      <div lang="es">
        <LegalMarkdown blocks={list} tocLabel={t('doc.toc')} />
      </div>
      <hr />
      <p style={{ fontSize: 13 }}>
        {t('doc.fixedUrl')}{' '}
        <a href={localizedPath(`${legalPath(doc)}/${versionSlug(version)}`, locale)}>
          {legalPath(doc)}/{versionSlug(version)}
        </a>
        <br />
        <span style={{ fontFamily: 'var(--font-mono), monospace', wordBreak: 'break-all' }}>
          SHA-256 {sha}
        </span>
      </p>
      {others.length > 0 && (
        <p style={{ fontSize: 13 }}>
          {t('doc.otherVersions')}{' '}
          {others.map((v, i) => (
            <span key={v}>
              {i > 0 && ' · '}
              <a href={localizedPath(`${legalPath(doc)}/${versionSlug(v)}`, locale)}>{v}</a>
            </span>
          ))}
        </p>
      )}
    </LegalPage>
  );
}
