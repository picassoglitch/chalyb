"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ActionError } from "@chalito/client";
import type { AdapterKind, RemotePermissionMode } from "@chalito/protocol";
import { Link, useRouter } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { adapterNameKey, adaptersFor, keepAdapter } from "@/lib/chalito/web/adapters";
import { LOAD_TIMEOUT_MS, indexConnections, withTimeout, type StatusIndex } from "@/lib/chalito/web/connect";
import { REMOTE_MODES } from "./Sessions";

export { START_ADAPTERS } from "@/lib/chalito/web/adapters";
/** The computer may refuse silently (unknown workspace, adapter off): stop waiting after this. */
export const START_WAIT_MS = 30_000;

type Phase =
  { kind: "idle" } | { kind: "waiting"; since: number } | { kind: "timeout" } | { kind: "error"; msg: string };

/**
 * "Nueva sesión": a signed session.start to a paired computer (ClientActions.startSession), the
 * prompt sealed to that computer. The workspace is a label the computer allowed locally; Chalito
 * never sees its paths, so the labels offered are the ones its sessions have used. The computer
 * answers by creating the session, which then shows up live; a refusal is only in its own log.
 */
export const NewSession = () => {
  const t = useTranslations("chalito.live.newSession");
  const tm = useTranslations("chalito.live.session.modes");
  const ti = useTranslations("chalito.integrations");
  const { client, settings } = useChalito();
  const live = useLive();
  const router = useRouter();
  const computers = live.devices.filter((d) => d.role === "agent" && !d.revoked);
  const [agent, setAgent] = useState("");
  const [adapter, setAdapter] = useState<AdapterKind>("claude-code");
  const [workspace, setWorkspace] = useState("");
  const [mode, setMode] = useState<RemotePermissionMode>("default");
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  /** Sessions that existed when the command went out; the new one is whatever appears next. */
  const before = useRef<Set<string>>(new Set());
  /** What each computer reported per provider (chalito.connections): Grok and Gemini need "connected". */
  const [connections, setConnections] = useState<StatusIndex>({});

  const target = agent || computers[0]?.deviceId || "";
  const options = useMemo(() => adaptersFor(connections, target), [connections, target]);
  const chosen = keepAdapter(adapter, options);

  // Read once on open; unreadable means Grok and Gemini stay disabled with the link to connect them.
  useEffect(() => {
    if (!settings) return;
    let alive = true;
    withTimeout(settings.connections(), LOAD_TIMEOUT_MS).then(
      (rows) => alive && setConnections(indexConnections(rows)),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [settings]);
  const labels = useMemo(
    () =>
      [
        ...new Set(
          live.sessions
            .filter((s) => s.agentDeviceId === target)
            .map((s) => s.card?.workspaceLabel ?? s.label)
            .filter((l): l is string => !!l),
        ),
      ].sort(),
    [live.sessions, target],
  );

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const started = live.sessions.find((s) => s.agentDeviceId === target && !before.current.has(s.sid));
    if (started) {
      router.push(`/sesiones/${encodeURIComponent(started.sid)}`);
      return;
    }
    const left = START_WAIT_MS - (Date.now() - phase.since);
    const timer = setTimeout(() => setPhase({ kind: "timeout" }), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [phase, live.sessions, target, router]);

  if (computers.length === 0)
    return (
      <div className="ch-chl ch-chl--tight">
        <h2 className="ch-h2">{t("title")}</h2>
        <p data-testid="no-computers">{t("noComputers")}</p>
        <Link href="/descargar" className="ch-lnk ch-chl-fit">
          {t("download")}
        </Link>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    const label = workspace.trim();
    if (!client || !target || !text || !label) return;
    before.current = new Set(live.sessions.map((s) => s.sid));
    setPhase({ kind: "waiting", since: Date.now() });
    try {
      await client.actions.startSession({
        agentDeviceId: target,
        adapter: chosen,
        workspaceLabel: label,
        prompt: text,
        permissionMode: mode,
      });
    } catch (err) {
      setPhase({
        kind: "error",
        msg: err instanceof ActionError && err.code === "untrusted_agent" ? t("untrusted") : t("failed"),
      });
    }
  };

  const selected = computers.find((c) => c.deviceId === target);
  const waiting = phase.kind === "waiting";
  return (
    <form onSubmit={(e) => void submit(e)} className="ch-chl ch-chl--narrow" data-testid="new-session">
      <h2 className="ch-h2">{t("title")}</h2>
      <div className="ch-field">
        <label htmlFor="ns-computer">{t("computer")}</label>
        <select
          id="ns-computer"
          className="ch-input"
          value={target}
          onChange={(e) => setAgent(e.target.value)}
          disabled={waiting}
        >
          {computers.map((c) => (
            <option key={c.deviceId} value={c.deviceId}>
              {c.name} · {c.online ? t("online") : t("offline")}
            </option>
          ))}
        </select>
      </div>
      {selected && !selected.online ? (
        <p role="note" className="ch-chl-small ch-chl-warn">
          {t("offlineNote")}
        </p>
      ) : null}
      <fieldset className="ch-chl-fieldset ch-chl ch-chl--tight">
        <legend className="ch-chl-strong">{t("adapter")}</legend>
        <div className="ch-chl-row">
          {options.map(({ adapter: a, availability }) => {
            const off = availability !== "ready";
            const name = ti(adapterNameKey(a.kind)!);
            return (
              <span key={a.kind} className="ch-chl-row" data-testid="adapter-option" data-kind={a.kind}>
                <label className={`ch-chl-check${off ? " ch-chl-check--off" : ""}`}>
                  <input
                    type="radio"
                    name="adapter"
                    checked={chosen === a.kind}
                    onChange={() => setAdapter(a.kind)}
                    disabled={waiting || off}
                  />
                  {name}
                </label>
                {off ? (
                  <Link
                    href="/ajustes"
                    className="ch-lnk ch-chl-small"
                    aria-label={t("connectAdapter", { name })}
                    data-testid="adapter-connect"
                  >
                    {t("connect")}
                  </Link>
                ) : null}
              </span>
            );
          })}
        </div>
        {options.some((o) => o.availability !== "ready") ? (
          <span className="ch-chl-small">{t("adapterHint")}</span>
        ) : null}
      </fieldset>
      <div className="ch-field">
        <label htmlFor="ns-workspace">{t("workspace")}</label>
        <input
          id="ns-workspace"
          className="ch-input"
          list="workspace-labels"
          maxLength={80}
          required
          value={workspace}
          onChange={(e) => setWorkspace(e.target.value)}
          disabled={waiting}
        />
        <datalist id="workspace-labels">
          {labels.map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
        <p className="ch-field__hint ch-muted">{t("workspaceHint")}</p>
      </div>
      {labels.length ? (
        <div className="ch-chl-row" aria-label={t("recent")}>
          {labels.map((l) => (
            <button
              key={l}
              type="button"
              className="ch-chip ch-chip--sm"
              onClick={() => setWorkspace(l)}
              disabled={waiting}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}
      <div className="ch-field">
        <label htmlFor="ns-mode">{t("mode")}</label>
        <select
          id="ns-mode"
          className="ch-input"
          value={mode}
          onChange={(e) => setMode(e.target.value as RemotePermissionMode)}
          disabled={waiting}
        >
          {REMOTE_MODES.map((m) => (
            <option key={m} value={m}>
              {tm(m)}
            </option>
          ))}
        </select>
      </div>
      <div className="ch-field">
        <label htmlFor="ns-prompt">{t("prompt")}</label>
        <textarea
          id="ns-prompt"
          className="ch-input ch-textarea"
          required
          placeholder={t("promptPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={waiting}
        />
      </div>
      <button
        className="ch-btn ch-btn--primary ch-chl-fit"
        disabled={waiting || !prompt.trim() || !workspace.trim()}
      >
        {t("start")}
      </button>
      {waiting ? (
        <p role="status" aria-live="polite">
          {t("waiting")}
        </p>
      ) : null}
      {phase.kind === "timeout" ? (
        <p role="alert" data-testid="start-timeout" className="ch-err">
          {t("timeout")}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p role="alert" className="ch-err">
          {phase.msg}
        </p>
      ) : null}
    </form>
  );
};
