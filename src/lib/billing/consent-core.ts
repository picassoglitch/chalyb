// Consent evidence (aceptacion-ux §10, BUILD-SPEC §10.3), the pure part:
// building an event and chaining its hash to the previous one. The server
// part (consent.ts) reads the last hash and inserts; the table is append-only.
//
// event_hash = sha256(prev_event_hash + canonical JSON of every other field),
// so editing or removing any stored event breaks every hash after it.

import { createHash, randomUUID } from 'node:crypto';

export const CONSENT_EVENT_TYPES = [
  'signup_terms_accepted',
  'marketing_opt_in',
  'marketing_opt_out',
  'trial_started',
  'subscription_started',
  'plan_changed',
  'charge_notice_sent',
  'charge_succeeded',
  'charge_failed',
  'renewal_notice_sent',
  'annual_reminder_sent',
  'notice_bounced',
  'price_change_notice_sent',
  'price_change_accepted',
  'price_change_declined',
  'retention_offer_shown',
  'automation_rule_activated',
  'terms_reaccepted',
  'terms_notice_shown',
  'risk_ack_accepted',
  'financial_data_consent',
  'autopublish_enabled',
  'cancellation_requested',
  'refund_issued',
  'lealtad_started',
  'lealtad_step_notice_sent',
  'lealtad_step_advanced',
  'lealtad_reset',
  // WS-8 · refunds and chargebacks (aceptacion-ux §10.1, §10.5)
  'chargeback_opened',
  'chargeback_triaged',
  'chargeback_evidence_submitted',
  'chargeback_resolved',
  'chargeback_notice_sent',
  'chargeback_response_received',
  'chargeback_bad_faith_decided',
  'account_restricted',
  'account_closed',
  'prepayment_required',
  'arco_request_received',
  // BUILD-SPEC §11.6
  'voice_likeness_consent',
  // aceptacion-ux §7 · connecting a social account (WS-11, TOOLS-SPEC §8)
  'social_connect',
] as const;

export type ConsentEventType = (typeof CONSENT_EVENT_TYPES)[number];

export interface ConsentDocument {
  doc: string;
  version: string;
  url: string;
  sha256: string;
}

/** Every field aceptacion-ux §10.2 lists. IP and user agent are passed in
 *  clear here and encrypted by the server layer before storage. */
export interface ConsentEventInput {
  event_type: ConsentEventType;
  user_id: string;
  account_email: string | null;
  documents: ConsentDocument[];
  client_timezone: string | null;
  ip_address: string | null;
  user_agent: string | null;
  locale: string;
  surface: string;
  ui_version: string;
  disclosure_text: string | null;
  checkbox_text: string | null;
  checkbox_checked: boolean | null;
  button_label: string | null;
  plan_id: string | null;
  amount_mxn: number | null;
  currency: string | null;
  tax_included: boolean | null;
  billing_interval: 'month' | 'year' | null;
  trial_end_utc: string | null;
  charge_date_utc: string | null;
  reminder_date_utc: string | null;
  payment_method: Record<string, string | number | null> | null;
  marketing_opt_in: boolean;
  screenshot_ref?: string | null;
  /** Free-form extras (folio de cancelación, message id, …). */
  details?: Record<string, unknown> | null;
}

export interface ConsentEventRecord extends Omit<ConsentEventInput, 'account_email'> {
  consent_id: string;
  account_email_hash: string | null;
  disclosure_sha256: string | null;
  timestamp_utc: string;
  prev_event_hash: string | null;
  event_hash: string;
}

export const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** JSON with sorted keys at every level, so the hash is reproducible. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

export function buildConsentEvent(
  input: ConsentEventInput,
  prevEventHash: string | null,
  now: Date = new Date(),
  id: string = randomUUID(),
): ConsentEventRecord {
  const { account_email, ...rest } = input;
  const body = {
    ...rest,
    consent_id: id,
    account_email_hash: account_email ? sha256(account_email.trim().toLowerCase()) : null,
    disclosure_sha256: input.disclosure_text ? sha256(input.disclosure_text) : null,
    timestamp_utc: now.toISOString(),
    prev_event_hash: prevEventHash,
  };
  return { ...body, event_hash: sha256(`${prevEventHash ?? ''}${canonicalJson(body)}`) };
}

/** Re-derive every hash; returns the index of the first broken event, or -1. */
export function verifyChain(events: ConsentEventRecord[]): number {
  let prev: string | null = null;
  for (let i = 0; i < events.length; i++) {
    const { event_hash, ...body } = events[i]!;
    if (body.prev_event_hash !== prev) return i;
    if (sha256(`${prev ?? ''}${canonicalJson(body)}`) !== event_hash) return i;
    prev = event_hash;
  }
  return -1;
}
