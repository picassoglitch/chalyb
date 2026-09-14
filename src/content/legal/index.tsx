import type { ReactElement } from 'react';
import { routing } from '@/i18n/routing';
import { PrivacyDocumentEs } from './privacy.es';
import { PrivacyDocumentEn } from './privacy.en';
import { TermsDocumentEs } from './terms.es';
import { TermsDocumentEn } from './terms.en';

/**
 * Locale → legal document. Legal prose is a per-locale document rather than a
 * bag of translated strings, so it lives in these modules instead of
 * messages/*.json.
 *
 * These return the rendered element rather than the component type: picking a
 * component at render time and mounting it remounts the subtree whenever the
 * choice changes, so the selection happens here, once, per document.
 *
 * Unknown locales fall back to the default locale — a legal page must always
 * render something.
 */
const PRIVACY = {
  es: () => <PrivacyDocumentEs />,
  en: () => <PrivacyDocumentEn />,
};

const TERMS = {
  es: () => <TermsDocumentEs />,
  en: () => <TermsDocumentEn />,
};

export function privacyDocument(locale: string): ReactElement {
  return (PRIVACY[locale as keyof typeof PRIVACY] ?? PRIVACY[routing.defaultLocale])();
}

export function termsDocument(locale: string): ReactElement {
  return (TERMS[locale as keyof typeof TERMS] ?? TERMS[routing.defaultLocale])();
}
