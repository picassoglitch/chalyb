import { z } from "zod";
import { EpochMs } from "./common";

/**
 * Where a provider stands on one device (agent → cloud status report).
 * `blocked_by_policy`: plan sign-in was requested but providers.yaml `subscriptionLocal` is
 * off / owner_only for this person.
 */
export const ProviderState = z.enum([
  "not_installed",
  "installing",
  "needs_auth",
  "signing_in",
  "connected",
  "error",
  "blocked_by_policy",
]);
export type ProviderState = z.infer<typeof ProviderState>;

/** How a provider is connected on the device. */
export const ProviderAuthMode = z.enum(["api_key", "signin"]);
export type ProviderAuthMode = z.infer<typeof ProviderAuthMode>;

/**
 * chalito.connections `doc`, one row per (owner, device, provider), upserted by the agent.
 * Status only: never a key, a token or an account name.
 */
export const ProviderStatusDoc = z.object({
  mode: ProviderAuthMode.nullable(),
  connected: z.boolean(),
  state: ProviderState,
  cli: z.object({ installed: z.boolean(), version: z.string().max(64).nullable() }),
  error: z.string().max(200).nullable(),
  at: EpochMs,
});
export type ProviderStatusDoc = z.infer<typeof ProviderStatusDoc>;
