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

/** Q7 · Pro includes every active tool instead of one selected tool (owner
 *  trial spec + every mockup; P2-1). Existing Pro users gain access, nobody
 *  loses any. TODO(owner): decide what differentiates VIP besides credits. */
export function proIncludesAllTools(): boolean {
  return readBool('PRO_INCLUDES_ALL_TOOLS', true);
}

/** Q4 · Whether the hub drives Clips jobs itself (`on`, through the
 *  ClipsAdapter) or hands the user off to the Clips app over SSO (`off`).
 *  `mock` runs the in-hub flow against the mock adapter (tests, previews). */
export type ToolHubMode = 'off' | 'on' | 'mock';

export function clipsHubMode(): ToolHubMode {
  const raw = (process.env.TOOL_HUB_MODE_CHALYBCLIP ?? '').toLowerCase();
  return raw === 'on' || raw === 'mock' ? raw : 'off';
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

/** D5 · the optional extra reminder the day before the trial charge. */
export function trialDay29ReminderEnabled(): boolean {
  return readBool('TRIAL_DAY29_REMINDER_ENABLED', false);
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
