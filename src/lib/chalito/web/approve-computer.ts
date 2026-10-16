import {
  ApiError,
  checkPairingGlyph,
  declinePairing,
  pairingHandoff,
  type ApiClient,
  type DeviceClientKeys,
  type PairingDisplay,
} from "@chalito/client-keys";
import { normalizeShortCode } from "@chalito/glyph";
import {
  PairingClaimBody,
  PairingCodeId,
  PairingHandoffResponse,
  type GlyphPayload,
} from "@chalito/protocol";

/**
 * "Aprobar computadora" (/computadoras/aprobar, ADR 0028 §3–§4). The desktop app opened this page
 * with `#c=<codeId>`: the code id only, never the short code. The api says what approving needs:
 *
 *  - `one_tap`: same network as the computer (the normal case: the browser on that computer).
 *  - `code_required`: another network. The person types the short code shown on the computer;
 *    the api refuses the claim without it (enforced server-side, not only on this screen).
 *
 * Approving signs the pairing claim with this browser's device key (after its passkey, when it
 * has one), then trusts the computer's key from the glyph the person just compared. The computer
 * still asks its own "Sí, fui yo" before it trusts this browser.
 */

export type ApproveError =
  | "invalid_link"
  | "invalid_code"
  | "not_found"
  | "expired"
  | "code_required"
  | "network_mismatch"
  | "device_limit"
  | "wrong_code"
  | "tampered"
  | "step_up"
  | "failed";

export interface ComputerTarget {
  codeId: string;
  glyph: GlyphPayload;
  display: PairingDisplay;
  view: PairingHandoffResponse;
}

export type Found = { ok: true; target: ComputerTarget } | { ok: false; reason: ApproveError };

/** `#c=<codeId>` → the code id, or null. Anything else in the fragment is ignored. */
export const codeIdFromHash = (hash: string): string | null => {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("c");
  return raw && PairingCodeId.safeParse(raw).success ? raw : null;
};

// ---- surviving the hub sign-in round-trip -------------------------------------------------

/** sessionStorage key for a hand-off link's code id while the person signs in (same tab only). */
export const HANDOFF_STASH_KEY = "chalito.pairing.handoff.v1";
/** A pairing code lives 5 minutes; a stash older than that can't be used anyway. */
export const HANDOFF_STASH_TTL_MS = 10 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Keeps the code id from `hash` (if any) so it survives a sign-in redirect that drops fragments. */
export const stashHandoff = (store: Store, hash: string, now: number): string | null => {
  const codeId = codeIdFromHash(hash);
  if (!codeId) return null;
  try {
    store.setItem(HANDOFF_STASH_KEY, JSON.stringify({ codeId, at: now }));
  } catch {
    /* storage blocked: the link still works without a sign-in on the way */
  }
  return codeId;
};

/** The stashed code id when it's still fresh; a stale or malformed one is dropped. */
export const stashedHandoff = (store: Store, now: number): string | null => {
  try {
    const v = JSON.parse(store.getItem(HANDOFF_STASH_KEY) ?? "null") as { codeId?: unknown; at?: unknown } | null;
    if (
      typeof v?.codeId === "string" &&
      typeof v.at === "number" &&
      now - v.at < HANDOFF_STASH_TTL_MS &&
      PairingCodeId.safeParse(v.codeId).success
    )
      return v.codeId;
    store.removeItem(HANDOFF_STASH_KEY);
  } catch {
    /* nothing usable */
  }
  return null;
};

export const clearHandoff = (store: Store): void => {
  try {
    store.removeItem(HANDOFF_STASH_KEY);
  } catch {
    /* ignore */
  }
};

const APPROVE_PATH = /^\/(?:[a-z]{2}\/)?app\/chalito\/computadoras\/aprobar\/?$/;

/** On the hub sign-in page: whether `?next=` is the approval screen (then the fragment is stashed). */
export const headedToApproval = (search: string): boolean => {
  const next = new URLSearchParams(search).get("next") ?? "";
  return APPROVE_PATH.test(next.split("?")[0] ?? "");
};

/** The code id for this page: the URL's fragment first, then the stash from before sign-in. */
export const handoffCodeId = (store: Store, hash: string, now: number): string | null =>
  stashHandoff(store, hash, now) ?? stashedHandoff(store, now);

// ---- the api ---------------------------------------------------------------------------

