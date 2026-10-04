// Owner decisions that ship as flags (rebuild prompt §12 OPEN QUESTIONS).
//
// Each flag reads its env var at call time — not at module load, because
// Next.js evaluates modules during the build, before the runtime env exists —
// and falls back to the documented default. Nothing outside this file should
// read these env vars directly.
//
// Pure: the only import is a small generated JSON (the legal publish state),
// so client components, server code and tests can all use it.

import publishState from '../legal/publish-state.json' with { type: 'json' };

type LegalPublishState = Record<string, { version: string; published: boolean; placeholders: number }>;
let legalState: LegalPublishState = publishState;

/** Tests only: pretend the legal texts are (or aren't) ready, to exercise
 *  what depends on LEGAL_PUBLISH. `null` restores the generated state. */
export function setLegalPublishStateForTests(state: LegalPublishState | null): void {
  legalState = state ?? publishState;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === '1' || raw.toLowerCase() === 'true';
}

/** Q19 · Free accounts can make clips (BUILD-SPEC §4). Free caps come from
 *  TIER_CAPS.FREE (watermark, SD, 7-day retention).
 *  TODO(owner): confirm the COGS of free clips. */
export function freeIncludesClips(): boolean {
  return readBool('FREE_INCLUDES_CLIPS', true);
}

/** O-13 / C7 · "Más popular" is a factual claim: only with the sales data
 *  behind it. Off: "Recomendado". Never "Mejor oferta". */
export function proBadgeMostPopular(): boolean {
  return readBool('PRO_BADGE_MOST_POPULAR', false); // TODO(owner O-13)
}

/** O-5 / O-7 · USD prices, US/CA tax footers and English USD copy. Off:
 *  MXN everywhere (MP charging in USD is unverified, OPS-14). */
export function usdMarketEnabled(): boolean {
  return readBool('USD_MARKET_ENABLED', false);
}

/** Q7 · Pro includes every active tool instead of one selected tool (owner
 *  trial spec + every mockup; P2-1). Existing Pro users gain access, nobody
 *  loses any. TODO(owner): decide what differentiates VIP besides credits. */
export function proIncludesAllTools(): boolean {
  return readBool('PRO_INCLUDES_ALL_TOOLS', true);
}

/**
 * C4 / C15 · whether copy may say "Todas las herramientas incluidas". Only
 * once Pro's entitlement, TIER_CAPS and the terms agree on it (WS-13, owner
 * O-9); until then no card, picker or landing makes a tool claim.
 */
const PRO_TOOL_SCOPE_ALIGNED = false; // TODO(owner O-9): flip in WS-13 once aligned

export function allToolsClaimAllowed(): boolean {
  return PRO_TOOL_SCOPE_ALIGNED && proIncludesAllTools();
}

/** Q4 · How the hub runs each tool (rebuild P3), from TOOL_HUB_MODE_<SLUG>:
 *   off   (default) the tool's card launches the engine's app over SSO
 *   a     the engine exposes a job/settings API; the hub renders the flow
 *   b     the hub collects the inputs and hands off through SSO with them
 *   mock  in-memory adapters — development and e2e only: refused in a
 *         production build unless E2E_USE_MOCK_ADAPTERS=1 (previews)
 *  `on` is accepted as an alias of `a`. */
export type ToolHubMode = 'off' | 'a' | 'b' | 'mock';

export function mockAdaptersAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || readBool('E2E_USE_MOCK_ADAPTERS', false);
}

export function toolHubMode(slug: string): ToolHubMode {
  const raw = (process.env[`TOOL_HUB_MODE_${slug.toUpperCase()}`] ?? '').toLowerCase();
  if (raw === 'mock') return mockAdaptersAllowed() ? 'mock' : 'off';
  if (raw === 'a' || raw === 'on') return 'a';
  if (raw === 'b') return 'b';
  return 'off';
}

export function clipsHubMode(): ToolHubMode {
  return toolHubMode('chalybclip');
}

/** What still stops paid checkout (and so the trial) from going live:
 *  published legal texts (P6, OPS-10), the seller's identity (art. 76 Bis
 *  fr. III, P2-13), and the evidence/cron secrets (consent log, renewal
 *  notices). */
