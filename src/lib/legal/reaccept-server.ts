// Re-acceptance (aceptacion-ux §8), the server part: reads the user's
// consent log, decides what to show for each of REACCEPT_DOCS (reaccept.ts)
// and records the answer as evidence (`terms_reaccepted`,
// `terms_notice_shown`, citing the document and version).
//
// §8: "Mientras no acepte: no se le aplica la nueva versión a ningún cobro".
// Enforced where a new charge is agreed: starting a plan (trial or paid) and
// changing plan refuse while a relevant change is unaccepted
// (termsAcceptancePending). Renewals of an existing subscription keep the
// version it was agreed under, so nothing new applies to them.

import 'server-only';
import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionUser } from '@/lib/auth/session';
import { legalPublished } from '@/lib/config/flags';
import { recordConsent, requestContext, UI_VERSION } from '@/lib/billing/consent';
import { formatFechaLarga } from '@/lib/billing/format';
import { legalDocuments } from './documents';
import { currentVersion, versionMeta } from './registry';
import {
  REACCEPT_DOCS,
  TERMS_ACCEPTING_EVENTS,
  termsHistory,
  termsPrompt,
  type ReacceptDoc,
  type TermsPrompt,
} from './reaccept';

export interface TermsPromptView {
  prompt: TermsPrompt;
  doc: ReacceptDoc;
  version: string;
  /** "1 de diciembre de 2026" */
  effective: string;
  changes: string[];
}

const NONE: TermsPromptView = {
  prompt: 'none',
  doc: 'terminos',
  version: '',
  effective: '',
  changes: [],
};

/** What to show now: the first document with a relevant change to accept
 *  (modal) wins over any minor change (banner). */
export async function termsPromptFor(userId: string, locale: string): Promise<TermsPromptView> {
  if (!legalPublished()) return NONE;
  const live = REACCEPT_DOCS.map((doc) => ({
    doc,
    version: currentVersion(doc),
    meta: versionMeta(doc),
  })).filter((d) => d.meta?.published && d.meta.effective);
  // Cheap exit before touching the database: nothing to show.
  if (!live.length) return NONE;
  const { data } = await createAdminClient()
    .from('consent_events')
    .select('event_type, documents')
    .eq('user_id', userId)
    .in('event_type', [...TERMS_ACCEPTING_EVENTS, 'terms_notice_shown']);
  const rows = (data ?? []) as Parameters<typeof termsHistory>[0];
  const now = new Date();
  const views = live.map(({ doc, version, meta }) => ({
    prompt: termsPrompt({
      published: true,
      current: version,
      meta,
      history: termsHistory(rows, doc),
      now,
    }),
    doc,
    version,
    effective: meta?.effective ? formatFechaLarga(meta.effective, locale) : '',
    changes: meta?.changes.slice(0, 3) ?? [],
  }));
  return (
    views.find((v) => v.prompt === 'modal') ?? views.find((v) => v.prompt === 'banner') ?? NONE
  );
}

/** §8: a new charge can't be agreed while a relevant change is unaccepted. */
export async function termsAcceptancePending(userId: string): Promise<boolean> {
  return (await termsPromptFor(userId, 'es')).prompt === 'modal';
}

/** The modal or banner exactly as shown, for the evidence. */
async function shownText(
  v: TermsPromptView,
  locale: string,
  kind: 'modal' | 'banner',
): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'termsUpdate' });
  if (kind === 'banner') return `${t(`banner.${v.doc}`)} ${t('bannerLink')}`;
  return [
    t(`titles.${v.doc}`),
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
  // A minor change can also be accepted; a relevant one is never
  // "acknowledged" by a banner view.
  if (v.prompt === 'none' || (action === 'shown' && v.prompt !== 'banner')) {
    return { ok: false, code: 'NOTHING_PENDING' };
  }
  const ctx = await requestContext();
  const text = await shownText(v, locale, v.prompt);
  await recordConsent({
    event_type: action === 'accept' ? 'terms_reaccepted' : 'terms_notice_shown',
    user_id: session.user.id,
    account_email: session.user.email ?? null,
    documents: legalDocuments(v.doc),
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
    details: { doc: v.doc, version: v.version },
  });
  return { ok: true };
}
