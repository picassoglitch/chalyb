import { rememberMatchFor, type CoordPlanState, type RuleMatch } from "@chalito/protocol";
import type { ApprovalView, DeviceView, SessionView } from "@chalito/client";

/**
 * Coordinator mode on the phone (ADR 0025 §6, M17 G3): what the "Equipo" screens show and allow,
 * from the live snapshot. Plans are sealed by the agent on its coordinator session; their text
 * comes from agents, so it is shown as data and never acted on.
 */

/** The coding agents a plan can use, in the order offered. */
export const COORD_APPS = ["claude-code", "codex", "grok", "gemini"] as const;
export type CoordApp = (typeof COORD_APPS)[number];

export const GOAL_MAX = 4000;
export const AGENT_CHOICES = [1, 2, 3, 4, 5, 6] as const;
export const MINUTE_CHOICES = [30, 60, 120, 240, 480] as const;

/** A turn from a plan's own coordinator (`agent:coord_<plan>`), as the agent signed it. */
export const isCoordOrigin = (origin: string) => /^agent:coord_p[a-z0-9]{6,12}$/.test(origin);

export interface GoalComputer {
  deviceId: string;
  name: string;
  online: boolean;
  /** Folders the computer reported (labels only); empty when it hasn't reported its setup. */
  workspaces: string[];
  /** Coding agents usable there: what it pinned, or every one when it hasn't said. */
  apps: CoordApp[];
}

/** The owner's paired computers a goal can go to (online first, then by name). */
export const goalComputers = (devices: readonly DeviceView[]): GoalComputer[] =>
  devices
    .filter((d) => d.role === "agent" && !d.revoked)
    .map((d) => {
      const pinned = d.setup?.adapters;
      return {
        deviceId: d.deviceId,
        name: d.name,
        online: d.online,
        workspaces: [...(d.setup?.labels ?? [])],
        apps: pinned ? COORD_APPS.filter((a) => pinned.includes(a)) : [...COORD_APPS],
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

export interface GoalDraft {
  deviceId: string;
  /** G4: other computers that take tasks too (each needs a hand-off link from the main one). */
  helpers: string[];
  workspaceLabel: string;
  goal: string;
  app: CoordApp;
  maxAgents: number;
  maxMinutes: number;
}

export type GoalProblem =
  | "no_computer"
  | "no_workspace"
  | "no_goal"
  | "goal_too_long"
  | "app"
  | "limits"
  | "helpers";

/** What's wrong with a goal before it's sent, or null. */
export const goalProblem = (d: GoalDraft, computers: readonly GoalComputer[]): GoalProblem | null => {
  const c = computers.find((x) => x.deviceId === d.deviceId);
  if (!c) return "no_computer";
  if (!d.workspaceLabel.trim()) return "no_workspace";
  if (d.goal.trim().length < 3) return "no_goal";
  if (d.goal.length > GOAL_MAX) return "goal_too_long";
  if (!c.apps.includes(d.app)) return "app";
  if (!(AGENT_CHOICES as readonly number[]).includes(d.maxAgents)) return "limits";
  if (!Number.isInteger(d.maxMinutes) || d.maxMinutes < 5 || d.maxMinutes > 720) return "limits";
  // Helpers: other paired computers, at most 5, never the main one.
  if (
    d.helpers.length > 5 ||
    new Set(d.helpers).size !== d.helpers.length ||
    d.helpers.some((h) => h === d.deviceId || !computers.some((x) => x.deviceId === h))
  )
    return "helpers";
  return null;
};

export interface PlanView {
  /** The coordinator session the plan lives on. */
  sid: string;
  agentDeviceId: string;
  plan: CoordPlanState;
}

/** Every plan in the snapshot, newest first. */
export const plansOf = (sessions: readonly SessionView[]): PlanView[] =>
  sessions
    .filter((s): s is SessionView & { coord: CoordPlanState } => !!s.coord)
    .map((s) => ({ sid: s.sid, agentDeviceId: s.agentDeviceId, plan: s.coord }))
    .sort((a, b) => b.plan.updatedAt - a.plan.updatedAt);

const LIVE: ReadonlySet<CoordPlanState["status"]> = new Set([
  "planning",
  "awaiting_approval",
  "running",
  "integrating",
  "ready_to_merge",
]);

/** The taps a plan offers now. Stop is the kill switch: there while anything can still run. */
export const planActions = (p: CoordPlanState) => ({
  approve: p.status === "awaiting_approval" && p.tasks.length > 0,
  merge: p.status === "ready_to_merge",
  stop: LIVE.has(p.status),
});

export const planProgress = (p: CoordPlanState) => ({
  done: p.tasks.filter((t) => t.status === "approved").length,
  total: p.tasks.length,
  failed: p.tasks.filter((t) => t.status === "failed").length,
});

/**
 * "Siempre así": what a yes on this approval would remember, or null. Only a verified MED tool
 * prompt from a plan's own coordinator (D-075: never HIGH or CRITICAL), bound to the workspace
 * label inside the details the agent sealed and signed (security review), never a plaintext column.
 */
export const rememberable = (a: ApprovalView): RuleMatch | null => {
  if (!a.verified || a.kind !== "tool" || a.risk !== "MED" || !isCoordOrigin(a.origin)) return null;
  const d = a.details as { toolName?: unknown; input?: unknown; workspaceLabel?: unknown } | null;
  if (!d || typeof d.toolName !== "string" || typeof d.workspaceLabel !== "string" || !d.workspaceLabel) return null;
  return rememberMatchFor({ toolName: d.toolName, input: d.input, workspaceLabel: d.workspaceLabel });
};

/**
 * The approval the pop-up shows: the newest pending one that hasn't expired and that the person
 * didn't put off ("Luego"), or null. Hidden on the inbox, which lists them all.
 */
export const popupApproval = (
  approvals: readonly ApprovalView[],
  dismissed: ReadonlySet<string>,
  now: number,
): ApprovalView | null =>
  approvals
    .filter((a) => a.status === "pending" && a.expiresAt > now && !dismissed.has(a.aid) && !a.mesa)
    .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

/** The name of the computer a task runs on (G4), for the plan card. */
export const deviceName = (devices: readonly DeviceView[], deviceId: string): string =>
  devices.find((d) => d.deviceId === deviceId)?.name ?? deviceId.slice(0, 12);