export function paidCheckoutBlockers(): string[] {
  const blockers: string[] = [];
  if (!legalPublished()) blockers.push('LEGAL_PUBLISH');
  for (const name of [
    'LEGAL_ENTITY_NAME',
    'LEGAL_ENTITY_RFC',
    'LEGAL_ENTITY_ADDRESS',
    'LEGAL_ENTITY_PHONE',
    'LEGAL_ENTITY_EMAIL',
    'LEGAL_ENTITY_HOURS',
    'LEGAL_ENTITY_COMPLAINTS',
    'CONSENT_ENCRYPTION_KEY',
    'CRON_SECRET',
  ]) {
    if (!(process.env[name] ?? '').trim()) blockers.push(name);
  }
  return blockers;
}

/**
 * V-1 · paid checkout without the trial: annual plans (Pro anual, VIP anual),
 * the paid consent path and plan changes. Requested with
 * PAID_CHECKOUT_ENABLED (default false) and refused while anything in
 * paidCheckoutBlockers() is missing. Off: only the legacy monthly
 * /app/subscription sells, and the cards show monthly only.
 */
export function paidCheckoutEnabled(): boolean {
  return readBool('PAID_CHECKOUT_ENABLED', false) && paidCheckoutBlockers().length === 0;
}

export function paidCheckoutRequested(): boolean {
  return readBool('PAID_CHECKOUT_ENABLED', false);
}

/** The 7-day trial path: paid checkout AND TRIAL_FLOW_ENABLED. Until then,
 *  no trial is offered anywhere. */
export function trialFlowEnabled(): boolean {
  return readBool('TRIAL_FLOW_ENABLED', false) && paidCheckoutEnabled();
}

export function trialFlowRequested(): boolean {
  return readBool('TRIAL_FLOW_ENABLED', false);
}

/** VIP anual is sold wherever annual is (still needs paid checkout). */
export function vipYearEnabled(): boolean {
  return readBool('VIP_YEAR_ENABLED', true) && paidCheckoutEnabled();
}

/** O-11 · the optional "Mañana termina tu prueba gratis" email + amber
 *  banner on day 6 (Law recommends it, strongly for Pro anual; owner: off). */
export function trialDay6ReminderEnabled(): boolean {
  return readBool('TRIAL_DAY6_REMINDER', false); // TODO(owner O-11)
}

/** O-6 / OPS-14 · whether pausing a preapproval during its trial (and
 *  resuming it) is verified in the MP sandbox not to charge on the original
 *  start_date. Until then the hold rule doesn't touch MP: it records the
 *  hold and raises an admin attention item. */
export function mpPauseInTrialVerified(): boolean {
  return readBool('MP_PAUSE_IN_TRIAL_VERIFIED', false); // TODO(owner O-6)
}

/** O-2 · send the 30-day price-increase notices (WS-6). While off, nothing
 *  is sent and every grandfathered subscriber keeps renewing at their
 *  current amount. */
export function priceIncreaseNoticesEnabled(): boolean {
  return readBool('PRICE_INCREASE_NOTICES_ENABLED', false); // TODO(owner O-2)
}

/** O-2 · a subscriber who doesn't accept: 'gratis' (default; Términos §5.3
 *  as written, mockup 89) or 'keep_old' (needs the §5.3 bracket swapped). */
export function priceIncreaseNoAnswer(): 'gratis' | 'keep_old' {
  return process.env.PRICE_INCREASE_NO_ANSWER === 'keep_old' ? 'keep_old' : 'gratis'; // TODO(owner O-2)
}

/** O-6 / OPS-14 · whether PUT /preapproval/{id} with a new
 *  auto_recurring.transaction_amount is verified in the MP sandbox (no payer
 *  re-authorization; does MP email the payer?). Until then no running
 *  preapproval's amount is ever changed by code: an admin item instead. */
export function mpPreapprovalAmountPutVerified(): boolean {
  return readBool('MP_PREAPPROVAL_AMOUNT_PUT_VERIFIED', false); // TODO(owner O-6)
}

/** WS-7 · Pro Lealtad: the toggle option, panel, checkout and Mi plan
 *  block. Off by default: it can't ship until lowering a running
 *  preapproval's amount is verified at MP (O-6, OPS-24). */
export function lealtadEnabled(): boolean {
  return readBool('LEALTAD_ENABLED', false);
}

/** Withdraw Pro Lealtad for new customers; existing schedules continue. */
export function lealtadOpenToNewCustomers(): boolean {
  return readBool('LEALTAD_OPEN_TO_NEW_CUSTOMERS', true);
}

/** O-15 · optional return window that resumes the step after a cancel.
 *  0 = off (default). */
export function lealtadReturnWindowDays(): number {
  const n = Number(process.env.LEALTAD_RETURN_WINDOW_DAYS ?? '0');
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0; // TODO(owner O-15)
}

