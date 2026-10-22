"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { type ApprovalView, type DraftView, type EventView, type SessionView } from "@chalito/client";
import type { RemotePermissionMode } from "@chalito/protocol";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive, useNow } from "@/lib/chalito/provider";
import { useLiveSynced } from "@/lib/chalito/useLiveSynced";
import { createSessionActions, type ActionLanes, type ActionResult } from "@/lib/chalito/web/session-actions";
import {
  answerable,
  earlierHidden,
  buildTranscript,
  canResume,
  canStop,
  fromKey,
  pendingFor,
  pillState,
  sessionStateOf,
  type PillState,
  type ToolStep,
  type TranscriptItem,
} from "@/lib/chalito/web/transcript";
import { ApprovalCard } from "./Approvals";
import { adapterNameKey } from "@/lib/chalito/web/adapters";
import { SharingToggle } from "./SharingToggle";
import { Loading } from "./Loading";
import { MessageCircle, Play, SendHorizontal, Square } from "lucide-react";
import { Empty } from "./Empty";

/** The session's coding agent by name (integrations.*), or nothing when unknown. */
const AgentName = ({ adapter }: { adapter: string | undefined }) => {
  const ti = useTranslations("chalito.integrations");
  const key = adapterNameKey(adapter);
  return key ? (
    <span data-testid="session-adapter" data-kind={adapter}>
      {" · "}
      {ti(key)}
    </span>
  ) : null;
};

/** A session's state label; a state this build doesn't know shows as "starting", not a raw key. */
const useStateLabel = () => {
  const t = useTranslations("chalito.live.sessions");
  return (state: string | undefined) => {
    const key = `state.${state ?? "starting"}`;
    return t.has(key) ? t(key) : t("state.starting");
  };
};

/** The only modes a remote surface may set (the device policy is still the ceiling). Never bypassPermissions. */
export const REMOTE_MODES: readonly RemotePermissionMode[] = ["default", "plan", "acceptEdits"];

export const SessionsList = () => {
  const t = useTranslations("chalito.live.sessions");
  const tl = useTranslations("chalito.live.session");
  const { sessions } = useLive();
  // "live" comes before the first pull: don't say "no sessions" until it has landed.
  const synced = useLiveSynced();
  const stateLabel = useStateLabel();
  return (
    <div className="ch-chl">
      <div className="ch-chl-row ch-chl-row--between">
        <h2 className="ch-h2">{t("title")}</h2>
        <Link href="/sesiones/nueva" className="ch-btn ch-btn--primary ch-btn--compact">
          {t("new")}
        </Link>
      </div>
      {sessions.length === 0 && !synced ? <Loading label={tl("loading")} /> : null}
      {sessions.length === 0 && synced ? (
        <Empty
          icon={<MessageCircle />}
          title={t("empty")}
          body={t("emptyBody")}
          action={{ href: "/sesiones/nueva", label: t("new") }}
        />
      ) : null}
      {sessions.length ? (
        <ul className="ch-group">
        {sessions.map((s) => (
          <li key={s.sid} data-testid="session-row">
            <Link
              href={`/sesiones/${encodeURIComponent(s.sid)}`}
              className="ch-row"
            >
              <span className="ch-row__tx">
                <b>{s.card?.goal ?? s.label ?? s.sid}</b>
                <small>
                  {s.card?.workspaceLabel ?? s.label} · {stateLabel(s.card?.state ?? s.state)}
                  <AgentName adapter={s.card?.adapter ?? s.adapter} />
                </small>
              </span>
            </Link>
          </li>
        ))}
        </ul>
      ) : null}
    </div>
  );
};

interface Question {
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
}

/** Open agent questions: the last question.asked not followed by our answer. */
const openQuestions = (events: readonly EventView[]) => {
  const out: { questionId: string; questions: Question[] }[] = [];
  for (const e of events) {
    if (e.type === "question.asked" && Array.isArray(e.content))
      out.push({ questionId: String(e.meta.questionId), questions: e.content as Question[] });
  }
  return out;
};

