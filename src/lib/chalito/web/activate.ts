import {
  ApiError,
  generateDeviceKeys,
  generateRecoveryCode,
  signDeviceRegistration,
  type ApiClient,
  type DeviceKeys as RawDeviceKeys,
} from "@chalito/client-keys";
import type { DeviceRegistration } from "@chalito/protocol";
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
 */

export type ActivateError = "has_clients" | "device_exists" | "rejected" | "failed";

export type ActivateResult =
  { ok: true; deviceId: string; customToken: string; recoveryCode: string } | { ok: false; reason: ActivateError };

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
 * Whether the account has no active client, so "Activar" applies. Only a hint for the UI: the api
 * decides atomically. An unreadable directory counts as "maybe", and the api answers has_clients
 * if it isn't.
 */
export const canActivate = (rows: readonly DirectoryRow[] | null): boolean =>
  !rows || !rows.some((r) => r.role === "client" && !r.revoked);

export const activateFirstClient = async (d: ActivateDeps): Promise<ActivateResult> => {
  const now = d.now ?? Date.now;
  // Always a fresh identity, saved before enrolment so the enrolled device always has its keys.
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
    const r = await d.api.post<{ deviceId: string; customToken: string }>("/v1/devices/first", {
      registration,
      recoveryCode,
    });
    if (r.deviceId !== keys.deviceId) return { ok: false, reason: "failed" };
    return { ok: true, deviceId: r.deviceId, customToken: r.customToken, recoveryCode };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "client_exists") return { ok: false, reason: "has_clients" };
      if (err.code === "device_exists") return { ok: false, reason: "device_exists" };
      return { ok: false, reason: err.status < 500 ? "rejected" : "failed" };
    }
    return { ok: false, reason: "failed" };
  }
};
