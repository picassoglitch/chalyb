// Which tools have a real engine adapter for TOOL_HUB_MODE_<SLUG>=a. Pure, so
// tests can check the decision without loading every adapter.

import type { ToolHubMode } from '@/lib/config/flags';

/** Señales (ChalyCrypto /api/hub/v1) and En vivo (ChalyOBS /api/hub/v1). */
export const REAL_ADAPTER_SLUGS: readonly string[] = ['chalybcrypto', 'chalybobs'];

/** Mock always runs in-hub; mode a only where a real adapter exists. */
export function runsInHub(slug: string, mode: ToolHubMode): boolean {
  return mode === 'mock' || (mode === 'a' && REAL_ADAPTER_SLUGS.includes(slug));
}
