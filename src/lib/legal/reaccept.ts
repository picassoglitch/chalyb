// Re-acceptance of the Terms (aceptacion-ux §8; old P6-5), the pure part:
// what a signed-in user sees for the current Términos version.
//
// - relevant change (rights, payments or data), once its effective date has
//   passed → the blocking §8 modal until they accept or choose an option;
// - minor change → the non-blocking banner, once (`terms_notice_shown`);
// - nothing while LEGAL_PUBLISH hasn't taken effect, while the version has
//   no effective date, or when they already accepted this version.
//
// Cancelling and downloading content are never blocked: the modal steps
// aside on those screens (TERMS_MODAL_EXEMPT_PATHS).

import type { VersionMeta } from './registry';

export type TermsPrompt = 'none' | 'modal' | 'banner';

/** What we know from the user's consent log about the Terms. */
export interface TermsHistory {
  /** Highest Términos version they accepted (sign-up, trial, purchase or
   *  re-acceptance), or null. */
  acceptedVersion: string | null;
  /** Versions whose minor-change banner was already shown. */
  noticeShown: string[];
}

/** "1.10" > "1.9": compares dotted versions numerically. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function termsPrompt(input: {
  published: boolean;
  current: string;
  meta: VersionMeta | null;
  history: TermsHistory;
  now: Date;
}): TermsPrompt {
  const { published, current, meta, history, now } = input;
  if (!published || !meta?.published || !meta.effective) return 'none';
  if (now.getTime() < Date.parse(meta.effective)) return 'none';
  if (history.acceptedVersion && compareVersions(history.acceptedVersion, current) >= 0)
    return 'none';
  if (meta.relevance === 'relevant') return 'modal';
  return history.noticeShown.includes(current) ? 'none' : 'banner';
}

/** Event types that accept the Terms they cite. */
export const TERMS_ACCEPTING_EVENTS = [
  'signup_terms_accepted',
  'terms_reaccepted',
  'trial_started',
  'subscription_started',
] as const;

/** Reduces consent rows ({event_type, documents}) to a TermsHistory. */
export function termsHistory(
  rows: { event_type: string; documents: { doc: string; version: string }[] | null }[],
): TermsHistory {
  let accepted: string | null = null;
  const shown = new Set<string>();
  for (const r of rows) {
    const terms = (r.documents ?? []).find((d) => d.doc === 'terminos');
    if (!terms) continue;
    if ((TERMS_ACCEPTING_EVENTS as readonly string[]).includes(r.event_type)) {
      if (!accepted || compareVersions(terms.version, accepted) > 0) accepted = terms.version;
    } else if (r.event_type === 'terms_notice_shown') {
      shown.add(terms.version);
    }
  }
  return { acceptedVersion: accepted, noticeShown: [...shown] };
}

/** Screens the §8 modal never covers: cancelling, the options it offers,
 *  content download, and asking for help. */
export const TERMS_MODAL_EXEMPT_PATHS = [
  '/app/billing',
  '/app/terminos',
  '/app/history',
  '/app/help',
  '/app/messages',
];

export function termsModalExempt(pathname: string): boolean {
  const p = pathname.replace(/^\/en(?=\/|$)/, '');
  return TERMS_MODAL_EXEMPT_PATHS.some((x) => p === x || p.startsWith(`${x}/`));
}
