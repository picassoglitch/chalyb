/** "IA de Chalyb" for coding agents (chalito ADR 0030, apps/api /v1/coding/settings): the daily cap and spend, in tokens. */
export type CodingAgent = "codex" | "gemini-cli" | "grok-build";

export interface CodingSettings {
  /** The kill switch: false means nobody can use IA de Chalyb right now. */
  enabled: boolean;
  /** Pro and VIP only. */
  eligible: boolean;
  dailyCapTokens: number;
  defaultCapTokens: number;
  ceilingTokens: number;
  today: { day: string; billableTokens: number };
  /** The last 30 local days, per agent. */
  days: { day: string; agent: CodingAgent; billableTokens: number; requests: number }[];
}

export type CapResult =
  | { ok: true; dailyCapTokens: number }
  | {
      ok: false;
      reason: "step_up_required" | "step_up_failed" | "above_ceiling" | "not_eligible" | "failed";
    };

export interface CodingApi {
  settings(): Promise<CodingSettings | "error">;
  /** Raising needs `stepUp` (ChalitoProvider.assertPasskey); lowering never does. */
  setCap(tokens: number, stepUp?: unknown): Promise<CapResult>;
}

/** The chalito app ids that can run on IA de Chalyb (providers.yaml codingAgents.*.managed). Never Claude Code. */
export const CHALYB_APPS: ReadonlySet<string> = new Set(["codex", "grok", "gemini"]);

const AGENTS: readonly string[] = ["codex", "gemini-cli", "grok-build"];
const n = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export const parseCodingSettings = (body: unknown): CodingSettings | null => {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.enabled !== "boolean" || typeof b.eligible !== "boolean") return null;
  if (!n(b.dailyCapTokens) || !n(b.defaultCapTokens) || !n(b.ceilingTokens)) return null;
  const today = b.today as { day?: unknown; billableTokens?: unknown } | null;
  if (!today || typeof today.day !== "string" || !n(today.billableTokens)) return null;
  const days = Array.isArray(b.days)
    ? b.days.flatMap((d) => {
        const r = d as Record<string, unknown>;
        return typeof r.day === "string" && AGENTS.includes(String(r.agent)) && n(r.billableTokens) && n(r.requests)
          ? [
              {
                day: r.day,
                agent: r.agent as CodingAgent,
                billableTokens: r.billableTokens,
                requests: r.requests,
              },
            ]
          : [];
      })
    : [];
  return {
    enabled: b.enabled,
    eligible: b.eligible,
    dailyCapTokens: b.dailyCapTokens,
    defaultCapTokens: b.defaultCapTokens,
    ceilingTokens: b.ceilingTokens,
    today: { day: today.day, billableTokens: today.billableTokens },
    days,
  };
};

/** Tokens per agent over the days the api sent (the Uso page's "Agentes de código" line). */
export const spendByAgent = (s: CodingSettings): { agent: CodingAgent; billableTokens: number; requests: number }[] => {
  const by = new Map<CodingAgent, { billableTokens: number; requests: number }>();
  for (const d of s.days) {
    const cur = by.get(d.agent) ?? { billableTokens: 0, requests: 0 };
    by.set(d.agent, {
      billableTokens: cur.billableTokens + d.billableTokens,
      requests: cur.requests + d.requests,
    });
  }
  return [...by].map(([agent, v]) => ({ agent, ...v })).sort((a, b) => b.billableTokens - a.billableTokens);
};

/** The latest session.blocked, unless the agent answered again after it (the block cleared). */
export const latestBlock = (events: readonly { type: string; seq: number; meta: Record<string, unknown> }[]) => {
  let block: { reason: "out_of_energy" | "daily_cap"; seq: number } | null = null;
  for (const e of events) {
    if (e.type === "session.blocked" && (e.meta.reason === "out_of_energy" || e.meta.reason === "daily_cap"))
      block = !block || e.seq >= block.seq ? { reason: e.meta.reason, seq: e.seq } : block;
  }
  if (!block) return null;
  const answered = events.some((e) => e.type === "message.assistant" && e.seq > block.seq);
  return answered ? null : block.reason;
};

/** Whole tokens only, thousands separators allowed: "1,250,000" yes, "2.5" or "1e6" no. */
export const parseTokens = (text: string): number | null => {
  const t = text.trim();
  if (!/^\d{1,3}([,\s]\d{3})*$|^\d+$/.test(t)) return null;
  return Number(t.replace(/[,\s]/g, ""));
};

const REASONS = ["step_up_required", "step_up_failed", "above_ceiling", "not_eligible"] as const;

export const httpCoding = (
  base: string,
  token: () => Promise<string | null>,
  fetchImpl: typeof fetch = (...a) => fetch(...a),
): CodingApi => {
  const call = async (method: "GET" | "POST", body?: unknown): Promise<Response | null> => {
    const bearer = await token();
    if (!base || !bearer) return null;
    try {
      return await fetchImpl(`${base}/v1/coding/settings`, {
        method,
        headers: {
          authorization: `Bearer ${bearer}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store",
      });
    } catch {
      return null;
    }
  };
  return {
    settings: async () => {
      const r = await call("GET");
      if (!r?.ok) return "error";
      return parseCodingSettings(await r.json().catch(() => null)) ?? "error";
    },
    setCap: async (tokens, stepUp) => {
      const r = await call("POST", {
        dailyCapTokens: tokens,
        ...(stepUp === undefined ? {} : { stepUp }),
      });
      if (!r) return { ok: false, reason: "failed" };
      const b = (await r.json().catch(() => null)) as {
        dailyCapTokens?: unknown;
        error?: unknown;
      } | null;
      if (r.ok && n(b?.dailyCapTokens)) return { ok: true, dailyCapTokens: b.dailyCapTokens };
      const reason = REASONS.find((x) => x === b?.error);
      return { ok: false, reason: reason ?? "failed" };
    },
  };
};
