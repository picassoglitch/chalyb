// The landing's all-tools claims (C4/C15): "Todo incluido", "un solo plan",
// "todas las herramientas". Each one has a NoClaim variant, and the
// components pick between them only through claimKey(), so the claim can't
// render while allToolsClaimAllowed() is false (tests/landing.test.ts checks
// both the variants' wording and that no component reads a claim key
// directly). Keys are relative to `landing.<ns>`.

export const CLAIM_COPY = {
  heroTag: { ns: 'hero', claim: 'eyebrowTag', noClaim: 'eyebrowTagNoClaim' },
  heroEyebrow: { ns: 'hero', claim: 'eyebrow', noClaim: 'eyebrowNoClaim' },
  heroSub: { ns: 'hero', claim: 'sub', noClaim: 'subNoClaim' },
  toolsTitle: { ns: 'tools', claim: 'title', noClaim: 'titleNoClaim' },
  toolsSub: { ns: 'tools', claim: 'sub', noClaim: 'subNoClaim' },
  finalSub: { ns: 'final', claim: 'sub', noClaim: 'subNoClaim' },
  finalSubMobile: { ns: 'final', claim: 'subMobile', noClaim: 'subMobileNoClaim' },
  faqA5: { ns: 'faq', claim: 'a5', noClaim: 'a5NoClaim' },
} as const;

export type ClaimCopy = keyof typeof CLAIM_COPY;

/** The message key (within `landing.<ns>`) to show for `name`. */
export function claimKey(name: ClaimCopy, claimAll: boolean): string {
  const c = CLAIM_COPY[name];
  return claimAll ? c.claim : c.noClaim;
}
