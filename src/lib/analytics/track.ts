// Funnel events (rebuild prompt §6.5), behind one tiny provider-agnostic
// wrapper. Server-side, where the truth is: trial_start on the authorized
// preapproval, conversion on the first approved charge after a trial,
// payment_failed on a rejected charge, cancel on a successful cancel.
//
// NO PII in props: never an email, name, card or user id.
// Q14: whether these need cookie consent is open; server events carry no
// cookie, so they are not gated (the client side waits for P4-7's banner).

import 'server-only';

export type FunnelEvent =
  | 'signup'
  | 'trial_start'
  | 'first_clip'
  | 'cancel'
  | 'conversion'
  | 'payment_failed'
  | 'landing_pricing_toggle'
  // LANDING-SPEC §5 (client side, consent-gated).
  | 'landing_view'
  | 'landing_cta_click'
  | 'landing_nav_click'
  | 'landing_signin_click'
  | 'landing_menu_open'
  | 'landing_section_view'
  | 'landing_faq_open'
  | 'landing_partner_open'
  | 'landing_partner_submit'
  | 'landing_footer_click'
  | 'landing_sticky_shown';
export type FunnelProps = Record<string, string | number | boolean>;

export async function track(event: FunnelEvent, props: FunnelProps = {}): Promise<void> {
  try {
    const { track: vercelTrack } = await import('@vercel/analytics/server');
    await vercelTrack(event, props);
  } catch (err) {
    // TODO(provider): analytics must never break billing; log and move on.
    console.warn(`[analytics] ${event} not sent`, err instanceof Error ? err.message : err);
  }
}
