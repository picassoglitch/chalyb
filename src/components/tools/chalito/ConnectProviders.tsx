"use client";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { DeviceView } from "@chalito/client";
import type { Provider } from "@chalito/protocol";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { agentOptions, type AgentOption } from "@/lib/chalito/web/providers";
import {
  LOAD_TIMEOUT_MS,
  POLL_FAST_MS,
  POLL_SLOW_MS,
  actionsFor,
  cleanApiKey,
  indexConnections,
  latestAt,
  pendingOutcome,
  signinGate,
  withTimeout,
  type ConnectAction,
  type Pending,
  type ProviderStatus,
  type StatusIndex,
} from "@/lib/chalito/web/connect";

type Load = "loading" | "ok" | "error";
/** Pending commands by `<deviceId>:<provider>`, or `<deviceId>:*` for a status request. */
type PendingMap = Record<string, Pending & { failed?: "timeout" | "send" }>;

const keyOf = (deviceId: string, provider: Provider | "*") => `${deviceId}:${provider}`;

/**
 * "Conecta tus IA": each provider's state on each paired computer (chalito.connections, written by
 * the computer) and signed commands to that computer (provider.connect / install / disconnect /
 * status, @chalito/client ClientActions). An API key is sealed to the computer, never sent in
 * plaintext. Used by onboarding's connect step and by Ajustes. Without a paired computer (or
 * before this browser is paired) it offers the download instead of buttons that can't work.
 */
