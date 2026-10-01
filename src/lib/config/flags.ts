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

/** Q7 · Pro includes every active tool instead of one selected tool.
 *  Default `false` in P0: the product copy sells Pro as all tools, but the
 *  billing model still sells one live engine. P2 turns this on together with
 *  the new plans. TODO(owner): decide what differentiates VIP. */
export function proIncludesAllTools(): boolean {
  return readBool('PRO_INCLUDES_ALL_TOOLS', false);
}

/** Q4 · Whether the hub drives Clips jobs itself (`on`, through the
 *  ClipsAdapter) or hands the user off to the Clips app over SSO (`off`).
 *  `mock` runs the in-hub flow against the mock adapter (tests, previews). */
export type ToolHubMode = 'off' | 'on' | 'mock';

export function clipsHubMode(): ToolHubMode {
  const raw = (process.env.TOOL_HUB_MODE_CHALYBCLIP ?? '').toLowerCase();
  return raw === 'on' || raw === 'mock' ? raw : 'off';
}

/** Whether the new trial path (P2) is live. Until then, trial offers point at
 *  the existing subscription page. */
export function trialFlowEnabled(): boolean {
  return readBool('TRIAL_FLOW_ENABLED', false);
}

/** Q16 · Whether the owner confirmed the "minutos" support promise. Until
 *  then the copy says "lo antes posible". */
export function supportSlaConfirmed(): boolean {
  return readBool('SUPPORT_SLA_CONFIRMED', false);
}
