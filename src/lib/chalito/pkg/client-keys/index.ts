export { generateDeviceKeys, publicKeys, KeyVault } from "./keys";
export type { DeviceKeys, TrustedAgent } from "./keys";
export { DeviceClientKeys, passkeyStepUp } from "./client";
export type { StepUpResult } from "./client";
export {
  generateRecoveryCode,
  signDeviceRegistration,
  signCommand,
  signRevokeClient,
  signDecision,
  signEndorsement,
} from "./signing";
export type { StepUpAssertion } from "./signing";
export { agentFromGlyph, sealFor } from "./sealing";
export { registerPasskey, stepUpWithPasskey, assertWithServerChallenge, browserCeremonies } from "./webauthn";
export type { Ceremonies, DeviceSigner } from "./webauthn";
export { httpApi, ApiError } from "./api";
export type { ApiClient } from "./api";
export {
  PairingScanner,
  checkPairingGlyph,
  pairingDisplay,
  resolveShortCode,
  pairingHandoff,
  declinePairing,
  buildPairingClaim,
  claimPairing,
  buildEndorsedEnrolment,
  enrollEndorsed,
  enrollSignedIn,
  deviceFingerprint,
  keyFingerprint,
  revokeDevice,
} from "./pairing";
export type { PairingDisplay, ScanResult, ClaimRequest } from "./pairing";
export { deviceLogin } from "./device-login";
export {
  EndorseError,
  SIGN_IN_INTRODUCER,
  accountAgents,
  newAccountAgents,
  approveEndorsement,
  endorseGlyph,
  introducedAgents,
  resolveForEndorsement,
} from "./endorse";
export type { DirectoryDevice, DroppedAgent, EndorseTarget, IntroductionCheck } from "./endorse";
