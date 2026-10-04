// Tool consents (rebuild P3-3, P3-4, P3-10, P3-11), stored as consent_events:
//   risk_ack_accepted        per tool and per legal version (aceptacion-ux §6)
//   autopublish_enabled      per connected account (§7)
//   financial_data_consent   before an exchange key is stored (§7)
//   automation_rule_activated per Inversiones rule (§7)
//   voice_likeness_consent   per feature (BUILD-SPEC §11.6)
// The checks run on the server: a URL or a direct API call can't skip them.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { legalDocument, legalDocuments } from '@/lib/legal/documents';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';
import type { ConsentEventType } from '@/lib/billing/consent-core';
import { assertLikenessConsent } from '@/lib/guardrails/likeness';
import { RISK_TOOLS } from './routes';

/** The risk notice lives in the Acceptable Use Policy (§avisos): a new
 *  version asks again. */
export function riskVersion(): string {
  return legalDocument('uso_aceptable').version;
}

async function hasEvent(
  userId: string,
  type: ConsentEventType,
  match: Record<string, string>,
): Promise<boolean> {
  const admin = createAdminClient();
  let q = admin
    .from('consent_events')
    .select('consent_id')
    .eq('user_id', userId)
    .eq('event_type', type);
  for (const [k, v] of Object.entries(match)) q = q.eq(`details->>${k}`, v);
  const { data } = await q.limit(1).maybeSingle();
  return !!data;
}

export async function hasRiskAck(userId: string, slug: string): Promise<boolean> {
  if (!RISK_TOOLS.has(slug)) return true;
  return hasEvent(userId, 'risk_ack_accepted', { tool: slug, version: riskVersion() });
}

export async function requireLikenessConsent(userId: string, feature: string): Promise<void> {
  assertLikenessConsent(await hasEvent(userId, 'voice_likeness_consent', { feature }), feature);
}

export async function recordToolConsent(
  session: SessionUser,
  input: {
    type: ConsentEventType;
    surface: string;
    checkboxText: string;
    buttonLabel: string;
    details: Record<string, string>;
    locale: string;
    /** The notice text the screen showed (stored as its SHA-256). */
    disclosureText?: string;
  },
) {
  const ctx = await requestContext();
  return recordConsent({
    event_type: input.type,
    user_id: session.user.id,
    account_email: session.user.email ?? null,
    documents:
      input.type === 'financial_data_consent'
        ? legalDocuments('privacidad')
        : legalDocuments('uso_aceptable'),
    client_timezone: null,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    locale: input.locale === 'es' ? 'es-MX' : 'en',
    surface: input.surface,
    ui_version: UI_VERSION,
    disclosure_text: input.disclosureText ?? null,
    checkbox_text: input.checkboxText,
    checkbox_checked: true,
    button_label: input.buttonLabel,
    plan_id: null,
    amount_mxn: null,
    currency: null,
    tax_included: null,
    billing_interval: null,
    trial_end_utc: null,
    charge_date_utc: null,
    reminder_date_utc: null,
    payment_method: null,
    marketing_opt_in: false,
    details: input.details,
  });
}
