"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ActionError, type ApprovalView, type MesaDecisionView } from "@chalito/client";
import { MesaDecisionCard } from "@chalito/ui";
import { Link } from "@/lib/chalito/navigation";
import { approvalText } from "@/lib/chalito/web/approval-text";
import {
  computerControlInfo,
  isComputerControl,
  malformedComputerControl,
  needsStepUp,
} from "@/lib/chalito/web/computer-control";
import { confirmStepUp } from "./StepUpHost";
import { useChalito, useLive, useNow } from "@/lib/chalito/provider";
import { Loading } from "./Loading";
import { Inbox as InboxIcon } from "lucide-react";
import { Empty } from "./Empty";

const RISK_STYLE: Record<ApprovalView["risk"], string> = {
  LOW: "ch-pill--gray",
  MED: "ch-pill--acc",
  HIGH: "ch-pill--warn",
  CRITICAL: "ch-pill--bad",
};

export const RiskBadge = ({ risk }: { risk: ApprovalView["risk"] }) => {
  const t = useTranslations("chalito.live.risk");
  return (
    <span
      data-testid="risk-badge"
      data-risk={risk}
      className={`ch-pill ${RISK_STYLE[risk]}`}
    >
      {t(risk)}
    </span>
  );
};

const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * A Mesa decision (raised by the orchestrator, not an agent): the question and options as text; a
 * pick is a signed Decision (body.choice, target "orchestrator", MED: no passkey), then the
 * orchestrator is poked to verify it. Never shown as an unverified tool approval.
 */
const MesaApprovalCard = ({ a, m }: { a: ApprovalView; m: MesaDecisionView }) => {
  const t = useTranslations("chalito.settings.mesa.decision");
  const { client, mesa } = useChalito();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const expired = a.status === "expired" || (a.status === "pending" && a.expiresAt <= now);
  const answer = async (choice: number | null) => {
    if (!client) return;
    setBusy(true);
    try {
      await client.actions.decide(a.aid, choice !== null, choice !== null ? { choice } : {});
      const status = (await mesa?.api.checkDecision(a.aid)) ?? "pending";
      setNote(
        status === "pending" || status === "error"
          ? t("pending")
          : choice !== null
            ? t("sent", { option: m.options[choice]! })
            : t("dismissed"),
      );
    } catch {
      setNote(t("error"));
    } finally {
      setBusy(false);
    }
  };
  const resolved = a.status !== "pending" || expired ? t("resolved") : null;
  return (
    <article data-testid="approval" data-aid={a.aid} data-status={expired ? "expired" : a.status} data-kind="mesa">
      <h2 className="ch-ghead">{t("title")}</h2>
      <MesaDecisionCard
        from={m.from}
        question={m.question}
        options={m.options}
        busy={busy || !client}
        done={note ?? resolved}
        onPick={(i) => void answer(i)}
        onDismiss={() => void answer(null)}
      />
    </article>
  );
};

/** One approval: risk, countdown, opened details, approve/deny (HIGH asks for step-up). */
export const ApprovalCard = ({ a }: { a: ApprovalView }) =>
  a.mesa ? <MesaApprovalCard a={a} m={a.mesa} /> : <ToolApprovalCard a={a} />;

