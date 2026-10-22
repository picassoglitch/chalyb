import type { ApprovalView, DraftView, EventView, SessionView } from "@chalito/client";
import { revealHidden } from "./approval-text";

// Session page as an /rc-style conversation (Aldo, 2026-10-21). Event text comes from the agent:
// shown as data, hidden characters revealed.

export interface ToolStep {
  kind: "tool";
  key: string;
  toolUseId: string;
  category: string;
  risk: string;
  /** null when the step's content isn't sealed to this device. */
  toolName: string | null;
  /** One line about what the tool does (command, file, query…), or null. */
  summary: string | null;
  /** The whole input, pretty-printed, for the expanded step; null when sealed or empty. */
  detail: string | null;
  /** null while it runs. */
  ok: boolean | null;
  /** The session ended before this step reported back. */
  stopped: boolean;
}

export type TranscriptItem =
  | { kind: "user"; key: string; text: string | null; origin: string | null }
  | { kind: "assistant"; key: string; text: string | null }
  | { kind: "draft"; key: string; text: string }
  | ToolStep
  | { kind: "notice"; key: string; type: string; code: string | null };

/** Events worth a line in the conversation; the rest drive the pill, the card or the cards below it. */
const NOTICE_TYPES = new Set(["session.started", "error", "link.handoff", "link.shared"]);

/** ToolCategory (protocol); anything newer an agent sends shows as "other". */
const CATEGORIES = new Set(["read", "search", "edit", "create", "delete", "shell", "web", "mcp", "git", "other"]);

const textOf = (c: unknown): string | null =>
  c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
    ? revealHidden((c as { text: string }).text, true).text
    : null;

/** Input keys that best say what a tool call is about, in order of preference. */
const SUMMARY_KEYS = ["command", "file_path", "path", "pattern", "query", "url", "description", "prompt"];
export const SUMMARY_MAX = 90;

const oneLine = (s: string): string => {
  const flat = revealHidden(s.replace(/\s+/g, " ").trim()).text;
  return flat.length > SUMMARY_MAX ? `${flat.slice(0, SUMMARY_MAX - 1)}…` : flat;
};

export const toolSummary = (input: unknown): string | null => {
  if (typeof input === "string") return input.trim() ? oneLine(input) : null;
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  for (const k of SUMMARY_KEYS) if (typeof o[k] === "string" && (o[k] as string).trim()) return oneLine(o[k] as string);
  const json = JSON.stringify(o);
  return json && json !== "{}" ? oneLine(json) : null;
};

const detailOf = (input: unknown): string | null => {
  if (input === undefined || input === null) return null;
  const s = typeof input === "string" ? input : JSON.stringify(input, null, 2);
  return s && s !== "{}" ? revealHidden(s, true).text : null;
};

export const buildTranscript = (
  events: readonly EventView[],
  draft?: DraftView | null,
  ended = false,
): TranscriptItem[] => {
  const out: TranscriptItem[] = [];
  const tools = new Map<string, ToolStep>();
  const mids = new Set<string>();
  for (const e of events) {
    switch (e.type) {
      case "message.user":
        out.push({ kind: "user", key: e.eid, text: textOf(e.content), origin: str(e.meta.origin) });
        break;
      case "message.assistant":
        if (typeof e.meta.mid === "string") mids.add(e.meta.mid);
        out.push({ kind: "assistant", key: e.eid, text: textOf(e.content) });
        break;
      case "tool.started": {
        const c = e.content as { toolName?: unknown; input?: unknown } | null;
        const step: ToolStep = {
          kind: "tool",
          key: e.eid,
          toolUseId: String(e.meta.toolUseId ?? e.eid),
          category: CATEGORIES.has(String(e.meta.category)) ? String(e.meta.category) : "other",
          risk: str(e.meta.risk) ?? "LOW",
          toolName: typeof c?.toolName === "string" ? oneLine(c.toolName) : null,
          summary: c ? toolSummary(c.input) : null,
          detail: c ? detailOf(c.input) : null,
          ok: null,
          stopped: false,
        };
        tools.set(step.toolUseId, step);
        out.push(step);
        break;
      }
      case "tool.finished": {
        const step = tools.get(String(e.meta.toolUseId));
        if (step) step.ok = e.meta.ok === true;
        break;
      }
      default:
        if (NOTICE_TYPES.has(e.type)) out.push({ kind: "notice", key: e.eid, type: e.type, code: str(e.meta.code) });
    }
  }
  if (ended) for (const step of tools.values()) step.stopped = step.ok === null;
  // The store drops a draft once its final message lands; this also covers a late snapshot.
  if (draft && draft.text && !mids.has(draft.mid)) out.push({ kind: "draft", key: `draft:${draft.mid}`, text: textOf(draft) ?? "" });
  return out;
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

export type PillState = "running" | "waiting" | "idle" | "ended";

/** The four states the owner reads at a glance: working, needs me, paused, over. */
export const pillState = (state: string | undefined, pendingHere: number): PillState => {
  if (state === "completed" || state === "failed") return "ended";
  if (pendingHere > 0 || state === "waiting_approval" || state === "waiting_input") return "waiting";
  // Stopped from the phone: paused, and Resume picks it back up.
  if (state === "idle" || state === "interrupted") return "idle";
  return "running";
};

/** A turn may still be going: Stop makes sense. */
export const canStop = (state: string | undefined): boolean =>
  state === undefined || state === "starting" || state === "running" || state === "waiting_approval" || state === "waiting_input";

/** This session's open approvals; a card past its deadline stays and shows "expired" itself (ApprovalCard). */
export const pendingFor = (approvals: readonly ApprovalView[], sid: string): ApprovalView[] =>
  approvals.filter((a) => a.sid === sid && a.status === "pending");

/** How many of them can still be answered. */
export const answerable = (pending: readonly ApprovalView[], now: number): number =>
  pending.filter((a) => a.expiresAt > now).length;

/** Paused or stopped: Resume is the next step. */
export const canResume = (state: string | undefined): boolean => state === "idle" || state === "interrupted";

export type FromKey = "client" | "local" | "agent" | "mcp" | "call" | "other";
/** Who wrote a prompt, from its signed origin (protocol Origin). */
export const fromKey = (origin: string | null): FromKey => {
  if (!origin) return "other";
  if (origin.startsWith("client:")) return "client";
  if (origin === "local") return "local";
  if (origin.startsWith("agent:") || origin.startsWith("a2a:")) return "agent";
  if (origin.startsWith("mcp:")) return "mcp";
  if (origin.startsWith("call:")) return "call";
  return "other";
};

/** The start of the session is gone (the store keeps the last 200 events; old rows expire): seq starts at 0. */
export const earlierHidden = (events: readonly EventView[]): boolean =>
  events.length > 0 && events[0]!.type !== "session.started" && events[0]!.seq > 0;

export const sessionStateOf = (s: SessionView): string | undefined => s.card?.state ?? s.state;
