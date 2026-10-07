import {
  ApiError,
  generateDeviceKeys,
  generateRecoveryCode,
  signDeviceRegistration,
  type ApiClient,
  type DeviceKeys as RawDeviceKeys,
} from "@chalito/client-keys";
import { RecoveryCode, type DeviceRegistration } from "@chalito/protocol";
import type { DirectoryRow } from "./endorse";

/**
 * "Activar" (tester item #1, owner decision 2026-10-06): a web-only account with NO trusted client
 * makes this browser its first one in one tap, with no second device or desktop app needed. It's the
 * api's existing first-client enrolment (/v1/devices/first, ADR 0006 step 1): a fresh identity
 * whose keys never leave this browser, a self-signed registration, and a recovery code (the api
 * keeps only its hash). The api enrols atomically only while the account has no active client and
 * audits it (`device.enrolled`, via first_client). Every later browser still goes through
 * "Esperando aprobación" (/vincular). Computers never trust it from the cloud alone (ADR 0006): they
 * still pair by their ring. The passkey comes right after, as this device (the provider does it).
 *
 * An account with a paired computer but no client (owner decision 2026-10-06: agents count too)
 * gets `agent_exists` and goes through recovery instead: the recovery code, the api's cool-down,
 * then /v1/recovery/complete enrols this browser the same way, with a new code.
 */

export type ActivateError = "has_clients" | "has_agents" | "device_exists" | "rejected" | "failed";

export type ActivateResult =
  | { ok: true; deviceId: string; customToken: string; recoveryCode: string }
  | { ok: false; reason: ActivateError };

export interface ActivateDeps {
  /** Authenticated as the person (hub session): /v1/devices/first is a `user` route. */
  api: ApiClient;
  /** Stores the new identity (replacing any old one, and the agents it trusted). */
  save(keys: RawDeviceKeys): Promise<void>;
  owner: string;
  /** This browser's name, e.g. "Chrome en Mac". */
  name: string;
  now?: () => number;
  generate?: () => Promise<RawDeviceKeys>;
  recoveryCode?: () => Promise<string>;
}

/**
 * Whether the account has no active device (client or computer), so "Activar" applies. Only a hint
 * for the UI: the api decides atomically. An unreadable directory counts as "maybe", and the api
 * answers has_clients / has_agents if it isn't.
 */
export const canActivate = (rows: readonly DirectoryRow[] | null): boolean => !rows || !rows.some((r) => !r.revoked);

/** No active client but a paired computer: this browser comes in through the recovery code. */
export const needsRecovery = (rows: readonly DirectoryRow[] | null): boolean =>
  !!rows && !rows.some((r) => r.role === "client" && !r.revoked) && rows.some((r) => r.role === "agent" && !r.revoked);

/**
 * A fresh identity, saved before enrolment so the enrolled device always has its keys, its signed
 * registration, and the new recovery code; then one api call that enrols it.
 */
const enrol = async (
  d: ActivateDeps,
  post: (registration: DeviceRegistration, recoveryCode: string) => Promise<{ deviceId: string; customToken: string }>,
  mapError: (err: ApiError) => ActivateError | null,
): Promise<ActivateResult> => {
  const now = d.now ?? Date.now;
  const keys = await (d.generate ?? generateDeviceKeys)();
  let registration: DeviceRegistration;
  let recoveryCode: string;
  try {
    await d.save(keys);
    registration = await signDeviceRegistration(keys, {
      owner: d.owner,
      kind: "web",
      platform: "web",
      name: d.name.slice(0, 40),
      now: now(),
    });
    recoveryCode = await (d.recoveryCode ?? generateRecoveryCode)();
  } catch {
    return { ok: false, reason: "failed" };
  }
  try {
    const r = await post(registration, recoveryCode);
    if (r.deviceId !== keys.deviceId) return { ok: false, reason: "failed" };
    return { ok: true, deviceId: r.deviceId, customToken: r.customToken, recoveryCode };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "device_exists") return { ok: false, reason: "device_exists" };
      return { ok: false, reason: mapError(err) ?? (err.status < 500 ? "rejected" : "failed") };
    }
    return { ok: false, reason: "failed" };
  }
};

export const activateFirstClient = (d: ActivateDeps): Promise<ActivateResult> =>
  enrol(
    d,
    (registration, recoveryCode) =>
      d.api.post<{ deviceId: string; customToken: string }>("/v1/devices/first", {
        registration,
        recoveryCode,
      }),
    (err) => (err.code === "client_exists" ? "has_clients" : err.code === "agent_exists" ? "has_agents" : null),
  );

// ---- Recovery (/v1/recovery/*): the code, the cool-down, then this browser is enrolled ----

/** The code as typed: upper case, no spaces; null unless it's a well-formed recovery code. */
export const cleanRecoveryCode = (raw: string): string | null => {
  const code = raw.trim().toUpperCase().replace(/\s+/g, "");
  return RecoveryCode.safeParse(code).success ? code : null;
};

export type RecoverError = "bad_code" | "no_recovery_code" | "device_exists" | "rejected" | "failed";

export type RecoverResult =
  | { ok: true; deviceId: string; customToken: string; recoveryCode: string }
  /** The cool-down is running (just started, or already): this browser can come in from then on. */
  | { ok: false; reason: "cooldown"; until: number }
  | { ok: false; reason: RecoverError };

const recoverError = (err: unknown): RecoverError => {
  if (!(err instanceof ApiError)) return "failed";
  if (err.code === "bad_code" || err.code === "no_recovery_code") return err.code;
  return err.status < 500 ? "rejected" : "failed";
};

/**
 * Tries to complete first, so a person back after the cool-down doesn't restart it (/start alerts
 * every device again). Not started or still cooling down: /start, which keeps a running cool-down
 * and returns its end. Done: this browser is enrolled with the NEW recovery code (the old one stops
 * working), to show once like "Activar".
 */
export const recoverWithCode = async (d: ActivateDeps, code: string): Promise<RecoverResult> => {
  let apiCode: string | null = null;
  const r = await enrol(
    d,
    (registration, newRecoveryCode) =>
      d.api.post<{ deviceId: string; customToken: string }>("/v1/recovery/complete", {
        recoveryCode: code,
        registration,
        newRecoveryCode,
      }),
    (err) => {
      apiCode = err.code;
      return null;
    },
  );
  if (r.ok) return r;
  if (r.reason === "device_exists") return { ok: false, reason: "device_exists" };
  if (apiCode === "bad_code" || apiCode === "no_recovery_code") return { ok: false, reason: apiCode };
  if (apiCode !== "recovery_not_started" && apiCode !== "cooldown")
    return { ok: false, reason: r.reason === "rejected" ? "rejected" : "failed" };
  try {
    const s = await d.api.post<{ cooldownUntil: number }>("/v1/recovery/start", {
      recoveryCode: code,
    });
    return { ok: false, reason: "cooldown", until: s.cooldownUntil };
  } catch (err) {
    return { ok: false, reason: recoverError(err) };
  }
};
