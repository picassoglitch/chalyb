// Re-acceptance of the Terms (aceptacion-ux §8), the server part: reads the
// user's consent log, decides what to show (reaccept.ts) and records the
// answer as evidence (`terms_reaccepted`, `terms_notice_shown`).

import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { legalPublished } from '@/lib/config/flags';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';
import { formatFechaLarga } from '@/lib/billing/format';
import { legalDocuments } from './documents';
import { currentVersion, versionMeta } from './registry';
import { termsHistory, termsPrompt, type TermsPrompt } from './reaccept';

export interface TermsPromptView {
  prompt: TermsPrompt;
  version: string;
  /** "1 de diciembre de 2026" */
  effective: string;
  changes: string[];
}

export async function termsPromptFor(userId: string, locale: string): Promise<TermsPromptView> {
  const version = currentVersion('terminos');
  const meta = versionMeta('terminos', version);
  const base = {
    version,
    effective: meta?.effective ? formatFechaLarga(meta.effective, locale) : '',
    changes: meta?.changes.slice(0, 3) ?? [],
  };
  // Cheap exit before touching the database: nothing to show.
  if (!legalPublished() || !meta?.published || !meta.effective) return { ...base, prompt: 'none' };
  const { data } = await createAdminClient()
    .from('consent_events')
    .select('event_type, documents')
    .eq('user_id', userId)
    .in('event_type', [
      'signup_terms_accepted',
      'terms_reaccepted',
      'trial_started',
      'subscription_started',
      'terms_notice_shown',
    ]);
  const prompt = termsPrompt({
    published: true,
    current: version,
    meta,
    history: termsHistory((data ?? []) as Parameters<typeof termsHistory>[0]),
    now: new Date(),
  });
  return { ...base, prompt };
}

/** The modal or banner exactly as shown, for the evidence. */
async function shownText(
  v: TermsPromptView,
  locale: string,
  kind: 'modal' | 'banner',
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'termsUpdate' });
  if (kind === 'banner') return `${t('bannerText')} ${t('bannerLink')}`;
  return [
    t('title'),
    t('lead', { fecha: v.effective }),
    ...v.changes.map((c) => `• ${c}`),
    t('seeAll'),
    t('disagree'),
    `${t('accept')} · ${t('options')}`,
  ].join('\n');
}

export async function answerTerms(
  session: SessionUser,
  action: 'accept' | 'shown',
  locale: string,
): Promise<{ ok: true } | { ok: false; code: 'NOTHING_PENDING' }> {
  const v = await termsPromptFor(session.user.id, locale);
  const want = action === 'accept' ? 'modal' : 'banner';
  // A minor change can also be accepted from its banner's page; a relevant
  // one is never "acknowledged" by a banner view.
  if (v.prompt === 'none' || (action === 'shown' && v.prompt !== want)) {
    return { ok: false, code: 'NOTHING_PENDING' };
  }
  const ctx = await requestContext();
  const text = await shownText(v, locale, v.prompt);
  await recordConsent({
    event_type: action === 'accept' ? 'terms_reaccepted' : 'terms_notice_shown',
    user_id: session.user.id,
    account_email: session.user.email ?? null,
    documents: legalDocuments('terminos'),
    client_timezone: null,
    ip_address: ctx.ip,
    user_agent: ctx.userAgent,
    locale: locale === 'es' ? 'es-MX' : 'en',
    surface: v.prompt === 'modal' ? 'terms_reaccept_modal' : 'terms_notice_banner',
    ui_version: UI_VERSION,
    disclosure_text: text,
    checkbox_text: null,
    checkbox_checked: null,
    button_label: action === 'accept' ? 'Aceptar y continuar' : null,
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
    details: { terms_version: v.version },
  });
  return { ok: true };
}
