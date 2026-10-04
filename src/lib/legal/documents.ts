// The legal documents a consent event cites, with version, URL and hash.
// Versions live in registry.json; hashes come from `pnpm legal:hash`
// (document-hashes.json). Each URL is the fixed, versioned page
// (/legal/subscription/v1-0), which never changes once published.
//
// A version that isn't in force yet is cited as "<version>-draft" (7a
// review): whatever someone accepts against a draft (a tool's risk notice)
// is asked again once the real version is published.

import { canonicalOrigin } from '@/lib/site';
import { legalPublished } from '@/lib/config/flags';
import hashes from './document-hashes.json' with { type: 'json' };
import { currentVersion, legalPath, versionMeta, versionSlug, type LegalDoc } from './registry';

export type { LegalDoc };

// TODO(OPS-10): versions are published when the attorney signs and the
// owner's values replace every bracket; until then these are Law's drafts.
export function legalDocument(doc: LegalDoc) {
  const version = currentVersion(doc);
  const inForce = legalPublished() && Boolean(versionMeta(doc, version)?.published);
  return {
    doc,
    version: inForce ? version : `${version}-draft`,
    url: `${canonicalOrigin()}${legalPath(doc)}/${versionSlug(version)}`,
    sha256: (hashes as Record<LegalDoc, string>)[doc],
  };
}

export const legalDocuments = (...docs: LegalDoc[]) => docs.map(legalDocument);
