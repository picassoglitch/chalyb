// Cookie consent (aceptacion-ux §9, rebuild P4-7, Q14). Until the visitor
// chooses, nothing non-essential runs: no Vercel Analytics script, no client
// track(). The choice is stored in a first-party cookie, which is itself a
// necessary cookie.
//
// Pure apart from document.cookie, so tests can drive parse/serialize.

export interface Consent {
  analytics: boolean;
  ads: boolean;
}

export const CONSENT_COOKIE = 'chalyb_consent';
/** Bump when the categories change, so everyone is asked again. */
export const CONSENT_VERSION = 1;
const MAX_AGE_S = 180 * 24 * 60 * 60;

/** Fired on window to reopen the banner (footer "Cookies" link). */
export const OPEN_CONSENT_EVENT = 'chalyb:consent-open';
/** Fired on window after a choice is saved. */
export const CONSENT_CHANGED_EVENT = 'chalyb:consent-changed';

export const ALL: Consent = { analytics: true, ads: true };
export const NECESSARY_ONLY: Consent = { analytics: false, ads: false };

export function serializeConsent(c: Consent): string {
  return `v${CONSENT_VERSION}.a${c.analytics ? 1 : 0}.p${c.ads ? 1 : 0}`;
}

/** null = no valid choice yet (or an older version): show the banner. */
export function parseConsent(raw: string | null | undefined): Consent | null {
  const m = /^v(\d+)\.a([01])\.p([01])$/.exec(raw ?? '');
  if (!m || Number(m[1]) !== CONSENT_VERSION) return null;
  return { analytics: m[2] === '1', ads: m[3] === '1' };
}

/** The raw stored value ('' when unset); a stable string for
 *  useSyncExternalStore snapshots. */
export function readConsentRaw(): string {
  if (typeof document === 'undefined') return '';
  const hit = document.cookie.split('; ').find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return hit ? decodeURIComponent(hit.slice(CONSENT_COOKIE.length + 1)) : '';
}

export function readConsent(): Consent | null {
  return parseConsent(readConsentRaw());
}

export function saveConsent(c: Consent): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(c)}; Path=/; Max-Age=${MAX_AGE_S}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<Consent>(CONSENT_CHANGED_EVENT, { detail: c }));
}

export function openConsentBanner(): void {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
