// Server side of the Terms update (aceptacion-ux §8): asks the consent log
// what this user should see for the current Términos, Suscripción and
// Privacidad versions and renders the modal, the banner, or nothing.

import { getLocale } from 'next-intl/server';
import type { SessionUser } from '@/lib/auth/session';
import { termsPromptFor } from '@/lib/legal/reaccept-server';
import { legalPath, versionSlug } from '@/lib/legal/registry';
import { localizedPath } from '@/lib/site';
import { TermsNoticeBanner, TermsReacceptModal } from './terms-update';

export async function TermsNotice({ session }: { session: SessionUser }) {
  const locale = await getLocale();
  const v = await termsPromptFor(session.user.id, locale).catch(() => null);
  if (!v || v.prompt === 'none') return null;
  const view = {
    doc: v.doc,
    version: v.version,
    effective: v.effective,
    changes: v.changes,
    changesHref: localizedPath(`${legalPath(v.doc)}/changes/${versionSlug(v.version)}`, locale),
  };
  // Keyed by document: after "Aceptar" the next pending one (e.g. Suscripción after Términos)
  // mounts fresh, instead of inheriting the busy (disabled) button of the one just accepted.
  const key = `${v.doc}:${v.version}`;
  return v.prompt === 'modal' ? (
    <TermsReacceptModal key={key} v={view} />
  ) : (
    <TermsNoticeBanner key={key} v={view} />
  );
}
