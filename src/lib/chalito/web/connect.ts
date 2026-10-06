import { ProviderState, ProviderStatusDoc, type Provider } from "@chalito/protocol";
import type { AgentOption } from "./providers";

/**
 * "Conecta tus IA" (onboarding's connect step and Ajustes): what each computer reported for each
 * provider (chalito.connections, one row per owner + device + provider, written by the agent) and
 * what the person can ask that computer to do about it. Pure: the screen is ConnectProviders.tsx.
 */

/** A chalito.connections row as RLS returns it. `doc` is agent-written: parsed before use. */
export interface ConnectionRow {
  provider: string;
  device_id: string;
  doc: unknown;
}

export interface ProviderStatus {
  provider: Provider;
  deviceId: string;
  state: ProviderState;
  mode: "api_key" | "signin" | null;
  connected: boolean;
  cli: { installed: boolean; version: string | null } | null;
  /** The agent's own short error code/text (shown as-is only under a generic line). */
  error: string | null;
  /** The agent's clock when it reported (0 for a pre-contract row). Only compared with itself. */
  at: number;
}

const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "xai", "google"];
const isProvider = (p: string): p is Provider => (PROVIDERS as readonly string[]).includes(p);

/** Rows written before the status report existed: `{ mode: byo_*, connected }` only. */
const LEGACY_MODE: Record<string, ProviderStatus["mode"]> = {
  byo_api_key: "api_key",
  byo_subscription_local: "signin",
};

/** One row → a status, or null when it isn't one we can trust to show. */
export const parseConnection = (row: ConnectionRow): ProviderStatus | null => {
  if (!isProvider(row.provider) || typeof row.device_id !== "string" || !row.device_id) return null;
  const base = { provider: row.provider, deviceId: row.device_id };
  const full = ProviderStatusDoc.safeParse(row.doc);
  if (full.success) return { ...base, ...full.data };
  const d = row.doc as { mode?: unknown; connected?: unknown } | null;
  if (d && typeof d === "object" && typeof d.connected === "boolean") {
    return {
      ...base,
      state: d.connected ? "connected" : "needs_auth",
      mode: LEGACY_MODE[String(d.mode)] ?? null,
      connected: d.connected,
      cli: null,
      error: null,
      at: 0,
    };
  }
  return null;
};

/** The status report's mode → the settings' ConnectionMode (pre-contract rows already use these). */
const SETTINGS_MODE = { api_key: "byo_api_key", signin: "byo_subscription_local" } as const;

/** One row → Ajustes' read-only ConnectionStatus (SettingsValues.connections), or null. */
export const toSettingsConnection = (row: ConnectionRow) => {
  const p = parseConnection(row);
  if (!p) return null;
  return {
    provider: p.provider,
    deviceId: p.deviceId,
    mode: SETTINGS_MODE[p.mode ?? "api_key"],
    connected: p.connected,
  };
};

/** By device, then provider. */
export type StatusIndex = Record<string, Partial<Record<Provider, ProviderStatus>>>;

export const indexConnections = (rows: readonly ConnectionRow[]): StatusIndex => {
  const out: StatusIndex = {};
  for (const r of rows) {
    const s = parseConnection(r);
    if (!s) continue;
    (out[s.deviceId] ??= {})[s.provider] = s;
  }
  return out;
};

/** providers.yaml `subscriptionLocal`, as the plan sign-in button shows it. */
export type SigninGate = "on" | "owner_only" | "off";
export const signinGate = (subscription: string): SigninGate =>
  subscription === "on" || subscription === "approved" ? "on" : subscription === "owner_only" ? "owner_only" : "off";

export type ConnectAction = "install" | "api_key" | "signin" | "disconnect";

/**
 * The buttons for one provider on one computer. No report yet (`null`): the connect options, and
 * the computer answers with not_installed if its tool is missing. A plan sign-in that's `off` in
 * providers.yaml is never offered; `owner_only` is offered and the computer decides
 * (blocked_by_policy).
 */
export const actionsFor = (
  status: ProviderStatus | null,
  option: Pick<AgentOption, "subscription">,
): ConnectAction[] => {
  const signin: ConnectAction[] = signinGate(option.subscription) === "off" ? [] : ["signin"];
  if (!status) return ["api_key", ...signin];
  switch (status.state) {
    case "not_installed":
      return ["install"];
    case "installing":
    case "signing_in":
      return [];
    case "connected":
      return ["disconnect"];
    case "error":
      if (status.cli && !status.cli.installed) return ["install"];
      return ["api_key", ...signin];
    case "needs_auth":
      return ["api_key", ...signin];
    case "blocked_by_policy":
      // The plan sign-in was just refused for this person: offer the key.
      return ["api_key"];
  }
};

/** How long the computer has to answer a command with a fresh report before the screen says so. */
export const COMMAND_WAIT_MS = 30_000;
/** How long one read of chalito.connections may take before it counts as failed. */
export const LOAD_TIMEOUT_MS = 10_000;
/** Polling: quickly while a command waits for its answer, slowly otherwise. */
export const POLL_FAST_MS = 3_000;
export const POLL_SLOW_MS = 20_000;

/** A command sent and waiting for the computer's next report. */
export interface Pending {
  action: ConnectAction | "status";
  sentAt: number;
  /** The report's `at` when the command went out (-1: no report yet). Clock-skew free. */
  prevAt: number;
}

export type PendingOutcome = "waiting" | "answered" | "timeout";

/** The newest report `at` among statuses (-1: none), what a Pending compares against. */
export const latestAt = (statuses: readonly (ProviderStatus | null | undefined)[]): number =>
  statuses.reduce((m, s) => (s ? Math.max(m, s.at) : m), -1);

/**
 * Answered once the computer reports anything newer than what we saw when sending (`at`: the
 * newest report now, -1 for none).
 */
export const pendingOutcome = (p: Pending, at: number, now: number): PendingOutcome => {
  if (at > p.prevAt) return "answered";
  return now - p.sentAt >= COMMAND_WAIT_MS ? "timeout" : "waiting";
};

/** An API key as pasted: trimmed, one line, a sane length. Null when it can't be one. */
export const cleanApiKey = (raw: string): string | null => {
  const k = raw.trim();
  if (k.length < 8 || k.length > 512 || /\s/.test(k)) return null;
  return k;
};

/** Rejects after `ms` (no endless spinners when the Data API doesn't answer). */
export const withTimeout = <T>(p: PromiseLike<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error("failed"));
      },
    );
  });
