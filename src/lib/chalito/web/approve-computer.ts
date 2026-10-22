import {
  ApiError,
  checkPairingGlyph,
  declinePairing,
  pairingHandoff,
  type ApiClient,
  type DeviceClientKeys,
  type PairingDisplay,
} from "@chalito/client-keys";
import { fromB64url, verifyEnvelope } from "@chalito/crypto";
import { normalizeShortCode } from "@chalito/glyph";
import {
  PAIRING_LOOPBACK_PORTS,
  PAIRING_TTL_MS,
  PairingClaimBody,
  PairingCodeId,
  PairingHandoffResponse,
  PairingLoopbackProof,
  type GlyphPayload,
} from "@chalito/protocol";

/**
 * "Aprobar computadora" (/computadoras/aprobar, ADR 0028 §3–§4, owner decision #52). The desktop
 * app opened this page with `#c=<codeId>&p=<port>`: the code id and the agent's loopback port,
 * never the short code.
 *
 *  - One tap only when this browser runs on that computer: the agent on 127.0.0.1:<port> signs
 *    (code id, the nonce /handoff gave this browser, the hub origin), and /claim checks it.
 *  - Anything else (a phone, another browser, Safari blocking loopback, the agent not running)
 *    types the short code shown on the computer; the api refuses the claim without it. A link
 *    opened without the proof always shows the phishing warning.
 *
 * Approving signs the pairing claim with this browser's device key (after its passkey, when it
 * has one), then trusts the computer's key from the glyph the person just compared. The computer
 * still asks its own "Sí, fui yo" before it trusts this browser.
 */

export type ApproveError =
  | "invalid_code"
  | "not_found"
  | "expired"
  | "code_required"
  | "device_limit"
  | "wrong_code"
  | "proof_failed"
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

export interface Handoff {
  codeId: string;
  /** The agent's loopback port, when the link came from the desktop app. */
  port: number | null;
}

/** `#c=<codeId>&p=<port>` → the code id and port, or null. Anything else in the fragment is ignored. */
export const handoffFromHash = (hash: string): Handoff | null => {
  const q = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = q.get("c");
  if (!raw || !PairingCodeId.safeParse(raw).success) return null;
  const p = Number(q.get("p"));
  return { codeId: raw, port: (PAIRING_LOOPBACK_PORTS as readonly number[]).includes(p) ? p : null };
};

// ---- surviving the hub sign-in round-trip -------------------------------------------------

/** sessionStorage key for a hand-off link while the person signs in (same tab only). */
export const HANDOFF_STASH_KEY = "chalito.pairing.handoff.v1";
/** As long as the code itself lives: a stash older than that can't be used anyway. */
export const HANDOFF_STASH_TTL_MS = PAIRING_TTL_MS;

export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Keeps the link (if `hash` has one) so it survives a sign-in redirect that drops fragments. Same
 * tab only: an email magic link opened in a new tab starts without it, and the page then asks for
 * the code shown on the computer.
 */
export const stashHandoff = (store: Store, hash: string, now: number): Handoff | null => {
  const h = handoffFromHash(hash);
  if (!h) return null;
  try {
    store.setItem(HANDOFF_STASH_KEY, JSON.stringify({ ...h, at: now }));
  } catch {
    /* storage blocked: the link still works without a sign-in on the way */
  }
  return h;
};

/** The stashed link when it's still fresh; a stale or malformed one is dropped. */
export const stashedHandoff = (store: Store, now: number): Handoff | null => {
  try {
    const v = JSON.parse(store.getItem(HANDOFF_STASH_KEY) ?? "null") as {
      codeId?: unknown;
      port?: unknown;
      at?: unknown;
    } | null;
    if (
      typeof v?.codeId === "string" &&
      typeof v.at === "number" &&
      now - v.at < HANDOFF_STASH_TTL_MS &&
      PairingCodeId.safeParse(v.codeId).success
    ) {
      const port = typeof v.port === "number" && (PAIRING_LOOPBACK_PORTS as readonly number[]).includes(v.port) ? v.port : null;
      return { codeId: v.codeId, port };
    }
    store.removeItem(HANDOFF_STASH_KEY);
  } catch {
    /* nothing usable */
  }
  return null;
};