export const ConnectProviders = ({ agents = agentOptions() }: { agents?: AgentOption[] }) => {
  const t = useTranslations("chalito.connect");
  const ti = useTranslations("chalito.integrations");
  const { client, settings, mesa, status } = useChalito();
  const live = useLive();
  const computers = live.devices.filter((d) => d.role === "agent" && !d.revoked);

  const [rows, setRows] = useState<StatusIndex>({});
  const [load, setLoad] = useState<Load>("loading");
  const [pending, setPending] = useState<PendingMap>({});
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState<{ key: string; text: string; invalid: boolean } | null>(null);
  const [devicesWaited, setDevicesWaited] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const reload = useCallback(async () => {
    if (!settings) return setLoad("error");
    try {
      setRows(indexConnections(await withTimeout(settings.connections(), LOAD_TIMEOUT_MS)));
      setLoad("ok");
    } catch {
      setLoad("error");
    }
  }, [settings]);

  // The live store's devices arrive shortly after connecting; don't wait for them forever.
  useEffect(() => {
    const timer = setTimeout(() => setDevicesWaited(true), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const waiting = Object.values(pending).some((p) => !p.failed);
  // Polls chalito.connections (not part of the live store): quickly while a command waits.
  useEffect(() => {
    if (!client || !settings) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await reload();
      if (alive) timer = setTimeout(() => void tick(), waiting ? POLL_FAST_MS : POLL_SLOW_MS);
    };
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [client, settings, reload, waiting]);

  // A clock only while something waits, for the timeouts.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waiting]);

  // Settle pending commands: answered (a newer report) or timed out.
  useEffect(() => {
    setPending((cur) => {
      let changed = false;
      const next: PendingMap = {};
      for (const [k, p] of Object.entries(cur)) {
        if (p.failed) {
          next[k] = p;
          continue;
        }
        const [deviceId, provider] = k.split(":") as [string, Provider | "*"];
        const byProvider = rows[deviceId] ?? {};
        const at = provider === "*" ? latestAt(Object.values(byProvider)) : latestAt([byProvider[provider]]);
        const o = pendingOutcome(p, at, now);
        if (o === "answered") changed = true;
        else if (o === "timeout") {
          changed = true;
          next[k] = { ...p, failed: "timeout" };
        } else next[k] = p;
      }
      return changed ? next : cur;
    });
  }, [rows, now]);

  const trusted = useCallback((deviceId: string) => !!mesa?.keys.trustedAgentBoxKey(deviceId), [mesa]);

  const send = useCallback(
    async (deviceId: string, provider: Provider | "*", action: ConnectAction | "status", key?: string) => {
      if (!client) return;
      const byProvider = rowsRef.current[deviceId] ?? {};
      const prevAt = provider === "*" ? latestAt(Object.values(byProvider)) : latestAt([byProvider[provider]]);
      const k = keyOf(deviceId, provider);
      setPending((cur) => ({ ...cur, [k]: { action, sentAt: Date.now(), prevAt } }));
      setNow(Date.now());
      try {
        const a = client.actions;
        if (provider === "*" || action === "status") await a.providerStatus(deviceId);
        else if (action === "install") await a.installProvider(deviceId, provider);
        else if (action === "disconnect") await a.disconnectProvider(deviceId, provider);
        else if (action === "signin") await a.connectProvider(deviceId, provider, { method: "signin" });
        else if (key) await a.connectProvider(deviceId, provider, { method: "api_key", key });
      } catch {
        setPending((cur) => ({ ...cur, [k]: { action, sentAt: Date.now(), prevAt, failed: "send" } }));
      }
    },
    [client],
  );

  // A computer that never reported gets asked once, on arrival.
  const asked = useRef(new Set<string>());
  useEffect(() => {
    if (load !== "ok") return;
    for (const c of computers) {
      if (asked.current.has(c.deviceId) || !trusted(c.deviceId) || rows[c.deviceId]) continue;
      asked.current.add(c.deviceId);
      void send(c.deviceId, "*", "status");
    }
  }, [load, computers, rows, trusted, send]);

  const refresh = () => {
    setLoad("loading");
    void reload();
    for (const c of computers) if (trusted(c.deviceId)) void send(c.deviceId, "*", "status");
  };

  const howTo = (
    <ul className="ch-chl-list">
      {agents.map((a) => (
        <li key={a.agent} className="ch-card ch-chl-card">
          <p className="ch-chl-strong">
            {ti(`${a.provider}.name`)} · {ti(`${a.provider}.agent`)}
          </p>
          <p className="ch-chl-small" data-testid={`howto-${a.agent}`}>
            {ti(`${a.provider}.howTo`)}
          </p>
        </li>
      ))}
    </ul>
  );

  if (status === "loading") return <p className="ch-chl-small">{t("loading")}</p>;

  // Not paired here, or no computer yet: the way to get one, not dead buttons.
  const noClient = !client;
  const devicesLoading = !!client && computers.length === 0 && !devicesWaited && live.status !== "live";
  if (devicesLoading) return <p className="ch-chl-small">{t("loading")}</p>;
  if (noClient || computers.length === 0)
    return (
      <div className="ch-chl ch-chl--tight" data-testid="connect-no-computer">
        <p>{noClient ? t("noBrowser") : t("noComputer")}</p>
        <Link href="/descargar" className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit">
          {t("download")}
        </Link>
        {howTo}
      </div>
    );

  return (
    <div className="ch-chl ch-chl--tight" data-testid="connect-providers">
      {load === "error" ? (
        <div role="alert" className="ch-card ch-chl-card ch-chl-card--bad">
          <span>{t("loadError")}</span>
          <button className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit" onClick={() => void reload()}>
            {t("retry")}
          </button>
        </div>
      ) : null}
      <ul className="ch-chl-list">
        {agents.map((a) => (
          <li key={a.agent} className="ch-card ch-chl-card" data-provider={a.provider}>
            <div className="ch-chl-head">
              <p className="ch-chl-strong">
                {ti(`${a.provider}.name`)} · {ti(`${a.provider}.agent`)}
              </p>
              <p className="ch-chl-small" data-testid={`howto-${a.agent}`}>
                {ti(`${a.provider}.howTo`)}
              </p>
            </div>
            {computers.map((c) => (
              <ComputerRow
                key={c.deviceId}
                computer={c}
                showName={computers.length > 1}
                option={a}
                status={rows[c.deviceId]?.[a.provider] ?? null}
                loaded={load !== "loading" || !!rows[c.deviceId]}
                trusted={trusted(c.deviceId)}
                pending={pending[keyOf(c.deviceId, a.provider)] ?? pending[keyOf(c.deviceId, "*")] ?? null}
                form={form?.key === keyOf(c.deviceId, a.provider) ? form : null}
                onForm={(f) => setForm(f ? { key: keyOf(c.deviceId, a.provider), ...f } : null)}
                onAction={(action, key) => void send(c.deviceId, a.provider, action, key)}
              />
            ))}
          </li>
        ))}
      </ul>
      <button className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit" onClick={refresh}>
        {t("refresh")}
      </button>
    </div>
  );
};

const ComputerRow = ({
  computer,
  showName,
  option,
  status,
  loaded,
  trusted,
  pending,
  form,
  onForm,
  onAction,
}: {
  computer: DeviceView;
  showName: boolean;
  option: AgentOption;
  status: ProviderStatus | null;
  loaded: boolean;
  trusted: boolean;
  pending: (Pending & { failed?: "timeout" | "send" }) | null;
  form: { text: string; invalid: boolean } | null;
  onForm: (f: { text: string; invalid: boolean } | null) => void;
  onAction: (a: ConnectAction, key?: string) => void;
}) => {
  const t = useTranslations("chalito.connect");
  const ti = useTranslations("chalito.integrations");
  const name = ti(`${option.provider}.name`);
  const busy = !!pending && !pending.failed;
  const actions = actionsFor(status, option);
  const gate = signinGate(option.subscription);
  const keyId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const key = cleanApiKey(form?.text ?? "");
    if (!key) return onForm({ text: form?.text ?? "", invalid: true });
    onForm(null);
    onAction("api_key", key);
  };

  const label = !loaded ? t("loading") : status ? t(`state.${status.state}`) : t("state.unknown");

  return (
    <div
      className="ch-chl-computer"
      data-device={computer.deviceId}
      data-state={status?.state ?? "unknown"}
    >
      <p>
        {showName ? <span className="ch-chl-strong">{t("computer", { name: computer.name })}: </span> : null}
        <span data-testid="connect-state">{label}</span>
        {status?.state === "connected" && status.mode ? <span> ({t(`via.${status.mode}`)})</span> : null}
        {status?.cli?.version ? (
          <span className="ch-muted"> · {t("version", { version: status.cli.version })}</span>
        ) : null}
      </p>
      {status?.state === "error" && status.error ? (
        <p className="ch-muted">
          {t.has(`errors.${status.error}`) ? t(`errors.${status.error}`) : t("errorDetail", { error: status.error })}
        </p>
      ) : null}
      {status?.state === "blocked_by_policy" ? <p className="ch-chl-warn">{t("blocked", { name })}</p> : null}
      {status?.state === "signing_in" ? <p className="ch-muted">{t("signinNote")}</p> : null}
      {!computer.online ? <p className="ch-muted">{t("offline")}</p> : null}

      {!trusted ? (
        <p className="ch-chl-warn">{t("untrusted")}</p>
      ) : busy ? (
        <p role="status" className="ch-muted">
          {t("waiting")}
        </p>
      ) : form ? (
        <form className="ch-chl ch-chl--tight" onSubmit={submit}>
          <div className={`ch-field${form.invalid ? " ch-field--bad" : ""}`}>
            <label htmlFor={keyId}>{t("keyLabel", { name })}</label>
            <input
              id={keyId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="ch-input"
              placeholder={t("keyPlaceholder")}
              value={form.text}
              onChange={(e) => onForm({ text: e.target.value, invalid: false })}
              aria-invalid={form.invalid}
            />
          </div>
          {form.invalid ? <p className="ch-chl-bad">{t("keyInvalid")}</p> : null}
          <p className="ch-muted">{t("keyNote")}</p>
          <div className="ch-chl-row">
            <button type="submit" className="ch-btn ch-btn--primary ch-btn--compact">
              {t("send")}
            </button>
            <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => onForm(null)}>
              {t("cancel")}
            </button>
          </div>
        </form>
      ) : (
        <>
          {pending?.failed ? (
            <p role="alert" className="ch-chl-bad">
              {pending.failed === "timeout" ? t("timeout") : t("sendError")}
            </p>
          ) : null}
          {actions.length ? (
            <div className="ch-chl-row">
              {actions.map((a) => (
                <button
                  key={a}
                  className={`ch-btn ch-btn--compact ${a === "disconnect" ? "ch-btn--secondary" : "ch-btn--primary"}`}
                  data-action={a}
                  onClick={() => (a === "api_key" ? onForm({ text: "", invalid: false }) : onAction(a))}
                >
                  {t(`actions.${a}`)}
                </button>
              ))}
            </div>
          ) : null}
          {actions.includes("signin") ? <p className="ch-muted">{t("signinNote")}</p> : null}
          {actions.includes("signin") && gate === "owner_only" ? (
            <p className="ch-chl-warn">{ti(`${option.provider}.ownerOnly`)}</p>
          ) : null}
          {actions.includes("install") ? <p className="ch-muted">{t("installNote")}</p> : null}
        </>
      )}
    </div>
  );
};
