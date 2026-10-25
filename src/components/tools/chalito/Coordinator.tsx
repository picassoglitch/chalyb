"use client";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ActionError, describeRule, type CoordRuleView } from "@chalito/client";
import { Link, usePathname } from "@/lib/chalito/navigation";
import { useChalito, useLive, useNow } from "@/lib/chalito/provider";
import { ApprovalCard } from "./Approvals";
import {
  AGENT_CHOICES,
  GOAL_MAX,
  MINUTE_CHOICES,
  goalComputers,
  goalProblem,
  planActions,
  planProgress,
  plansOf,
  popupApproval,
  deviceName,
  type CoordApp,
  type PlanView,
} from "@/lib/chalito/web/coord";
import { Empty } from "./Empty";
import { Users } from "lucide-react";

/**
 * Coordinator mode on the phone (ADR 0025 §6, M17 G3): the goal box, the plan cards (approve and
 * merge with the passkey, the kill switch), and the remembered answers in Ajustes. Plans come
 * sealed from the agent; their text comes from agents and is shown as data.
 */

const STATUS_PILL: Record<PlanView["plan"]["status"], string> = {
  planning: "ch-pill--gray",
  awaiting_approval: "ch-pill--acc",
  running: "ch-pill--acc",
  integrating: "ch-pill--acc",
  ready_to_merge: "ch-pill--ok",
  merged: "ch-pill--ok",
  stopped: "ch-pill--gray",
  failed: "ch-pill--bad",
};

const actionError = (err: unknown) =>
  err instanceof ActionError && (err.code === "passkey_required" || err.code === "untrusted_agent") ? err.code : "other";

