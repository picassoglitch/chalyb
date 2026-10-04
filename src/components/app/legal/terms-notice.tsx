// Server side of the Terms update (aceptacion-ux §8): asks the consent log
// what this user should see for the current Términos version and renders the
// modal, the banner, or nothing.

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
    version: v.version,
    effective: v.effective,
    changes: v.changes,
    changesHref: localizedPath(
      `${legalPath('terminos')}/changes/${versionSlug(v.version)}`,
      locale,
    ),
  };
  return v.prompt === 'modal' ? <TermsReacceptModal v={view} /> : <TermsNoticeBanner v={view} />;
}