const REASONS: Record<string, ApproveError> = {
  not_found: "not_found",
  expired: "expired",
  cancelled: "not_found",
  already_claimed: "not_found",
  code_required: "code_required",
  network_mismatch: "network_mismatch",
  device_limit: "device_limit",
  device_mismatch: "tampered",
  fingerprint_mismatch: "tampered",
  bad_signature: "tampered",
  claimer_mismatch: "tampered",
};

const reasonOf = (err: unknown): ApproveError => {
  if (err instanceof ApiError) return REASONS[err.code] ?? "failed";
  if ((err as { name?: string } | null)?.name === "NotAllowedError") return "step_up";
  return "failed";
};

/** Checks the computer's glyph (signature, purpose, time) and that it is the code asked for. */
const toTarget = async (codeId: string, view: PairingHandoffResponse, now: number): Promise<Found> => {
  const scan = await checkPairingGlyph(view.glyph, now);
  if (scan.state !== "ready") return { ok: false, reason: scan.reason === "expired" ? "expired" : "tampered" };
  if (scan.glyph.body.codeId !== codeId) return { ok: false, reason: "tampered" };
  return { ok: true, target: { codeId, glyph: scan.glyph, display: scan.display, view } };
};

/** The hand-off link: what this browser would approve, and how. */
export const findByLink = async (api: ApiClient, codeId: string, now: number): Promise<Found> => {
  try {
    return await toTarget(codeId, (await pairingHandoff(api, codeId, now)).view, now);
  } catch (err) {
    return { ok: false, reason: reasonOf(err) };
  }
};

/** The fallback: the short code typed from the computer's screen. */
export const findByCode = async (api: ApiClient, shortCode: string, now: number): Promise<Found> => {
  const code = normalizeShortCode(shortCode);
  if (!code) return { ok: false, reason: "invalid_code" };
  try {
    const view = PairingHandoffResponse.parse(await api.post("/v1/pairing/resolve", { shortCode: code }));
    return await toTarget(view.glyph.body.codeId, view, now);
  } catch (err) {
    return { ok: false, reason: reasonOf(err) };
  }
};

/** This browser's keys: signs the claim, then trusts the computer's key from its glyph. */
export type ClaimSigner = Pick<DeviceClientKeys, "deviceId" | "sign" | "trustAgentFromGlyph">;

/**
 * "Aprobar": the passkey (when this browser has one), then the signed claim, then trust the
 * computer. `shortCode` is what the person typed; the api requires it from another network.
 */
export const approveComputer = async (
  api: ApiClient,
  keys: ClaimSigner,
  target: ComputerTarget,
  o: { owner: string; now: number; shortCode?: string; userCheck?: () => Promise<unknown> },
): Promise<{ ok: true; name: string } | { ok: false; reason: ApproveError }> => {
  let typed: string | undefined;
  if (o.shortCode !== undefined) {
    const code = normalizeShortCode(o.shortCode);
    if (!code) return { ok: false, reason: "invalid_code" };
    typed = code;
  }
  try {
    await o.userCheck?.();
    const body = PairingClaimBody.parse({
      v: 1,
      owner: o.owner,
      codeId: target.codeId,
      agentDeviceId: target.display.agentDeviceId,
      agentFingerprint: target.display.fingerprint,
      claimerDeviceId: keys.deviceId,
      issuedAt: o.now,
    });
    const claim = await keys.sign("chalito.pairing-claim.v1", body);
    await api.post("/v1/pairing/claim", { claim, ...(typed ? { shortCode: typed } : {}) });
  } catch (err) {
    const reason = reasonOf(err);
    // From another network a wrong code reads as "code required" again: say it was the code.
    return { ok: false, reason: reason === "code_required" && typed ? "wrong_code" : reason };
  }
  try {
    await keys.trustAgentFromGlyph(target.glyph, target.display.fingerprint, o.now);
  } catch {
    return { ok: false, reason: "failed" };
  }
  return { ok: true, name: target.display.label };
};

/** "No estoy frente a esa computadora": the code stops working; the computer shows it was declined. */
export const declineComputer = async (api: ApiClient, codeId: string): Promise<"ok" | "failed"> => {
  try {
    await declinePairing(api, codeId);
    return "ok";
  } catch (err) {
    // Already gone (claimed, expired, declined) is as good as declined.
    return err instanceof ApiError && err.code === "not_found" ? "ok" : "failed";
  }
};
