// Max length per copyright-notice field (takedown.ts validates against these
// on the server; the form uses them as maxLength so a too-long value can't be
// typed in the first place). Pure: safe in client components.

import type { TakedownInput } from './takedown';

export const TAKEDOWN_LIMITS: Record<keyof TakedownInput, number> = {
  claimantName: 300,
  claimantContact: 500,
  contentIdentification: 4000,
  rightStatement: 4000,
  contentLocation: 2000,
  workDescription: 4000,
  ownershipEvidence: 4000,
  declaredTruthful: 0,
};
