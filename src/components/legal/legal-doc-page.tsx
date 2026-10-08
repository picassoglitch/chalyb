// A legal document rendered from Law's Markdown (WS-12, old P6-1): the
// current version at its fixed path (/legal/subscription) and every archived
// version at its versioned URL (/legal/subscription/v1-0), which consent
// events cite and which never changes once published.
//
// A version that isn't in force (LEGAL_PUBLISH not in effect, or the version
// not marked published) shows a short "en revisión" page instead of Law's
// draft: no owner/attorney notes or unfilled brackets go public, and the
// footer link still answers 200. It is kept out of search (noindex, not in
// the sitemap).

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth/session';
import { inForce } from '@/lib/legal/in-force';
import {
  archived,
  currentVersion,
  legalPath,
  listVersions,
  parseVersionSlug,
  renderedBlocks,
  renderedSource,
  versionSlug,
  type LegalDoc,
} from '@/lib/legal/registry';
import { inlineText } from '@/lib/legal/markdown';
import { formatFechaLarga } from '@/lib/billing/format';
import { versionInForceAt } from '@/lib/legal/legal-server';
import { localizedPath, publicPageMetadata } from '@/lib/site';
import { loadPricedPacks } from '@/lib/payments/pack-prices';
import { sha256 } from '@/lib/billing/consent-core';
import { LegalPage } from './legal-page';
import { LegalMarkdown } from './legal-markdown';

/** messages: legal.<key>.{title,metaTitle,metaDescription} */
const MESSAGE_KEY: Record<LegalDoc, string> = {
  terminos: 'terms',
  suscripcion: 'subscription',
  privacidad: 'privacy',
  uso_aceptable: 'acceptableUse',
  paquetes: 'packs',
  quien_vende: 'seller',
};

/** A version page is live when that version is published; the draft of the
 *  current version is shown (marked) so the footer never links a 404. */
function resolveVersion(doc: LegalDoc, slug?: string): string | null {
  if (slug === undefined) return currentVersion(doc);
  const v = parseVersionSlug(slug);
  return v && archived(doc, v) ? v : null;
}

// inForce lives in a plain module so the sitemap (and its tests) can use it.
export { inForce };

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
  const draft = v === null || !inForce(doc, v);
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
  // The packs text names the owner's pack prices in force (Ajustes), the
  // same totals the checkout charges. A published version keeps its own.
  const packs = doc === 'paquetes' ? (await loadPricedPacks().catch(() => null))?.totals : undefined;
  const list = version ? renderedBlocks(doc, version, packs) : null;
  if (!version || !list) notFound();

  const t = await getTranslations({ locale, namespace: 'legal' });
  const user = await getCurrentUser();

  if (!inForce(doc, version)) {
    return (
      <LegalPage
        title={t(`${MESSAGE_KEY[doc]}.title`)}
        meta={t('doc.reviewLine')}
        isAuthenticated={user !== null}
      >
        <p className="legal-callout" role="note">
          <strong>{t('doc.draftTitle')}</strong> {t('doc.draftBody')}
        </p>
        <p>
          {t('doc.currentLead')}{' '}
          <a href={localizedPath('/legal/terms', locale)}>{t('terms.title')}</a> ·{' '}
          <a href={localizedPath('/legal/privacy', locale)}>{t('privacy.title')}</a>
        </p>
      </LegalPage>
    );
  }

  const title = list.find((b) => b.t === 'h' && b.level === 1);
  // "Vigente desde": the date it really applies (later if notices ran late).
  const inForceAt = await versionInForceAt(doc, version);
  const effective = inForceAt ? formatFechaLarga(inForceAt, locale) : t('doc.noDate');
  const others = listVersions(doc).filter((v) => v !== version);
  // The hash of the text on this page (what a pack consent cites); for every
  // other document and any published version it is the archived hash.
  const shown = renderedSource(doc, version, packs);
  const sha = shown === null ? '' : sha256(shown);

  return (
    <LegalPage
      title={title && title.t === 'h' ? inlineText(title.c) : t(`${MESSAGE_KEY[doc]}.title`)}
      meta={t('doc.versionLine', { version, fecha: effective })}
      isAuthenticated={user !== null}
    >
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