const GoalBox = () => {
  const t = useTranslations("chalito.coord.goal");
  const { client } = useChalito();
  const { devices } = useLive();
  const computers = useMemo(() => goalComputers(devices), [devices]);
  const [deviceId, setDeviceId] = useState("");
  const computer = computers.find((c) => c.deviceId === deviceId) ?? computers[0];
  const [workspaceLabel, setWorkspace] = useState("");
  const [goal, setGoal] = useState("");
  const [app, setApp] = useState<CoordApp>("claude-code");
  const [maxAgents, setAgents] = useState(3);
  const [maxMinutes, setMinutes] = useState(120);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  // A computer that reported its folders offers them; the first one is the default.
  useEffect(() => {
    if (computer && !computer.workspaces.includes(workspaceLabel) && computer.workspaces[0])
      setWorkspace(computer.workspaces[0]);
    if (computer && !computer.apps.includes(app) && computer.apps[0]) setApp(computer.apps[0]);
  }, [computer, workspaceLabel, app]);

  if (!computers.length)
    return (
      <div className="ch-card ch-chl-card" data-testid="coord-no-computers">
        <p>{t("noComputers")}</p>
        <Link href="/descargar" className="ch-btn ch-btn--primary ch-chl-fit">
          {t("connectComputer")}
        </Link>
      </div>
    );

  // Helpers are other computers; the main one is never its own helper.
  const helperIds = helpers.filter((h) => h !== computer!.deviceId);
  const draft = { deviceId: computer!.deviceId, helpers: helperIds, workspaceLabel, goal, app, maxAgents, maxMinutes };
  const problem = goalProblem(draft, computers);
  const send = async () => {
    if (!client || problem) return;
    setBusy(true);
    setNote(null);
    try {
      await client.actions.coordStart({
        agentDeviceId: draft.deviceId,
        workspaceLabel: workspaceLabel.trim(),
        goal: goal.trim(),
        appId: app,
        maxAgents,
        maxMinutes,
        ...(helperIds.length ? { helpers: helperIds } : {}),
      });
      setGoal("");
      setNote({ kind: "ok", text: t("sent", { computer: computer!.name }) });
    } catch {
      setNote({ kind: "bad", text: t("error") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="ch-card ch-chl-card ch-chl"
      data-testid="coord-goal"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <h2 className="ch-chl-h3">{t("title")}</h2>
      <div className="ch-field">
        <label htmlFor="coord-goal">{t("label")}</label>
        <textarea
          id="coord-goal"
          className="ch-input"
          rows={4}
          maxLength={GOAL_MAX}
          placeholder={t("placeholder")}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
      </div>
      <div className="ch-chl-row">
        <div className="ch-field">
          <label htmlFor="coord-computer">{t("computer")}</label>
          <select
            id="coord-computer"
            className="ch-input"
            value={computer!.deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            {computers.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.online ? c.name : `${c.name} ${t("offline")}`}
              </option>
            ))}
          </select>
        </div>
        <div className="ch-field">
          <label htmlFor="coord-workspace">{t("workspace")}</label>
          {computer!.workspaces.length ? (
            <select
              id="coord-workspace"
              className="ch-input"
              value={workspaceLabel}
              onChange={(e) => setWorkspace(e.target.value)}
            >
              {computer!.workspaces.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                id="coord-workspace"
                className="ch-input"
                maxLength={80}
                value={workspaceLabel}
                onChange={(e) => setWorkspace(e.target.value)}
              />
              <p className="ch-chl-small ch-muted">{t("workspaceHint")}</p>
            </>
          )}
        </div>
        <div className="ch-field">
          <label htmlFor="coord-app">{t("app")}</label>
          <select id="coord-app" className="ch-input" value={app} onChange={(e) => setApp(e.target.value as CoordApp)}>
            {computer!.apps.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="ch-field">
          <label htmlFor="coord-agents">{t("agents")}</label>
          <select
            id="coord-agents"
            className="ch-input"
            value={maxAgents}
            onChange={(e) => setAgents(Number(e.target.value))}
          >
            {AGENT_CHOICES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="ch-field">
          <label htmlFor="coord-minutes">{t("minutes")}</label>
          <select
            id="coord-minutes"
            className="ch-input"
            value={maxMinutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {MINUTE_CHOICES.map((n) => (
              <option key={n} value={n}>
                {t("minutesN", { n })}
              </option>
            ))}
          </select>
        </div>
      </div>
      {computers.length > 1 ? (
        <fieldset className="ch-chl ch-chl--tight" data-testid="coord-helpers">
          <legend className="ch-chl-small ch-chl-strong">{t("helpers")}</legend>
          <p className="ch-chl-small ch-muted">{t("helpersHint")}</p>
          {computers
            .filter((c) => c.deviceId !== computer!.deviceId)
            .map((c) => (
              <label key={c.deviceId} className="ch-chl-row ch-chl-small">
                <input
                  type="checkbox"
                  checked={helpers.includes(c.deviceId)}
                  onChange={(e) =>
                    setHelpers((h) => (e.target.checked ? [...h, c.deviceId] : h.filter((x) => x !== c.deviceId)))
                  }
                />
                <span>{c.online ? c.name : `${c.name} ${t("offline")}`}</span>
              </label>
            ))}
        </fieldset>
      ) : null}
      {problem && goal.trim() ? (
        <p className="ch-chl-small ch-chl-warn" data-testid="coord-problem" data-problem={problem}>
          {t(`problem.${problem}`)}
        </p>
      ) : null}
      <button
        type="submit"
        className="ch-btn ch-btn--primary ch-chl-fit"
        data-testid="coord-send"
        disabled={busy || !!problem || !client}
      >
        {busy ? t("sending") : t("send")}
      </button>
      {note ? (
        <p role="status" className={note.kind === "bad" ? "ch-err" : "ch-chl-small"}>
          {note.text}
        </p>
      ) : null}
    </form>
  );
};

export const PlanCard = ({ v }: { v: PlanView }) => {
  const t = useTranslations("chalito.coord.plan");
  const { client, passkey } = useChalito();
  const { devices } = useLive();
  const { plan } = v;
  const multi = new Set(plan.tasks.map((x) => x.deviceId)).size > 1;
  const can = planActions(plan);
  const progress = planProgress(plan);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
      setNote(t("sent"));
    } catch (err) {
      setNote(t(`error.${actionError(err)}`));
    } finally {
      setBusy(false);
    }
  };
  const needsPasskey = (can.approve || can.merge) && !passkey.enrolled;
  return (
    <article
      className="ch-card ch-chl-card ch-chl"
      data-testid="coord-plan"
      data-plan={plan.planId}
      data-status={plan.status}
    >
      <header className="ch-chl-row">
        <span className={`ch-pill ${STATUS_PILL[plan.status]}`} data-testid="coord-plan-status">
          {t(`status.${plan.status}`)}
        </span>
        <span className="ch-chl-small ch-muted ch-chl-push">
          {t("base", { base: plan.base, workspace: plan.workspaceLabel })}
        </span>
      </header>
      <p className="ch-chl-strong">{plan.goal}</p>
      {plan.tasks.length ? (
        <p className="ch-chl-small">
          {t("progress", progress)}
          {progress.failed ? ` · ${t("failedN", { n: progress.failed })}` : ""}
        </p>
      ) : null}
      {plan.tasks.length ? (
        <ul className="ch-chl-list" data-testid="coord-tasks">
          {plan.tasks.map((task) => (
            <li key={task.id} className="ch-chl ch-chl--tight" data-task={task.id} data-task-status={task.status}>
              <div className="ch-chl-row">
                <span className="ch-chl-strong">{task.title}</span>
                {multi ? (
                  <span className="ch-chl-small ch-muted" data-testid="coord-task-device">
                    {t("on", { computer: deviceName(devices, task.deviceId) })}
                  </span>
                ) : null}
                <span className="ch-pill ch-pill--gray ch-chl-push">{t(`task.${task.status}`)}</span>
              </div>
              {task.note ? <p className="ch-chl-small ch-chl-mono">{task.note}</p> : null}
              {task.reviewRounds ? (
                <p className="ch-chl-small ch-muted">{t("reviewRounds", { n: task.reviewRounds })}</p>
              ) : null}
              {task.sid ? (
                <Link href={`/sesiones/${encodeURIComponent(task.sid)}`} className="ch-lnk ch-chl-small">
                  {t("openSession")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {plan.integration.note ? (
        <p className="ch-chl-small">
          <span className="ch-chl-strong">{t("integration")}: </span>
          <span className="ch-chl-mono">{plan.integration.note}</span>
        </p>
      ) : null}
      {plan.note ? <p className="ch-chl-small">{plan.note}</p> : null}
      {needsPasskey ? (
        <p className="ch-chl-small ch-chl-warn" data-testid="coord-needs-passkey">
          {t("error.passkey_required")}{" "}
          <Link href="/dispositivos" className="ch-lnk">
            {t("enrolPasskey")}
          </Link>
        </p>
      ) : null}
      <div className="ch-chl-row">
        {can.approve ? (
          <button
            className="ch-btn ch-btn--primary"
            data-testid="coord-approve"
            disabled={busy || !client || needsPasskey}
            title={t("approveHint")}
            onClick={() => void run(() => client!.actions.coordApprove(v.agentDeviceId, plan))}
          >
            {t("approve")}
          </button>
        ) : null}
        {can.merge ? (
          <button
            className="ch-btn ch-btn--primary"
            data-testid="coord-merge"
            disabled={busy || !client || needsPasskey}
            title={t("mergeHint", { base: plan.base })}
            onClick={() => void run(() => client!.actions.coordMerge(v.agentDeviceId, plan))}
          >
            {t("merge", { base: plan.base })}
          </button>
        ) : null}
        {can.stop ? (
          <button
            className="ch-btn ch-btn--danger"
            data-testid="coord-stop"
            disabled={busy || !client}
            title={t("stopHint")}
            onClick={() => void run(() => client!.actions.coordStop(v.agentDeviceId, plan.planId))}
          >
            {t("stop")}
          </button>
        ) : null}
      </div>
      {can.approve ? <p className="ch-chl-small ch-muted">{t("approveHint")}</p> : null}
      {can.merge ? <p className="ch-chl-small ch-muted">{t("mergeHint", { base: plan.base })}</p> : null}
      {note ? (
        <p role="status" className="ch-chl-small">
          {busy ? t("busy") : note}
        </p>
      ) : null}
    </article>
  );
};

/** /equipo: the goal box and every plan, newest first. */
export const CoordHome = () => {
  const t = useTranslations("chalito.coord");
  const { sessions } = useLive();
  const plans = useMemo(() => plansOf(sessions), [sessions]);
  return (
    <div className="ch-chl" data-testid="coord-home">
      <h2 className="ch-h2">{t("title")}</h2>
      <p className="ch-sub">{t("intro")}</p>
      <GoalBox />
      <section className="ch-chl-list" aria-labelledby="coord-plans-h">
        <h2 id="coord-plans-h" className="ch-ghead">
          {t("plans.title")}
        </h2>
        {plans.length ? (
          plans.map((p) => <PlanCard key={p.sid} v={p} />)
        ) : (
          <Empty icon={<Users />} title={t("plans.empty")} body={t("plans.emptyBody")} />
        )}
      </section>
    </div>
  );
};

/** Ajustes → "Respuestas recordadas": every rule, removable (a signed withdrawal, then the row). */
export const CoordRules = () => {
  const t = useTranslations("chalito.coord.rules");
  const locale = useLocale();
  const { client } = useChalito();
  const [rules, setRules] = useState<CoordRuleView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const load = useMemo(
    () => () =>
      client?.coordRules.list().then(
        (r) => setRules(r),
        () => setError(true),
      ),
    [client],
  );
  useEffect(() => void load(), [load]);
  if (!client) return null;
  const forget = async (id: string) => {
    setBusy(id);
    setError(false);
    try {
      await client.coordRules.forget(id);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section aria-labelledby="coord-rules-h" className="ch-chl" data-testid="coord-rules">
      <h2 id="coord-rules-h" className="ch-chl-h3">
        {t("title")}
      </h2>
      <p className="ch-muted">{t("body")}</p>
      {error ? (
        <p role="alert" className="ch-err">
          {t("error")}
        </p>
      ) : null}
      {rules && !rules.length ? <p className="ch-chl-small">{t("empty")}</p> : null}
      {rules?.length ? (
        <ul className="ch-chl-list">
          {rules.map((r) => (
            <li key={r.ruleId} className="ch-card ch-chl-card ch-chl-row" data-rule={r.ruleId}>
              <span className="ch-chl ch-chl--tight">
                <span className="ch-chl-mono">{r.label ?? t("otherDevice")}</span>
                <span className="ch-chl-small ch-muted">
                  {t("expires", { date: new Date(r.expiresAt).toLocaleDateString(locale) })}
                </span>
              </span>
              <button
                className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-push"
                disabled={busy !== null}
                onClick={() => void forget(r.ruleId)}
              >
                {busy === r.ruleId ? t("forgetting") : t("forget")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
};

export { describeRule };

/**
 * The approval pop-up (owner, 2026-10-19: "ask me directly in a chat pop-up"): the newest pending
 * approval over every screen, with the same card as the inbox (approve, deny, reply, "Siempre así").
 * "Luego" hides it until a newer one arrives; the inbox lists them all. Web push (PushOptIn) reaches
 * the phone when the hub isn't open.
 */
export const ApprovalPopup = () => {
  const t = useTranslations("chalito.coord.approval");
  const { status } = useChalito();
  const { approvals } = useLive();
  const now = useNow(1000);
  const path = usePathname();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const a = popupApproval(approvals, dismissed, now);
  if (status !== "ready" || !a || /\/(bandeja|a)(\/|$)/.test(path)) return null;
  return (
    <div className="ch-chl-popup" role="dialog" aria-modal="false" aria-labelledby="coord-popup-h" data-testid="approval-popup">
      <div className="ch-chl-row">
        <h2 id="coord-popup-h" className="ch-chl-h3">
          {t("popupTitle")}
        </h2>
        <button
          className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-push"
          data-testid="approval-popup-later"
          onClick={() => setDismissed((d) => new Set([...d, a.aid]))}
        >
          {t("later")}
        </button>
      </div>
      {/* Keyed: one approval's note or opened input must never carry over to the next (ADR 0032). */}
      <ApprovalCard key={a.aid} a={a} />
      <Link href="/bandeja" className="ch-lnk ch-chl-small">
        {t("inbox")}
      </Link>
    </div>
  );
};