export const clearHandoff = (store: Store | null): void => {
  try {
    store?.removeItem(HANDOFF_STASH_KEY);
  } catch {
    /* ignore */
  }
};

/** A hand-off link is waiting behind another step (sign-in, endorsing this browser): go back to it. */
export const pendingApproval = (store: Store | null, now: number): boolean => !!(store && stashedHandoff(store, now));

/** The link for this page: the URL's fragment first, then the stash from before sign-in. */
export const handoffFor = (store: Store, hash: string, now: number): Handoff | null =>
  stashHandoff(store, hash, now) ?? stashedHandoff(store, now);

const APPROVE_PATH = /^\/(?:[a-z]{2}\/)?app\/chalito\/computadoras\/aprobar\/?$/;

/** Whether this pathname is the approval screen (with or without a locale prefix). */
export const onApprovalPage = (pathname: string): boolean => APPROVE_PATH.test(pathname);

/** On the hub sign-in page: whether `?next=` is the approval screen (then the fragment is stashed). */
export const headedToApproval = (search: string): boolean => {
  const next = new URLSearchParams(search).get("next") ?? "";
  return APPROVE_PATH.test(next.split("?")[0] ?? "");
};

/**
 * Takes the fragment out of the address bar right after reading or stashing it, so it isn't in
 * the history, a shared screenshot of the URL, or anything that reads `location.href` later
 * (analytics). Same document, no navigation.
 */
export const stripHash = (loc: Pick<Location, "pathname" | "search" | "hash">, history: Pick<History, "replaceState">) => {
  if (!loc.hash) return;
  try {
    history.replaceState((history as Partial<History>).state ?? null, "", `${loc.pathname}${loc.search}`);
  } catch {
    /* ignore */
  }
};

// ---- the loopback ----------------------------------------------------------------------

/**
 * Asks the agent on this computer to prove it's here. Null when it doesn't answer (another
 * device, blocked by the browser, the agent not running) or answers with anything but a proof.
 */
export const askLoopback = async (
  fetchFn: typeof fetch,
  h: Handoff,
  nonce: string,
  timeoutMs = 2500,
): Promise<PairingLoopbackProof | null> => {
  if (!h.port) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchFn(`http://127.0.0.1:${h.port}/pairing/proof`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codeId: h.codeId, nonce }),
      signal: ctl.signal,
      // Chrome's Private Network Access: the agent answers the preflight.
      ...({ targetAddressSpace: "loopback" } as Record<string, unknown>),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as { proof?: unknown } | null;
    const p = PairingLoopbackProof.safeParse(body?.proof);
    return p.success && p.data.body.codeId === h.codeId && p.data.body.nonce === nonce ? p.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Whether a loopback answer really comes from the computer being approved: signed by the agent
 * key in its (already verified) glyph, by that agent's device id, for this code and nonce, naming
 * this page's origin. Any other local process answering on those ports proves nothing, so the
 * warning and the code prompt stay. (/claim checks it again; this only decides what to show.)
 */
export const verifyLoopbackProof = async (
  proof: PairingLoopbackProof,
  target: ComputerTarget,
  o: { nonce: string; origin: string },
): Promise<boolean> => {
  const b = proof.body;
  if (proof.signerDeviceId !== target.display.agentDeviceId) return false;
  if (b.codeId !== target.codeId || b.nonce !== o.nonce || b.origin !== o.origin) return false;
  try {
    const key = await fromB64url(target.glyph.body.issuerPubSign);
    return (await verifyEnvelope(proof, "chalito.pairing-loopback.v1", new Map([[target.display.agentDeviceId, key]]))).ok;
  } catch {
    return false;
  }
};

// ---- the api ---------------------------------------------------------------------------

