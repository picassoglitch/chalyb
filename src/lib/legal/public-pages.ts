// The legal pages that exist on the site, in footer order. A link appears
// only once its page does, so no footer link can 404 (LANDING-SPEC §3.11).
// WS-12 adds Términos de Suscripción (/legal/subscription) and Uso aceptable
// (/legal/acceptable-use) here when it publishes them.

export type LegalPageKey = 'terms' | 'subscription' | 'privacy' | 'acceptable';

export const LEGAL_PAGES: ReadonlyArray<{ key: LegalPageKey; href: string }> = [
  { key: 'terms', href: '/legal/terms' },
  { key: 'privacy', href: '/legal/privacy' },
];