const ToolApprovalCard = ({ a }: { a: ApprovalView }) => {
  const t = useTranslations("chalito.live.approval");
  const tc = useTranslations("chalito.live.approval.computer");
  const ti = useTranslations("chalito.integrations");
  const { client, passkey } = useChalito();
  const { devices } = useLive();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const expired = a.status === "expired" || (a.status === "pending" && a.expiresAt <= now);
  const pending = a.status === "pending" && !expired;
  // HIGH/CRITICAL (and every computer_control) need this device's passkey; without one, say so.
  const needsPasskey = needsStepUp(a) && !passkey.enrolled;
  // Computer control: its own copy and confirm; never approvable without HIGH + step-up.
  const cc = isComputerControl(a);
  const ccBad = malformedComputerControl(a);
  const details = a.details as {
    toolName?: string;
    summary?: string;
    reasons?: string[];
    input?: unknown;
    summaryTruncated?: boolean;
  } | null;
  const text = details ? approvalText(details) : null;
  const ccInfo = cc ? computerControlInfo(a, details?.input, devices) : null;
  const computer = ccInfo?.computer ?? tc("thisComputer");
  // R-M10: a cut summary can't be approved until the person has seen the whole input.
  const [expanded, setExpanded] = useState(false);
  const mustExpand = !!text?.truncated && !expanded;
  // ADR 0019 (R-H1): only a request the agent signed can be allowed; denying always works.
  const unverified = !a.verified;

  const decide = async (allow: boolean) => {
    if (!client) return;
    // The person reads what computer control means before the passkey; cancel sends nothing.
    if (allow && cc && !(await confirmStepUp(a.risk, { kind: "computer_control", computer }))) {
      setNote(t("error.step_up_cancelled"));
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      await client.actions.decide(a.aid, allow);
      setNote(t(allow ? "sentAllow" : "sentDeny"));
    } catch (err) {
      const code = err instanceof ActionError ? err.code : "error";
      setNote(
        t(
          `error.${
            code === "step_up_cancelled" ||
            code === "expired" ||
            code === "not_pending" ||
            code === "unverified_request"
              ? code
              : "other"
          }`,
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      data-testid="approval"
      data-aid={a.aid}
      data-status={expired ? "expired" : a.status}
      data-kind={a.kind}
      className={`ch-card ch-chl-card${cc ? " ch-chl-card--warn" : ""}`}
    >
      <header className="ch-chl-row">
        <RiskBadge risk={a.risk} />
        <span className="ch-chl-strong">{cc ? tc("title") : (details?.toolName ?? t("unknownTool"))}</span>
        {unverified ? (
          <span
            data-testid="unverified"
            className="ch-pill ch-pill--bad"
          >
            {t("unverified")}
          </span>
        ) : null}
        {pending ? (
          <span data-testid="countdown" className="ch-chl-mono ch-chl-push" aria-label={t("expiresIn")}>
            {mmss(a.expiresAt - now)}
          </span>
        ) : null}
      </header>
      {cc ? (
        <div className="ch-chl ch-chl--tight" data-testid="computer-control">
          <p className="ch-chl-strong">{tc("body", { computer })}</p>
          {ccInfo?.session || ccInfo?.adapterKey ? (
            <p className="ch-muted" data-testid="computer-control-session">
              {tc("session", {
                session: ccInfo.session ?? "—",
                agent: ccInfo.adapterKey ? ti(ccInfo.adapterKey) : "—",
              })}
            </p>
          ) : null}
          <p>{tc("stop")}</p>
          <p className="ch-muted">{tc("once")}</p>
        </div>
      ) : null}
      {details ? (
        <div className="ch-chl ch-chl--tight">
          <p className="ch-chl-mono" data-testid="approval-summary">
            {text!.summary.text}
            {text!.truncated ? (
              <span data-testid="approval-truncated" className="ch-pill ch-pill--warn ch-chl-inline">
                {text!.hiddenChars !== null ? t("truncatedN", { n: text!.hiddenChars }) : t("truncated")}
              </span>
            ) : null}
          </p>
          {text!.summary.hidden || text!.full?.hidden ? (
            <p role="note" data-testid="approval-hidden-chars" className="ch-chl-warn">
              {t("hiddenChars")}
            </p>
          ) : null}
          {text!.full ? (
            <details
              className="ch-chl-details"
              onToggle={(e) => e.currentTarget.open && setExpanded(true)}
            >
              <summary data-testid="approval-expand">
                {t("fullInput")}
              </summary>
              <pre data-testid="approval-full" className="ch-chl-mono ch-chl-pre">
                {text!.full.text}
              </pre>
            </details>
          ) : null}
          {details.reasons?.length ? <p className="ch-muted">{details.reasons.join(" · ")}</p> : null}
        </div>
      ) : (
        <p className="ch-chl-small">{t("sealed")}</p>
      )}
      {a.stepUpRequired && pending ? <p className="ch-chl-small ch-chl-warn">{t("stepUpNeeded")}</p> : null}
      <p data-testid="approval-status" className="ch-chl-strong">
        {expired ? t("expired") : a.status === "pending" ? t("pending") : t(`status.${a.status}`)}
      </p>
      {pending ? (
        <div className="ch-chl ch-chl--tight">
          {needsPasskey ? (
            <p data-testid="needs-passkey" className="ch-chl-small ch-chl-warn">
              {t("needsPasskey")}{" "}
              <Link href="/dispositivos" className="ch-lnk">
                {t("enrolPasskey")}
              </Link>
            </p>
          ) : null}
          {unverified ? (
            <p data-testid="unverified-note" className="ch-chl-small ch-chl-bad">
              {t("unverifiedNote")}
            </p>
          ) : null}
          {ccBad ? (
            <p data-testid="computer-control-invalid" className="ch-err">
              {tc("invalid")}
            </p>
          ) : null}
          {mustExpand ? (
            <p data-testid="must-expand" className="ch-chl-small ch-chl-warn">
              {t("mustExpand")}
            </p>
          ) : null}
          <div className="ch-chl-row">
            <button
              className="ch-btn ch-btn--primary"
              disabled={busy || needsPasskey || mustExpand || unverified || ccBad}
              data-testid="approve"
              onClick={() => void decide(true)}
            >
              {cc ? tc("approve") : t("approve")}
            </button>
            <button
              className="ch-btn ch-btn--secondary"
              disabled={busy}
              onClick={() => void decide(false)}
            >
              {t("deny")}
            </button>
          </div>
        </div>
      ) : null}
      {note ? (
        <p role="status" className="ch-chl-small">
          {note}
        </p>
      ) : null}
      <Link
        href={`/sesiones/${encodeURIComponent(a.sid)}`}
        className="ch-lnk ch-chl-fit"
      >
        {t("openSession")}
      </Link>
    </article>
  );
};

export const Inbox = () => {
  const t = useTranslations("chalito.live.inbox");
  const { approvals, notifications } = useLive();
  const { client } = useChalito();
  const pending = approvals.filter((a) => a.status === "pending");
  const done = approvals.filter((a) => a.status !== "pending");
  const open = notifications.filter((n) => n.state === "pending");
  return (
    <div className="ch-chl">
      <h2 className="ch-h2">{t("title")}</h2>
      {open.length ? (
        <section className="ch-chl ch-chl--tight" aria-labelledby="notif-h">
          <h2 id="notif-h" className="ch-ghead">
            {t("notifications")}
          </h2>
          {open.map((n) => (
            <div
              key={n.nid}
              data-testid="notification"
              className="ch-card ch-chl-card ch-chl-row"
            >
              <span>{t("notification", { count: Object.values(n.counts).reduce((x, y) => x + y, 0) })}</span>
              <button
                className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-push"
                onClick={() => void client?.actions.ackNotification(n.nid)}
              >
                {t("ack")}
              </button>
            </div>
          ))}
        </section>
      ) : null}
      <section className="ch-chl-list" aria-labelledby="pending-h">
        <h2 id="pending-h" className="ch-ghead">
          {t("pending", { count: pending.length })}
        </h2>
        {pending.length ? (
          pending.map((a) => <ApprovalCard key={a.aid} a={a} />)
        ) : (
          <Empty icon={<InboxIcon />} title={t("empty")} body={t("emptyBody")} />
        )}
      </section>
      {done.length ? (
        <section className="ch-chl-list" aria-labelledby="done-h">
          <h2 id="done-h" className="ch-ghead">
            {t("history")}
          </h2>
          {done.map((a) => (
            <ApprovalCard key={a.aid} a={a} />
          ))}
        </section>
      ) : null}
    </div>
  );
};

/** /a/[id]: one approval, wherever it came from (push, WhatsApp, a call). */
export const ApprovalDeepLink = ({ aid }: { aid: string }) => {
  const t = useTranslations("chalito.live.approval");
  const { approvals, status } = useLive();
  const a = approvals.find((x) => x.aid === aid);
  if (a) return <ApprovalCard a={a} />;
  return status === "live" ? (
    <p className="ch-card ch-chl-card">{t("notFound")}</p>
  ) : (
    <Loading label={t("loading")} rows={1} height={160} />
  );
};
