// AI voice / likeness gate (BUILD-SPEC §11.6; LFDA arts. 118 fr. VII, 121;
// REVISION-LEGAL A6). Nothing that clones a real person's voice or face is
// built yet; this gate is what any such option must pass.

import type { ToolCapabilities } from '@/lib/tools/adapters/tools';

export class LikenessConsentRequired extends Error {
  readonly code = 'LIKENESS_CONSENT_REQUIRED';
  constructor(feature: string) {
    super(`voice/likeness consent required for ${feature}`);
  }
}

/** Pure: the guard, given whether a consent is on file. */
export function assertLikenessConsent(hasConsent: boolean, feature: string): void {
  if (!hasConsent) throw new LikenessConsentRequired(feature);
}

/** Options that use a likeness must be registered as gated. */
export function ungatedLikenessOptions(
  caps: ToolCapabilities,
  gated: ReadonlySet<string>,
): string[] {
  return caps.likenessOptions.filter((o) => o.usesLikeness && !gated.has(o.id)).map((o) => o.id);
}

/** Option ids wired through requireLikenessConsent. Empty in this phase. */
export const GATED_LIKENESS_OPTIONS: ReadonlySet<string> = new Set();
