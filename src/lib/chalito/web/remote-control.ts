import { pickComputer, type DeviceView, type EventView } from "@chalito/client";
import type { RouteChoice, RouteRule, RouteRules } from "@chalito/protocol";
import { START_ADAPTERS, startTarget } from "./adapters";

// ADR 0031: the hub's side of remote control. Pure helpers for "Automático" on Nueva sesión, the
// routing rules screen and the transfer button; the screens are NewSession, RoutingRules, TransferSession.

export const EMPTY_RULES: RouteRules = { v: 1, rules: [], fallback: [] };

/** The owner's computers (agents, not revoked), online first, then by name. */
export const computersOf = (devices: readonly DeviceView[]): DeviceView[] =>
  devices
    .filter((d) => d.role === "agent" && !d.revoked)
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

/** "Automático": the choice and what session.start carries for it, or why nothing can run it now. */
export const autoStart = (
  rules: RouteRules | null,
  workspaceLabel: string,
  devices: readonly DeviceView[],
): { ok: true; choice: Extract<RouteChoice, { ok: true }>; target: ReturnType<typeof startTarget> } | { ok: false } => {
  const choice = pickComputer(rules, workspaceLabel.trim() ? { workspaceLabel: workspaceLabel.trim() } : {}, devices);
  if (!choice.ok) return { ok: false };
  const a = START_ADAPTERS.find((x) => x.appId === choice.appId);
  return { ok: true, choice, target: a ? startTarget(a) : { appId: choice.appId } };
};

export const addRule = (r: RouteRules, rule: RouteRule): RouteRules => ({ ...r, rules: [...r.rules, rule] });
export const removeRule = (r: RouteRules, i: number): RouteRules => ({
  ...r,
  rules: r.rules.filter((_, j) => j !== i),
});
export const moveRule = (r: RouteRules, i: number, by: -1 | 1): RouteRules => {
  const j = i + by;
  if (j < 0 || j >= r.rules.length) return r;
  const rules = [...r.rules];
  [rules[i], rules[j]] = [rules[j]!, rules[i]!];
  return { ...r, rules };
};

/** Where a session may be moved: the owner's other computers, online first. */
export const transferTargets = (devices: readonly DeviceView[], fromDeviceId: string): DeviceView[] =>
  computersOf(devices).filter((d) => d.deviceId !== fromDeviceId);

export type TransferView =
  | { stage: "none" }
  | { stage: "sent"; to: string }
  | { stage: "delivered"; to: string; peerSid: string | null }
  | { stage: "refused"; to: string; reason: string };

/** The session's latest outgoing transfer, from its `session.transferred` events. */
export const transferOf = (events: readonly EventView[] | undefined): TransferView => {
  const last = [...(events ?? [])]
    .reverse()
    .find((e) => e.type === "session.transferred" && e.meta.direction === "out");
  if (!last) return { stage: "none" };
  const to = String(last.meta.peerDeviceId ?? "");
  if (last.meta.stage === "delivered")
    return { stage: "delivered", to, peerSid: typeof last.meta.peerSid === "string" ? last.meta.peerSid : null };
  if (last.meta.stage === "refused")
    return { stage: "refused", to, reason: String(last.meta.reason ?? "link_refused") };
  return { stage: "sent", to };
};

/** A session the owner can move now: not working, not waiting on them, not already moving. */
export const canTransfer = (state: string | undefined, t: TransferView): boolean =>
  !["starting", "running", "waiting_approval", "waiting_input"].includes(state ?? "") && t.stage !== "sent";