const REASONS: Record<string, ApproveError> = {
  not_found: "not_found",
  code_required: "code_required",
  bad_proof: "proof_failed",
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

/** The hand-off link: what this browser would approve, and the nonce for the loopback proof. */
export const findByLink = async (api: ApiClient, codeId: string, now: number): Promise<Found> => {
  try {
    return await toTarget(codeId, (await pairingHandoff(api, codeId, now)).view, now);
  } catch (err) {
    return { ok: false, reason: reasonOf(err) };
  }
};

/** The fallback: the short code typed from the computer's screen (it counts as typed for /claim). */
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

export type Approved = { ok: true; name: string; trusted: boolean } | { ok: false; reason: ApproveError };

/**
 * "Aprobar": the passkey (when this browser has one), then the signed claim with the loopback
 * proof or the typed code, then trust the computer. A claim that went through but couldn't be
 * trusted locally is still a pairing: `trusted: false` ("paired, finish setup"), never "failed".
 */
export const approveComputer = async (
  api: ApiClient,
  keys: ClaimSigner,
  target: ComputerTarget,
  o: {
    owner: string;
    now: number;
    shortCode?: string;
    loopbackProof?: PairingLoopbackProof;
    userCheck?: () => Promise<unknown>;
  },
): Promise<Approved> => {
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
    await api.post("/v1/pairing/claim", {
      claim,
      ...(typed ? { shortCode: typed } : {}),
      ...(o.loopbackProof ? { loopbackProof: o.loopbackProof } : {}),
    });
  } catch (err) {
    const reason = reasonOf(err);
    // A typed code refused as "code required" means that code was wrong.
    return { ok: false, reason: reason === "code_required" && typed ? "wrong_code" : reason };
  }
  try {
    await keys.trustAgentFromGlyph(target.glyph, target.display.fingerprint, o.now);
    return { ok: true, name: target.display.label, trusted: true };
  } catch {
    return { ok: true, name: target.display.label, trusted: false };
  }
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

// ---- the screen's state ----------------------------------------------------------------

/** What the provider hands the screen (provider.tsx `approveComputer`). */
export interface ApproveComputerApi {
  findByLink(codeId: string): Promise<Found>;
  findByCode(shortCode: string): Promise<Found>;
  approve(target: ComputerTarget, o: { shortCode?: string; loopbackProof?: PairingLoopbackProof }): Promise<Approved>;
  decline(codeId: string): Promise<"ok" | "failed">;
  /** This browser's verification code: the computer shows it at its "¿Lo aprobaste tú?". */
  fingerprint(): Promise<string>;
}

export type ApproveView =
  | { s: "loading" }
  | { s: "input"; busy: boolean; error: ApproveError | null }
  | {
      s: "confirm";
      target: ComputerTarget;
      /** Proven by the agent on this computer: one tap, no warning. */
      sameComputer: boolean;
      /** Not proven on this computer: a warning ("link": phishing via the link; "scan": a phone's camera). */
      warn: boolean;
      warnSource: "link" | "scan" | null;
      /** The short code still has to be typed here. */
      needsCode: boolean;
      blocked: boolean;
      typed: string;
      busy: boolean;
      error: ApproveError | null;
    }
  | { s: "done"; name: string; fingerprint: string; trusted: boolean }
  | { s: "declined" };

export interface ApproveFlowDeps {
  api: ApproveComputerApi;
  store: Store | null;
  /** The page's location and history (to read and strip the fragment). */
  location: Pick<Location, "pathname" | "search" | "hash" | "origin">;
  history: Pick<History, "replaceState">;
  loopback: (h: Handoff, nonce: string) => Promise<PairingLoopbackProof | null>;
  now: () => number;
}

/** The screen's logic, framework-free (ApproveComputer.tsx renders `view`). */
export class ApproveFlow {
  view: ApproveView = { s: "loading" };
  #listeners = new Set<() => void>();
  #proof: PairingLoopbackProof | null = null;

  constructor(private readonly d: ApproveFlowDeps) {}

  subscribe(fn: () => void): () => void {
    this.#listeners.add(fn);
    return () => void this.#listeners.delete(fn);
  }

  #set(v: ApproveView) {
    this.view = v;
    for (const fn of this.#listeners) fn();
  }

  #confirm(
    target: ComputerTarget,
    o: { source: "link" | "scan" | "typed"; typed: string; error?: ApproveError | null },
  ) {
    const sameComputer = !!this.#proof;
    const warn = o.source !== "typed" && !sameComputer;
    const blocked = !sameComputer && target.view.approval === "blocked";
    this.#set({
      s: "confirm",
      target,
      sameComputer,
      warn,
      warnSource: warn ? (o.source as "link" | "scan") : null,
      needsCode: !sameComputer && !target.view.codeTyped && !blocked,
      blocked,
      typed: o.typed,
      busy: false,
      error: o.error ?? null,
    });
  }

  #gone(error: ApproveError) {
    // A code that's gone or expired: the stash is useless now.
    if (error === "not_found" || error === "expired") clearHandoff(this.d.store);
    this.#set({ s: "input", busy: false, error });
  }

  /** On load: the link (fragment, or stashed before sign-in), then the loopback proof. */
  async start(): Promise<void> {
    const h = this.d.store
      ? handoffFor(this.d.store, this.d.location.hash, this.d.now())
      : handoffFromHash(this.d.location.hash);
    stripHash(this.d.location, this.d.history);
    if (!h) return this.#set({ s: "input", busy: false, error: null });
    const r = await this.d.api.findByLink(h.codeId);
    if (!r.ok) return this.#gone(r.reason);
    const nonce = r.target.view.loopbackNonce;
    const answer = nonce ? await this.d.loopback(h, nonce) : null;
    // Same computer only once the answer verifies against this computer's key; else the code.
    this.#proof =
      answer && nonce && (await verifyLoopbackProof(answer, r.target, { nonce, origin: this.d.location.origin }))
        ? answer
        : null;
    this.#confirm(r.target, { source: "link", typed: "" });
  }

  async findCode(shortCode: string): Promise<void> {
    this.#set({ s: "input", busy: true, error: null });
    this.#proof = null;
    const r = await this.d.api.findByCode(shortCode);
    if (!r.ok) return this.#set({ s: "input", busy: false, error: r.reason });
    this.#confirm(r.target, { source: "typed", typed: shortCode });
  }

  /** A phone scanned the computer's glyph: same as the link, but never on the same computer. */
  async findGlyph(glyph: unknown): Promise<void> {
    const g = glyph as { body?: { codeId?: unknown } } | null;
    if (typeof g?.body?.codeId !== "string") return this.#set({ s: "input", busy: false, error: "invalid_code" });
    this.#set({ s: "input", busy: true, error: null });
    this.#proof = null;
    const r = await this.d.api.findByLink(g.body.codeId);
    if (!r.ok) return this.#set({ s: "input", busy: false, error: r.reason });
    this.#confirm(r.target, { source: "scan", typed: "" });
  }

  setTyped(typed: string) {
    if (this.view.s === "confirm") this.#set({ ...this.view, typed, error: null });
  }

  expired(): boolean {
    return this.view.s === "confirm" && this.view.target.view.expiresAt <= this.d.now();
  }

  async approve(): Promise<void> {
    const v = this.view;
    if (v.s !== "confirm" || v.blocked || v.busy) return;
    if (this.expired()) return this.#gone("expired");
    this.#set({ ...v, busy: true, error: null });
    const r = await this.d.api.approve(v.target, {
      ...(this.#proof ? { loopbackProof: this.#proof } : {}),
      ...(v.needsCode ? { shortCode: v.typed } : {}),
    });
    // A proof is single use: if the claim failed, the person types the code from now on.
    this.#proof = null;
    if (!r.ok) {
      if (r.reason === "not_found" || r.reason === "expired") return this.#gone(r.reason);
      if (["step_up", "wrong_code", "code_required", "proof_failed", "invalid_code"].includes(r.reason))
        return this.#confirm(v.target, {
          source: v.warnSource ?? (v.sameComputer ? "link" : "typed"),
          typed: v.typed,
          error: r.reason,
        });
      return this.#set({ s: "input", busy: false, error: r.reason });
    }
    clearHandoff(this.d.store);
    this.#set({ s: "done", name: r.name, fingerprint: await this.d.api.fingerprint(), trusted: r.trusted });
  }

  async decline(): Promise<void> {
    const v = this.view;
    if (v.s !== "confirm") return;
    this.#set({ ...v, busy: true });
    if ((await this.d.api.decline(v.target.codeId)) !== "ok") return this.#set({ ...v, busy: false, error: "failed" });
    clearHandoff(this.d.store);
    this.#set({ s: "declined" });
  }
}
