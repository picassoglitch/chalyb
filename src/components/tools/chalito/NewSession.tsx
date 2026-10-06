"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ActionError } from "@chalito/client";
import type { RemotePermissionMode } from "@chalito/protocol";
import { Link, useRouter } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { adapterNameKey, adaptersFor, keepAdapter, startTarget } from "@/lib/chalito/web/adapters";
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
  const [adapter, setAdapter] = useState("claude-code");
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
  const chosenAdapter = options.find((o) => o.adapter.appId === chosen)?.adapter;

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
      <div className="grid gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p data-testid="no-computers">{t("noComputers")}</p>
        <Link href="/descargar" className="w-fit text-emerald-700 underline">
          {t("download")}
        </Link>
      </div>
    );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    const label = workspace.trim();
    if (!client || !target || !text || !label || !chosenAdapter) return;
    before.current = new Set(live.sessions.map((s) => s.sid));
    setPhase({ kind: "waiting", since: Date.now() });
    try {
      await client.actions.startSession({
        agentDeviceId: target,
        ...startTarget(chosenAdapter),
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
    <form onSubmit={(e) => void submit(e)} className="grid max-w-xl gap-4" data-testid="new-session">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <label className="grid gap-1">
        <span className="font-medium">{t("computer")}</span>
        <select
          className="rounded-lg border px-3 py-2"
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
      </label>
      {selected && !selected.online ? (
        <p role="note" className="text-sm text-amber-900">
          {t("offlineNote")}
        </p>
      ) : null}
      <fieldset className="grid gap-1">
        <legend className="font-medium">{t("adapter")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {options.map(({ adapter: a, availability }) => {
            const off = availability !== "ready";
            const key = adapterNameKey(a.kind);
            const name = key ? ti(key) : a.name;
            return (
              <span
                key={a.appId}
                className="flex items-center gap-2"
                data-testid="adapter-option"
                data-kind={a.kind}
                data-app={a.appId}
              >
                <label className={`flex items-center gap-2 ${off ? "text-neutral-500" : ""}`}>
                  <input
                    type="radio"
                    name="adapter"
                    checked={chosen === a.appId}
                    onChange={() => setAdapter(a.appId)}
                    disabled={waiting || off}
                  />
                  {name}
                </label>
                {off ? (
                  <Link
                    href="/ajustes"
                    className="text-sm text-emerald-700 underline"
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
          <span className="text-sm text-neutral-600">{t("adapterHint")}</span>
        ) : null}
      </fieldset>
      <label className="grid gap-1">
        <span className="font-medium">{t("workspace")}</span>
        <input
          className="rounded-lg border px-3 py-2"
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
        <span className="text-sm text-neutral-600">{t("workspaceHint")}</span>
      </label>
      {labels.length ? (
        <div className="flex flex-wrap gap-2" aria-label={t("recent")}>
          {labels.map((l) => (
            <button
              key={l}
              type="button"
              className="rounded-full border px-3 py-1 text-sm"
              onClick={() => setWorkspace(l)}
              disabled={waiting}
            >
              {l}
            </button>
          ))}
        </div>
      ) : null}
      <label className="grid gap-1">
        <span className="font-medium">{t("mode")}</span>
        <select
          className="rounded-lg border px-3 py-2"
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
      </label>
      <label className="grid gap-1">
        <span className="font-medium">{t("prompt")}</span>
        <textarea
          className="min-h-28 rounded-lg border px-3 py-2"
          required
          placeholder={t("promptPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={waiting}
        />
      </label>
      <button
        className="w-fit rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
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
        <p role="alert" data-testid="start-timeout">
          {t("timeout")}
        </p>
      ) : null}
      {phase.kind === "error" ? <p role="alert">{phase.msg}</p> : null}
    </form>
  );
};
