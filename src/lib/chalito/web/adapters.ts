import type { AdapterKind, Provider } from "@chalito/protocol";
import type { ProviderStatus, StatusIndex } from "./connect";

/**
 * The coding agents a remote surface starts, which provider each one runs on, and where its name
 * lives (integrations.<provider>.agent: the only place provider names may appear). Pure: the
 * screens are NewSession.tsx and Sessions.tsx.
 */
export interface StartAdapter {
  kind: AdapterKind;
  provider: Provider;
  /**
   * Offered only once the computer reports this provider `connected` (chalito.connections).
   * Claude Code and Codex stay as before: the computer's policy decides, and it says so.
   */
  needsConnection: boolean;
}

export const START_ADAPTERS: readonly StartAdapter[] = [
  { kind: "claude-code", provider: "anthropic", needsConnection: false },
  { kind: "codex", provider: "openai", needsConnection: false },
  { kind: "grok", provider: "xai", needsConnection: true },
  { kind: "gemini", provider: "google", needsConnection: true },
];

const PROVIDER_OF: Partial<Record<string, Provider>> = Object.fromEntries(
  START_ADAPTERS.map((a) => [a.kind, a.provider]),
);

/** The integrations.* key with an adapter's name ("xai.agent" → Grok Build), or null ("acp", unknown). */
export const adapterNameKey = (kind: string | undefined): string | null => {
  const p = kind ? PROVIDER_OF[kind] : undefined;
  return p ? `${p}.agent` : null;
};

/**
 * - `ready`: can be started on that computer.
 * - `connect`: its provider isn't connected there yet (or we couldn't read the status): disabled,
 *   with a link to connect it.
 */
export type AdapterAvailability = "ready" | "connect";

export const adapterAvailability = (
  a: StartAdapter,
  statuses: Partial<Record<Provider, ProviderStatus>> | undefined,
): AdapterAvailability => {
  if (!a.needsConnection) return "ready";
  return statuses?.[a.provider]?.state === "connected" ? "ready" : "connect";
};

/** Every start adapter with its availability on one computer (`index`: indexConnections()). */
export const adaptersFor = (
  index: StatusIndex,
  deviceId: string,
): { adapter: StartAdapter; availability: AdapterAvailability }[] =>
  START_ADAPTERS.map((adapter) => ({ adapter, availability: adapterAvailability(adapter, index[deviceId]) }));

/** The choice to keep when the computer changes: the current one if still usable, else the first usable. */
export const keepAdapter = (
  current: AdapterKind,
  options: readonly { adapter: StartAdapter; availability: AdapterAvailability }[],
): AdapterKind => {
  const ready = options.filter((o) => o.availability === "ready");
  return ready.some((o) => o.adapter.kind === current) ? current : (ready[0]?.adapter.kind ?? current);
};
