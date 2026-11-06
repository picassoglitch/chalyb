'use client';

// Client-side funnel events, gated on cookie consent (rebuild §6.5, P4-7).
// Without analytics consent this is a no-op. Server events go through
// ./track.ts, which carries no cookie.

import type { FunnelEvent, FunnelProps } from './track';
import { readConsent } from './consent';
import { withoutFragment } from '@/lib/analytics-url';

export async function trackClient(event: FunnelEvent, props: FunnelProps = {}): Promise<boolean> {
  if (!readConsent()?.analytics) return false;
  try {
    const { track } = await import('@vercel/analytics');
    // Preferences can change while the provider chunk is loading. Campaign
    // fields also require advertising consent at the moment of dispatch.
    const consent = readConsent();
    if (!consent?.analytics) return false;
    const permitted = consent.ads
      ? props
      : Object.fromEntries(Object.entries(props).filter(([key]) => !key.startsWith('utm_')));
    // track() is a no-op until window.va exists; same stub as the SDK's unexported
    // initQueue, so the event waits in vaq and the script flushes it once <Analytics /> loads.
    if (!window.va) {
      window.va = function a(...params) {
        if (!window.vaq) window.vaq = [];
        window.vaq.push(params);
      };
      // The script replays vaq in order, so beforeSend must precede the event, as in inject().
      window.va('beforeSend', withoutFragment);
    }
    track(event, permitted);
    return true;
  } catch {
    // TODO(provider): analytics must never break the page.
    return false;
  }
}