const QuestionForm = ({
  sid,
  q,
  onSent,
  onFailed,
}: {
  sid: string;
  q: { questionId: string; questions: Question[] };
  onSent: () => void;
  onFailed: () => void;
}) => {
  const t = useTranslations("chalito.live.session");
  const { client } = useChalito();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  return (
    <form
      data-testid="question"
      className="ch-card ch-chl-card"
      onSubmit={(e) => {
        e.preventDefault();
        // The agent clears the open question once it has the answer, unmounting this form;
        // the confirmation lives in the session view.
        client?.actions.answer(sid, q.questionId, answers).then(onSent, onFailed);
      }}
    >
      {q.questions.map((qq) => (
        <fieldset key={qq.question} className="ch-chl-fieldset ch-chl ch-chl--tight">
          <legend className="ch-chl-strong">{qq.question}</legend>
          {qq.options.map((o) => (
            <label key={o.label} className="ch-chl-check">
              <input
                type="radio"
                name={qq.question}
                checked={answers[qq.question] === o.label}
                onChange={() => setAnswers({ ...answers, [qq.question]: o.label })}
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      ))}
      <button
        className="ch-btn ch-btn--primary ch-chl-fit"
        disabled={Object.keys(answers).length < q.questions.length}
      >
        {t("answer")}
      </button>
    </form>
  );
};

const PILL_STYLE: Record<PillState, string> = {
  running: "ch-pill--acc",
  waiting: "ch-pill--warn",
  idle: "ch-pill--gray",
  ended: "ch-pill--dark",
};

const ToolStepRow = ({ step }: { step: ToolStep }) => {
  const t = useTranslations("chalito.live.transcript");
  const status = step.stopped ? "stopped" : step.ok === null ? "running" : step.ok ? "ok" : "failed";
  const line = (
    <>
      <span className="ch-chl-step__cat">{t(`category.${step.category}`)}</span>
      <span className="ch-chl-step__sum ch-chl-mono">{step.summary ?? step.toolName ?? t("sealedStep")}</span>
      <span className={`ch-chl-step__dot ch-chl-step__dot--${status}`} aria-label={t(`step.${status}`)} role="img" />
    </>
  );
  return (
    <li data-testid="tool-step" data-category={step.category} data-status={status} className="ch-chl-step">
      {step.detail ? (
        <details className="ch-chl-step__fold">
          <summary>{line}</summary>
          {step.toolName ? <p className="ch-chl-small">{step.toolName}</p> : null}
          <pre data-testid="tool-step-detail" className="ch-chl-mono ch-chl-pre">
            {step.detail}
          </pre>
        </details>
      ) : (
        <div className="ch-chl-step__fold ch-chl-step__fold--flat">{line}</div>
      )}
    </li>
  );
};

const Bubble = ({ item }: { item: TranscriptItem }) => {
  const t = useTranslations("chalito.live.transcript");
  const tt = useTranslations("chalito.live.timeline");
  switch (item.kind) {
    case "user":
      return (
        <li data-testid="msg-user" className="ch-chl-msg ch-chl-msg--me">
          <span className="ch-chl-msg__who">{t(`from.${fromKey(item.origin)}`)}</span>
          <p className="ch-chl-pre">{item.text ?? t("sealedMessage")}</p>
        </li>
      );
    case "assistant":
      return (
        <li data-testid="msg-assistant" className="ch-chl-msg">
          <p className="ch-chl-pre">{item.text ?? t("sealedMessage")}</p>
        </li>
      );
    case "draft":
      return (
        <li data-testid="msg-draft" className="ch-chl-msg ch-chl-msg--draft" aria-busy="true">
          <p className="ch-chl-pre">
            {item.text}
            <span className="ch-chl-caret" aria-hidden="true" />
          </p>
          <span className="ch-chl-msg__who">{t("writing")}</span>
        </li>
      );
    case "tool":
      return <ToolStepRow step={item} />;
    case "notice": {
      const key = `type.${item.type.replace(/\./g, "_")}`;
      const label = tt.has(key) ? tt(key) : item.type;
      const code = item.type === "error" && item.code && t.has(`error.${item.code}`) ? t(`error.${item.code}`) : null;
      return (
        <li
          data-testid="notice"
          data-type={item.type}
          className={`ch-chl-notice${item.type === "error" ? " ch-chl-bad" : ""}`}
        >
          {code ? `${label}: ${code}` : label}
        </li>
      );
    }
  }
};

export interface SessionLiveProps {
  session: SessionView;
  events: readonly EventView[];
  draft: DraftView | null;
  /** This session's open approvals. */
  pending: readonly ApprovalView[];
  note: string | null;
  /** No client yet, or a prompt/resume/mode change is on its way: those are disabled. */
  busy?: boolean;
  /** Stop's own lane (never waits behind the others): no client yet, or a Stop on its way. */
  stopBusy?: boolean;
  onStop: () => void;
  onResume: () => void;
  /** Resolves true once sent; the typed text stays until then. */
  onSend: (text: string) => Promise<boolean>;
  onMode: (m: RemotePermissionMode) => void;
  onAnswered: () => void;
  onAnswerFailed: () => void;
}

/** The /rc-style session page; all live data comes in as props (SessionDetail wires the store). */
export const SessionLive = ({
  session: s,
  events,
  draft,
  pending,
  note,
  busy = false,
  stopBusy = false,
  onStop,
  onResume,
  onSend,
  onMode,
  onAnswered,
  onAnswerFailed,
}: SessionLiveProps) => {
  const t = useTranslations("chalito.live.session");
  const tr = useTranslations("chalito.live.transcript");
  const [text, setText] = useState("");
  const card = s.card;
  const state = sessionStateOf(s);
  const now = useNow(1000);
  // Overdue cards stay (they show "expired"), but only answerable ones count as waiting.
  const open = answerable(pending, now);
  const pill = pillState(state, open);
  const earlier = earlierHidden(events);
  // No turn running (idle, stopped, over): a step that never reported back won't anymore.
  const settled = !canStop(state);
  const items = useMemo(() => buildTranscript(events, draft, settled), [events, draft, settled]);
  const pendingQuestions = card?.openQuestion ? openQuestions(events).slice(-1) : [];
  const end = useRef<HTMLDivElement>(null);
  // Whether the person was at the bottom BEFORE new content grew the page (else a tall card stops the follow).
  const following = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      following.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const growth = items.length + (draft?.text.length ?? 0) + pending.length;
  useEffect(() => {
    if (following.current) end.current?.scrollIntoView({ block: "end" });
  }, [growth]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || busy) return;
    if (await onSend(msg)) setText((cur) => (cur.trim() === msg ? "" : cur));
  };

  return (
    <div className="ch-chl ch-chl-live" data-testid="session-live">
      <header className="ch-chl-head">
        <h2 className="ch-h2 ch-chl-wrap">{card?.goal ?? s.label ?? s.sid}</h2>
        <div className="ch-chl-row">
          <span data-testid="session-pill" data-state={pill} className={`ch-pill ${PILL_STYLE[pill]}`}>
            {tr(`pill.${pill}`)}
          </span>
          <span className="ch-muted ch-chl-small">
            {card?.workspaceLabel ?? s.label}
            <span className="ch-sr">
              {" · "}
              <span data-testid="session-state">{tr(`pill.${pill}`)}</span>
            </span>
            <AgentName adapter={card?.adapter ?? s.adapter} />
          </span>
        </div>
      </header>

      {canStop(state) ? (
        <button
          type="button"
          data-testid="session-stop"
          className="ch-btn ch-btn--danger ch-btn--xl ch-chl-stop"
          disabled={stopBusy}
          onClick={onStop}
        >
          <Square aria-hidden="true" />
          {t("stop")}
        </button>
      ) : canResume(state) ? (
        <button
          type="button"
          data-testid="session-resume"
          className="ch-btn ch-btn--secondary ch-btn--xl ch-chl-stop"
          disabled={busy}
          onClick={onResume}
        >
          <Play aria-hidden="true" />
          {t("resume")}
        </button>
      ) : null}

      <ol className="ch-chl-transcript" aria-label={tr("label")} data-testid="transcript">
        {earlier ? (
          <li data-testid="transcript-earlier" className="ch-chl-notice">
            {tr("earlier")}
          </li>
        ) : null}
        {items.length === 0 ? <li className="ch-chl-notice">{tr("empty")}</li> : null}
        {items.map((it) => (
          <Bubble key={it.key} item={it} />
        ))}
      </ol>

      {pending.length ? (
        <section className="ch-chl-list" aria-labelledby="session-pending-h" data-testid="session-approvals">
          <h3 id="session-pending-h" className="ch-ghead">
            {tr("waitingHere", { count: open })}
          </h3>
          {pending.map((a) => (
            <ApprovalCard key={a.aid} a={a} inSession />
          ))}
        </section>
      ) : null}
      {pendingQuestions.map((q) => (
        <QuestionForm key={q.questionId} sid={s.sid} q={q} onSent={onAnswered} onFailed={onAnswerFailed} />
      ))}
      <div ref={end} />

      <form onSubmit={(e) => void send(e)} className="ch-paste ch-chl-composer" data-testid="composer">
        <label htmlFor="prompt" className="ch-sr">
          {t("prompt")}
        </label>
        <input
          id="prompt"
          className="ch-input"
          placeholder={t("promptPlaceholder")}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={8000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="ch-btn ch-btn--primary" disabled={busy || !text.trim()} aria-label={t("send")}>
          <SendHorizontal aria-hidden="true" />
          <span className="ch-chl-composer__label">{t("send")}</span>
        </button>
      </form>
      {note ? (
        <p role="status" className="ch-chl-small">
          {note}
        </p>
      ) : null}

      <details className="ch-card ch-chl-card ch-chl-more">
        <summary>{tr("more")}</summary>
        {card ? (
          <dl data-testid="session-card" className="ch-chl-dl">
            {card.lastAction ? (
              <>
                <dt className="ch-muted">{t("card.lastAction")}</dt>
                <dd>{card.lastAction}</dd>
              </>
            ) : null}
            <dt className="ch-muted">{t("card.pendingApprovals")}</dt>
            <dd>{card.pendingApprovals}</dd>
            <dt className="ch-muted">{t("card.filesTouched")}</dt>
            <dd data-testid="files-touched">{card.filesTouched}</dd>
            {card.tests ? (
              <>
                <dt className="ch-muted">{t("card.tests")}</dt>
                <dd>{t("card.testsValue", { passed: card.tests.passed, failed: card.tests.failed })}</dd>
              </>
            ) : null}
            {card.blockers.length ? (
              <>
                <dt className="ch-muted">{t("card.blockers")}</dt>
                <dd>{card.blockers.join(" · ")}</dd>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="ch-chl-small">{t("sealed")}</p>
        )}
        <div className="ch-chl-row">
          <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" disabled={busy} onClick={onResume}>
            {t("resume")}
          </button>
          <label className="ch-chl-row ch-chl-push">
            {t("mode")}
            <select
              data-testid="permission-mode"
              className="ch-select"
              disabled={busy}
              value={s.permissionMode ?? "default"}
              onChange={(e) => onMode(e.target.value as RemotePermissionMode)}
            >
              {REMOTE_MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`modes.${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <SharingToggle scope="session" target={s.sid} />
      </details>
    </div>
  );
};

export const SessionDetail = ({ sid }: { sid: string }) => {
  const t = useTranslations("chalito.live.session");
  const live = useLive();
  const synced = useLiveSynced();
  const { client } = useChalito();
  const [note, setNote] = useState<string | null>(null);
  const [lanes, setLanes] = useState<ActionLanes>({ busy: false, stopping: false });
  const actions = useMemo(() => (client ? createSessionActions(client, sid, setLanes) : null), [client, sid]);
  const s: SessionView | undefined = live.sessions.find((x) => x.sid === sid);
  if (!s)
    return synced ? (
      <p className="ch-card ch-chl-card">{t("notFound")}</p>
    ) : (
      <Loading label={t("loading")} />
    );
  const report = (r: ActionResult, ok: string): boolean => {
    if (r !== "skipped") setNote(r === "ok" ? t(ok) : r === "untrusted" ? t("untrusted") : t("failed"));
    return r === "ok";
  };
  return (
    <SessionLive
      session={s}
      events={live.events[sid] ?? []}
      draft={live.drafts[sid] ?? null}
      pending={pendingFor(live.approvals, sid)}
      note={note}
      busy={!actions || lanes.busy}
      stopBusy={!actions || lanes.stopping}
      onStop={() => actions && void actions.stop().then((r) => report(r, "interrupted"))}
      onResume={() => actions && void actions.resume().then((r) => report(r, "resumed"))}
      onSend={async (msg) => !!actions && report(await actions.prompt(msg), "sent")}
      onMode={(m) => actions && void actions.setMode(m).then((r) => report(r, "modeSet"))}
      onAnswered={() => setNote(t("answerSent"))}
      onAnswerFailed={() => setNote(t("failed"))}
    />
  );
};
