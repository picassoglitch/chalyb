'use client';

// Client-side funnel events, gated on cookie consent (rebuild §6.5, P4-7).
// Without analytics consent this is a no-op. Server events go through
// ./track.ts, which carries no cookie.

import type { FunnelEvent, FunnelProps } from './track';
import { readConsent } from './consent';

export async function trackClient(event: FunnelEvent, props: FunnelProps = {}): Promise<void> {
  if (!readConsent()?.analytics) return;
  try {
    const { track } = await import('@vercel/analytics');
    track(event, props);
  } catch {
    // TODO(provider): analytics must never break the page.
  }
}
