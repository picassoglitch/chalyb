import { APP_ADAPTER, type AdapterKind } from "@chalito/protocol";
import { CATALOG } from "./apps-catalog";
import type { ProviderStatus, StatusIndex } from "./connect";

/**
 * The coding agents a remote surface starts: every catalog app that runs sessions (claude-sdk,
 * codex or ACP). The four original ones keep their own adapter kind and their name in
 * integrations.<provider>.agent; the rest run on the generic ACP adapter, started by app id.
 * Pure: the screens are NewSession.tsx and Sessions.tsx.
 */
export interface StartAdapter {
  appId: string;
  kind: AdapterKind;
  /** The catalog name (shown when there's no integrations.* key for it). */
  name: string;
  /**
   * Offered only once the computer reports this app `connected` (chalito.connections). Claude
   * Code and Codex stay as before: the computer's policy decides, and it says so.
   */
  needsConnection: boolean;
}

const LEGACY = ["claude-code", "codex", "grok", "gemini"] as const;
const PROVIDER_OF: Record<string, string> = {
  "claude-code": "anthropic",
  codex: "openai",
  grok: "xai",
  gemini: "google",
};

const order = (id: string) => {
  const i = (LEGACY as readonly string[]).indexOf(id);
  return i === -1 ? LEGACY.length : i;
};

export const START_ADAPTERS: readonly StartAdapter[] = CATALOG.filter((a) => a.sessions)
  .map((a) => ({
    appId: a.id,
    kind: ((APP_ADAPTER as Record<string, AdapterKind>)[a.id] ?? "acp") as AdapterKind,
    name: a.name,
    needsConnection: a.id !== "claude-code" && a.id !== "codex",
  }))
  .sort((x, y) => order(x.appId) - order(y.appId) || x.name.localeCompare(y.name));

/** The integrations.* key with an adapter's name ("grok" → xai.agent → Grok Build), or null ("acp", unknown). */
export const adapterNameKey = (kind: string | undefined): string | null => {
  const p = kind ? PROVIDER_OF[kind] : undefined;
  return p ? `${p}.agent` : null;
};

/**
 * - `ready`: can be started on that computer.
 * - `connect`: it isn't connected there yet (or we couldn't read the status): disabled, with a
 *   link to connect it.
 */
export type AdapterAvailability = "ready" | "connect";

export const adapterAvailability = (
  a: StartAdapter,
  statuses: Record<string, ProviderStatus> | undefined,
): AdapterAvailability => {
  if (!a.needsConnection) return "ready";
  return statuses?.[a.appId]?.state === "connected" ? "ready" : "connect";
};

/** Every start adapter with its availability on one computer (`index`: indexConnections()). */
export const adaptersFor = (
  index: StatusIndex,
  deviceId: string,
): { adapter: StartAdapter; availability: AdapterAvailability }[] =>
  START_ADAPTERS.map((adapter) => ({ adapter, availability: adapterAvailability(adapter, index[deviceId]) }));

/** The choice to keep when the computer changes: the current app if still usable, else the first usable. */
export const keepAdapter = (
  current: string,
  options: readonly { adapter: StartAdapter; availability: AdapterAvailability }[],
): string => {
  const ready = options.filter((o) => o.availability === "ready");
  return ready.some((o) => o.adapter.appId === current) ? current : (ready[0]?.adapter.appId ?? current);
};

/**
 * What session.start carries: the four original apps by adapter (agents from before the engine
 * know only that), every other app by appId alone (the generic ACP adapter).
 */
export const startTarget = (a: StartAdapter): { adapter?: AdapterKind; appId?: string } =>
  a.kind === "acp" ? { appId: a.appId } : { adapter: a.kind };
