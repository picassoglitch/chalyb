import { adapterNameKey } from "./adapters";

/**
 * A session's `computer_control` approval (chalito computer-control): it lets the AI see the
 * screen and use the mouse and keyboard of that computer for that session. The agent always asks
 * it as HIGH with a passkey step-up; this screen never approves it on its own and refuses to
 * approve one that doesn't carry that (a buggy or tampered request). Pure: the screen is
 * Approvals.tsx (and StepUpHost.tsx for the confirm).
 */

export interface ComputerControlApproval {
  kind: string;
  risk: string;
  stepUpRequired: boolean;
  agentDeviceId: string;
}

export const isComputerControl = (a: { kind: string }): boolean => a.kind === "computer_control";

/** Whether approving needs this device's passkey: every HIGH/CRITICAL and every computer_control. */
export const needsStepUp = (a: ComputerControlApproval): boolean =>
  isComputerControl(a) || a.stepUpRequired || a.risk === "HIGH" || a.risk === "CRITICAL";

/** A computer_control approval that isn't HIGH/CRITICAL with a step-up: can be denied, never approved. */
export const malformedComputerControl = (a: ComputerControlApproval): boolean =>
  isComputerControl(a) && !(a.stepUpRequired && (a.risk === "HIGH" || a.risk === "CRITICAL"));

export interface ComputerControlInfo {
  /** The computer's name as paired (null: not among this account's devices). */
  computer: string | null;
  /** The session's label the agent sent (agent-written; shown as text). */
  session: string | null;
  /** integrations.* key of the session's coding agent, when known. */
  adapterKey: string | null;
}

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

/**
 * Who asks and for what. `input` is what the agent sends in the sealed details
 * (`{ session, adapter, firstAction }`); anything else is ignored.
 */
export const computerControlInfo = (
  a: Pick<ComputerControlApproval, "agentDeviceId">,
  input: unknown,
  devices: readonly { deviceId: string; name: string }[],
): ComputerControlInfo => {
  const i = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    computer: str(devices.find((d) => d.deviceId === a.agentDeviceId)?.name, 80),
    session: str(i.session, 120),
    adapterKey: adapterNameKey(str(i.adapter, 32) ?? undefined),
  };
};
