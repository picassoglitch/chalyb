// The legal documents a consent event cites, with version, URL and hash.
// Hashes come from `pnpm legal:hash` (document-hashes.json); bump the version
// here whenever a text changes. P6 publishes the pages at these URLs.

import { canonicalOrigin } from '@/lib/site';
import hashes from './document-hashes.json' with { type: 'json' };

export type LegalDoc = 'terminos' | 'suscripcion' | 'privacidad' | 'uso_aceptable';

// TODO(OPS-10): versions become 1.0 when the attorney signs and LEGAL_PUBLISH
// turns on; until then these are the Law-revised drafts.
const VERSIONS: Record<LegalDoc, string> = {
  terminos: '1.0',
  suscripcion: '1.0',
  privacidad: '1.0',
  uso_aceptable: '1.0',
};

const PATHS: Record<LegalDoc, string> = {
  terminos: '/terminos',
  suscripcion: '/suscripcion',
  privacidad: '/privacidad',
  uso_aceptable: '/uso-aceptable',
};

export function legalDocument(doc: LegalDoc) {
  const version = VERSIONS[doc];
  return {
    doc,
    version,
    url: `${canonicalOrigin()}${PATHS[doc]}/v${version.replace('.', '-')}`,
    sha256: (hashes as Record<LegalDoc, string>)[doc],
  };
}

export const legalDocuments = (...docs: LegalDoc[]) => docs.map(legalDocument);
