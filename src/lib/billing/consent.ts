// Writing consent evidence. Builds the event (consent-core.ts), chains it to
// the user's previous event, encrypts IP and user agent, and inserts. The
// table refuses UPDATE and DELETE, so there is no other write path.

import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildConsentEvent, type ConsentEventInput, type ConsentEventRecord } from './consent-core';
import { sealPersonal } from './consent-crypto';

export const UI_VERSION = 'rebuild-p5-law-2026-10-03-packs';

/** IP, user agent and timezone of the current request, for the evidence. */
export async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { ip, userAgent: h.get('user-agent') };
}

export async function recordConsent(input: ConsentEventInput): Promise<ConsentEventRecord> {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from('consent_events')
    .select('event_hash')
    .eq('user_id', input.user_id)
    .order('inserted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const event = buildConsentEvent(input, (last?.event_hash as string | undefined) ?? null);
  const { ip_address, user_agent, ...rest } = event;
  const { error } = await admin.from('consent_events').insert({
    ...rest,
    ip_address_enc: sealPersonal(ip_address),
    user_agent_enc: sealPersonal(user_agent),
  });
  if (error) {
    console.error('[consent] insert failed', event.event_type, error.message);
    throw new Error('consent evidence could not be stored');
  }
  return event;
}
