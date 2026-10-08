import { legalDraftsAsPublished, legalPublished } from '@/lib/config/flags';
import { currentVersion, versionMeta, type LegalDoc } from './registry';

/** Whether a version is the text in force (the local e2e override treats
 *  drafts as published). A document that isn't in force renders "en
 *  revisión" with noindex, so it stays out of the sitemap too. */
export function inForce(doc: LegalDoc, version = currentVersion(doc)): boolean {
  return (
    legalPublished() && (Boolean(versionMeta(doc, version)?.published) || legalDraftsAsPublished())
  );
}
