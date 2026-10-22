import { ActionError } from "@chalito/client";
import type { RemotePermissionMode } from "@chalito/protocol";

export interface SessionActionsClient {
  actions: {
    prompt(sid: string, text: string): Promise<unknown>;
    interrupt(sid: string): Promise<unknown>;
    resume(sid: string): Promise<unknown>;
    setPermissionMode(sid: string, mode: RemotePermissionMode): Promise<unknown>;
  };
}

/** "skipped": the same lane already has one on its way (a repeat tap). */
export type ActionResult = "ok" | "untrusted" | "failed" | "skipped";

export interface ActionLanes {
  /** A prompt, resume or mode change is on its way. */
  busy: boolean;
  /** A Stop is on its way. */
  stopping: boolean;
}

// Stop has its own lane: a prompt retrying on a weak connection must never hold up or swallow it.
export const createSessionActions = (
  client: SessionActionsClient,
  sid: string,
  onChange: (lanes: ActionLanes) => void,
) => {
  const lanes: ActionLanes = { busy: false, stopping: false };
  const run = async (lane: keyof ActionLanes, f: () => Promise<unknown>): Promise<ActionResult> => {
    if (lanes[lane]) return "skipped";
    lanes[lane] = true;
    onChange({ ...lanes });
    try {
      await f();
      return "ok";
    } catch (err) {
      return err instanceof ActionError && err.code === "untrusted_agent" ? "untrusted" : "failed";
    } finally {
      lanes[lane] = false;
      onChange({ ...lanes });
    }
  };
  return {
    prompt: (text: string) => run("busy", () => client.actions.prompt(sid, text)),
    resume: () => run("busy", () => client.actions.resume(sid)),
    setMode: (m: RemotePermissionMode) => run("busy", () => client.actions.setPermissionMode(sid, m)),
    stop: () => run("stopping", () => client.actions.interrupt(sid)),
  };
};
export type SessionActions = ReturnType<typeof createSessionActions>;
