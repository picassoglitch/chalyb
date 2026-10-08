import {
  AppConnectionDoc,
  AppId,
  PROVIDER_APP,
  ProviderConnectionDoc,
  type AppState,
  type RecipeKind,
} from "@chalito/protocol";
import type { CatalogApp } from "./apps-catalog";

/**
 * "Conecta tus IA" (onboarding's connect step and Ajustes): what each computer reported for each
 * app of the catalog (chalito.connections, one row per owner + device + app id, written by the
 * agent; the column is still called `provider`) and what the person can ask that computer to do
 * about it. Pure: the screen is ConnectProviders.tsx.
 */

/** A chalito.connections row as RLS returns it. `doc` is agent-written: parsed before use. */
export interface ConnectionRow {
  provider: string;
  device_id: string;
  doc: unknown;
}

export interface ProviderStatus {
  /** The app id (recipe id); rows from before the engine (anthropic, openai…) are mapped. */
  appId: string;
  deviceId: string;
  state: AppState;
  mode: "api_key" | "signin" | null;
  connected: boolean;
  cli: { installed: boolean; version: string | null } | null;
  /** The agent's own short error code/text (shown as-is only under a generic line). */
  error: string | null;
  /** The agent's clock when it reported (0 for a pre-contract row). Only compared with itself. */
  at: number;
  /** Custom ("Personalizada") recipes carry their own name; curated ones are in the catalog. */
  custom?: boolean;
  name?: string;
  kind?: RecipeKind;
}

/** A pre-engine provider name → its app id; anything else must already be an app id. */
const appIdOf = (raw: string): string | null => {
  const legacy = (PROVIDER_APP as Record<string, string>)[raw];
  if (legacy) return legacy;
  return AppId.safeParse(raw).success ? raw : null;
};

/** Rows written before the status report existed: `{ mode: byo_*, connected }` only. */
const LEGACY_MODE: Record<string, ProviderStatus["mode"]> = {
  byo_api_key: "api_key",
  byo_subscription_local: "signin",
};

/** One row → a status, or null when it isn't one we can trust to show. */
export const parseConnection = (row: ConnectionRow): ProviderStatus | null => {
  const appId = typeof row.provider === "string" ? appIdOf(row.provider) : null;
  if (!appId || typeof row.device_id !== "string" || !row.device_id) return null;
  const base = { appId, deviceId: row.device_id };
  const app = AppConnectionDoc.safeParse(row.doc);
  if (app.success) return { ...base, ...app.data };
  const full = ProviderConnectionDoc.safeParse(row.doc);
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
    provider: p.appId,
    deviceId: p.deviceId,
    mode: SETTINGS_MODE[p.mode ?? "api_key"],
    connected: p.connected,
  };
};

/** By device, then app id. */
export type StatusIndex = Record<string, Record<string, ProviderStatus>>;

export const indexConnections = (rows: readonly ConnectionRow[]): StatusIndex => {
  const out: StatusIndex = {};
  for (const r of rows) {
    const s = parseConnection(r);
    if (!s) continue;
    (out[s.deviceId] ??= {})[s.appId] = s;
  }
  return out;
};

/** providers.yaml `subscriptionLocal`, as the plan sign-in button shows it. */
export type SigninGate = "on" | "owner_only" | "off";
export const signinGate = (subscription: string): SigninGate =>
  subscription === "on" || subscription === "approved" ? "on" : subscription === "owner_only" ? "owner_only" : "off";

export type ConnectAction = "install" | "api_key" | "signin" | "disconnect" | "launch";

/**
 * The buttons for one app on one computer. Agents: connect with an API key (when the app takes
 * one) or its own plan sign-in (not offered when `off`; `owner_only` is offered and the computer
 * decides: blocked_by_policy), install when missing, disconnect when connected. Desktop apps and
 * websites sign in inside themselves, so the action is opening them on that computer. No report
 * yet (`null`): the connect options, and the computer answers with what it found.
 */
export const actionsFor = (
  status: ProviderStatus | null,
  app: Pick<CatalogApp, "group" | "planSignin" | "installable" | "apiKey">,
): ConnectAction[] => {
  if (app.group !== "agent") {
    if (status?.state === "not_installed") return app.installable ? ["install"] : [];
    if (status?.state === "installing") return [];
    if (status?.state === "error" && status.cli && !status.cli.installed) return app.installable ? ["install"] : [];
    return ["launch"];
  }
  const key: ConnectAction[] = app.apiKey ? ["api_key"] : [];
  const signin: ConnectAction[] = signinGate(app.planSignin) === "off" ? [] : ["signin"];
  if (!status) return [...key, ...signin];
  switch (status.state) {
    case "not_installed":
      return app.installable ? ["install"] : [];
    case "installing":
    case "signing_in":
      return [];
    case "connected":
    case "available":
      return ["disconnect"];
    case "error":
      if (status.cli && !status.cli.installed) return app.installable ? ["install"] : [];
      return [...key, ...signin];
    case "needs_auth":
      return [...key, ...signin];
    case "blocked_by_policy":
      // The plan sign-in was just refused for this person: offer the key when there is one.
      return key;
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

/**
 * How the four providers' keys start (the agent's KEY_SHAPE, apps/agent/src/apps/manager.ts).
 * Other apps' keys have no fixed shape and only pass cleanApiKey.
 */
export const KEY_PREFIX: Record<string, string> = {
  "claude-code": "sk-ant-",
  codex: "sk-",
  grok: "xai-",
  gemini: "AIza",
};

/** `warn` = the key lacks the provider's usual prefix. It's a warning only, since providers change key formats. */
export type KeyCheck = { ok: true; key: string; warn?: string } | { ok: false; error: "invalid" };

/** A pasted key for one app, checked before it is sealed: sane (hard), and the provider's usual prefix (warning). */
export const checkApiKey = (appId: string, raw: string): KeyCheck => {
  const key = cleanApiKey(raw);
  if (!key) return { ok: false, error: "invalid" };
  const prefix = KEY_PREFIX[appId];
  if (prefix && !key.startsWith(prefix)) return { ok: true, key, warn: prefix };
  // An Anthropic key starts with "sk-" too: catch it pasted into Codex.
  if (appId === "codex" && key.startsWith(KEY_PREFIX["claude-code"]!)) return { ok: true, key, warn: prefix };
  return { ok: true, key };
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

/** The slice of a next-intl translator (`chalito.connect`) the catalog copy needs. */
export interface ConnectText {
  (key: string): string;
  has(key: string): boolean;
}

/**
 * The catalog is generated in English (chalito recipes/catalog.json): an app's display name and its
 * key's label come from `chalito.connect.appNames` / `keyLabels` when translated, else as-is.
 */
export const appName = (t: ConnectText, app: Pick<CatalogApp, "id" | "name">): string =>
  t.has(`appNames.${app.id}`) ? t(`appNames.${app.id}`) : app.name;

export const keyLabel = (t: ConnectText, app: Pick<CatalogApp, "id" | "apiKey">): string | null =>
  !app.apiKey ? null : t.has(`keyLabels.${app.id}`) ? t(`keyLabels.${app.id}`) : app.apiKey.label;
