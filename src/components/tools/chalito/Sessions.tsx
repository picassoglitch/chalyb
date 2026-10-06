"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ActionError, type EventView, type SessionView } from "@chalito/client";
import type { RemotePermissionMode } from "@chalito/protocol";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { adapterNameKey } from "@/lib/chalito/web/adapters";
import { SharingToggle } from "./SharingToggle";

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

/** The only modes a remote surface may set (the device policy is still the ceiling). Never bypassPermissions. */
export const REMOTE_MODES: readonly RemotePermissionMode[] = ["default", "plan", "acceptEdits"];

export const SessionsList = () => {
  const t = useTranslations("chalito.live.sessions");
  const { sessions } = useLive();
  return (
    <div className="ch-chl">
      <div className="ch-chl-row ch-chl-row--between">
        <h2 className="ch-h2">{t("title")}</h2>
        <Link href="/sesiones/nueva" className="ch-btn ch-btn--primary ch-btn--compact">
          {t("new")}
        </Link>
      </div>
      {sessions.length === 0 ? <p className="ch-muted">{t("empty")}</p> : null}
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
                  {s.card?.workspaceLabel ?? s.label} · {t(`state.${s.card?.state ?? s.state ?? "starting"}`)}
                  <AgentName adapter={s.card?.adapter ?? s.adapter} />
                </small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

const text = (c: unknown): string | null =>
  c && typeof c === "object" && typeof (c as { text?: unknown }).text === "string"
    ? (c as { text: string }).text
    : null;

interface Question {
  question: string;
  header?: string;
  options: { label: string; description?: string }[];
}

const Timeline = ({ events }: { events: readonly EventView[] }) => {
  const t = useTranslations("chalito.live.timeline");
  return (
    <ol className="ch-chl-list" aria-label={t("label")}>
      {events.map((e) => {
        const body = text(e.content);
        return (
          <li key={e.eid} data-testid="event" data-type={e.type} className="ch-card ch-chl-card ch-chl-event">
            {/* Message keys can't contain "." (next-intl nesting): session.started → session_started. */}
            <span className="ch-chl-strong">
              {t.has(`type.${e.type.replace(/\./g, "_")}`) ? t(`type.${e.type.replace(/\./g, "_")}`) : e.type}
            </span>
            {body ? <p className="ch-chl-pre">{body}</p> : null}
          </li>
        );
      })}
    </ol>
  );
};

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
}: {
  sid: string;
  q: { questionId: string; questions: Question[] };
  onSent: () => void;
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
        void client?.actions.answer(sid, q.questionId, answers).then(onSent);
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

export const SessionDetail = ({ sid }: { sid: string }) => {
  const t = useTranslations("chalito.live.session");
  const ts = useTranslations("chalito.live.sessions");
  const live = useLive();
  const { client } = useChalito();
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const s: SessionView | undefined = live.sessions.find((x) => x.sid === sid);
  const events = live.events[sid] ?? [];
  if (!s) return <p>{live.status === "live" ? t("notFound") : t("loading")}</p>;
  const card = s.card;
  const run = async (f: () => Promise<unknown>, ok: string) => {
    setNote(null);
    try {
      await f();
      setNote(t(ok));
    } catch (err) {
      setNote(err instanceof ActionError && err.code === "untrusted_agent" ? t("untrusted") : t("failed"));
    }
  };
  const send = (e: FormEvent) => {
    e.preventDefault();
    const msg = draft.trim();
    if (!msg || !client) return;
    setDraft("");
    void run(() => client.actions.prompt(sid, msg), "sent");
  };
  const pendingQuestions = card?.openQuestion ? openQuestions(events).slice(-1) : [];

  return (
    <div className="ch-chl">
      <header className="ch-chl-head">
        <h2 className="ch-h2">{card?.goal ?? s.label ?? sid}</h2>
        <p className="ch-muted">
          {card?.workspaceLabel ?? s.label} ·{" "}
          <span data-testid="session-state">{ts(`state.${card?.state ?? s.state ?? "starting"}`)}</span>
          <AgentName adapter={card?.adapter ?? s.adapter} />
        </p>
      </header>
      {card ? (
        <dl data-testid="session-card" className="ch-card ch-chl-card ch-chl-dl">
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
      <SharingToggle scope="session" target={sid} />
      {pendingQuestions.map((q) => (
        <QuestionForm key={q.questionId} sid={sid} q={q} onSent={() => setNote(t("answerSent"))} />
      ))}
      <div className="ch-chl-row">
        <button
          className="ch-btn ch-btn--secondary ch-btn--compact"
          onClick={() => client && void run(() => client.actions.interrupt(sid), "interrupted")}
        >
          {t("interrupt")}
        </button>
        <button
          className="ch-btn ch-btn--secondary ch-btn--compact"
          onClick={() => client && void run(() => client.actions.resume(sid), "resumed")}
        >
          {t("resume")}
        </button>
        <label className="ch-chl-row ch-chl-push">
          {t("mode")}
          <select
            data-testid="permission-mode"
            className="ch-select"
            value={s.permissionMode ?? "default"}
            onChange={(e) =>
              client &&
              void run(() => client.actions.setPermissionMode(sid, e.target.value as RemotePermissionMode), "modeSet")
            }
          >
            {REMOTE_MODES.map((m) => (
              <option key={m} value={m}>
                {t(`modes.${m}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form onSubmit={send} className="ch-paste">
        <label htmlFor="prompt" className="ch-sr">
          {t("prompt")}
        </label>
        <input
          id="prompt"
          className="ch-input"
          placeholder={t("promptPlaceholder")}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="ch-btn ch-btn--primary">{t("send")}</button>
      </form>
      {note ? <p role="status">{note}</p> : null}
      <Timeline events={events} />
    </div>
  );
};
