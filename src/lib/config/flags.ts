// Owner decisions that ship as flags (rebuild prompt §12 OPEN QUESTIONS).
//
// Each flag reads its env var at call time — not at module load, because
// Next.js evaluates modules during the build, before the runtime env exists —
// and falls back to the documented default. Nothing outside this file should
// read these env vars directly.
//
// Pure: no imports, so client components, server code and tests can all use it.

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

/** What still stops the trial path from going live, when it is requested.
 *  Real charges wait for published legal texts (P6, OPS-10), the seller's
 *  identity (art. 76 Bis fr. III, P2-13), and the evidence/cron secrets. */
export function trialFlowBlockers(): string[] {
  const blockers: string[] = [];
  if (!readBool('LEGAL_PUBLISH', false)) blockers.push('LEGAL_PUBLISH');
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

/** Whether the new trial path (P2) is live: requested with
 *  TRIAL_FLOW_ENABLED AND nothing in trialFlowBlockers(). Until then, trial
 *  offers point at the existing subscription page. */
export function trialFlowEnabled(): boolean {
  return readBool('TRIAL_FLOW_ENABLED', false) && trialFlowBlockers().length === 0;
}

export function trialFlowRequested(): boolean {
  return readBool('TRIAL_FLOW_ENABLED', false);
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

/** Whether the P6 legal texts are published (OPS-10). Until then the footer
 *  links only the documents that exist and no JSON-LD Offer is emitted. */
export function legalPublished(): boolean {
  return readBool('LEGAL_PUBLISH', false);
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