/** WS-8 · R-4 · automatic measures after a bad-faith chargeback
 *  (account_restricted / account_closed / prepayment_required). Off: the
 *  system records, triages, builds the evidence and queues the notice for an
 *  admin, and never restricts, closes or asks for prepayment. Waits for the
 *  attorney (OPS-10, REVISION S.3). */
export function chargebackMeasuresEnabled(): boolean {
  return readBool('CHARGEBACK_MEASURES_ENABLED', false);
}

/** WS-8 · Términos §10.8 refusal of new paid subscriptions after a repeat
 *  or fraud case. The highest legal risk (S.3 #1): its own flag, off. */
export function chargebackRefuseNewSubscriptions(): boolean {
  return readBool('CHARGEBACK_REFUSE_NEW_SUBSCRIPTIONS', false);
}

/** WS-8 · Términos §10.6(b): days unpaid after account_restricted before the
 *  account can close. Bracketed in the Términos [30]. TODO(owner/attorney). */
export function chargebackCloseAfterDays(): number {
  const n = Number(process.env.CHARGEBACK_CLOSE_AFTER_DAYS ?? '30');
  return Number.isFinite(n) && n >= 30 ? Math.trunc(n) : 30;
}

/** WS-9 · FIX-3 D-F3-5: the three notification switches on Mi perfil. Off
 *  until a sender reads notify_critical / notify_daily / notify_viral; a
 *  control with no effect is never shown. */
export function profileNotificationPrefs(): boolean {
  return readBool('PROFILE_NOTIFICATION_PREFS', false);
}

/** Q3 · whether the trial offers Mensual as well as Anual. */
export function trialPlanChoiceEnabled(): boolean {
  return readBool('TRIAL_PLAN_CHOICE_ENABLED', true);
}

/** Q11 · CFDI issuance. Until it exists, no "CFDI" anywhere. */
export function cfdiEnabled(): boolean {
  return readBool('CFDI_ENABLED', false);
}

/** Q16 · Whether the owner confirmed the "minutos" support promise. Until
 *  then the copy says "lo antes posible". */
export function supportSlaConfirmed(): boolean {
  return readBool('SUPPORT_SLA_CONFIRMED', false);
}

/** Why LEGAL_PUBLISH=true can't take effect yet (WS-12, old P6-3): a
 *  current legal version still a draft, or with Law's bracket placeholders
 *  (`[RAZÓN SOCIAL]`, `[IVA: CONFIRMAR]`, …) left in its rendered text.
 *  Read from src/lib/legal/publish-state.json, which `pnpm legal:hash`
 *  writes and tests/legal.test.ts keeps in step with the registry. */
export function legalPublishBlockers(): string[] {
  // Local e2e only (mock adapters allowed): exercise the published flows
  // against Law's drafts. Never honored on a real deployment.
  if (mockAdaptersAllowed() && readBool('E2E_LEGAL_DRAFTS_AS_PUBLISHED', false)) return [];
  const out: string[] = [];
  for (const [doc, s] of Object.entries(legalState)) {
    if (!s.published) out.push(`${doc}@${s.version}:draft`);
    if (s.placeholders > 0) out.push(`${doc}@${s.version}:${s.placeholders}-placeholders`);
  }
  return out;
}

/** LEGAL_PUBLISH as requested, before the placeholder gate. */
export function legalPublishRequested(): boolean {
  return readBool('LEGAL_PUBLISH', false);
}

/** Whether the P6 legal texts are published (OPS-10): requested AND no
 *  blocker left. Until then the legal pages show Law's drafts marked as
 *  such (noindex, out of the sitemap), consent events cite the current
 *  Terms, paid checkout and the trial stay off, and no JSON-LD Offer is
 *  emitted. */
export function legalPublished(): boolean {
  return legalPublishRequested() && legalPublishBlockers().length === 0;
}

function readUrl(name: string): string | null {
  const raw = (process.env[name] ?? '').trim();
  return /^https:\/\//.test(raw) ? raw : null;
}

/** Q16 · "Ayuda de una persona por WhatsApp" is only claimed when a support
 *  WhatsApp link exists. TODO(owner): set SUPPORT_WHATSAPP_URL (https://wa.me/…). */
export function supportWhatsappUrl(): string | null {
  return readUrl('SUPPORT_WHATSAPP_URL');
}

/** D7/Q18 · the partner program's terms. Until they exist the Socios section
 *  names no percentage or amount and shows no "Ver bases" link. */
export function partnerProgramTermsUrl(): string | null {
  return readUrl('PARTNER_PROGRAM_TERMS_URL');
}
