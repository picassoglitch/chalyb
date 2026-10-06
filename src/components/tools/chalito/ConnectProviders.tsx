"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DeviceView } from "@chalito/client";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { CATALOG, type CatalogApp } from "@/lib/chalito/web/apps-catalog";
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
import { Loading } from "./Loading";

type Load = "loading" | "ok" | "error";
/** Pending commands by `<deviceId>:<appId>`, or `<deviceId>:*` for a status request. */
type PendingMap = Record<string, Pending & { failed?: "timeout" | "send" }>;

const keyOf = (deviceId: string, appId: string) => `${deviceId}:${appId}`;

/** The four apps the integrations copy has a hand-written line for (their old provider names). */
const LEGACY_COPY: Record<string, string> = {
  "claude-code": "anthropic",
  codex: "openai",
  grok: "xai",
  gemini: "google",
};
const GROUPS = ["agent", "desktop", "web"] as const;
/** Onboarding shows the agents first; the rest stays a click away. */
const SEARCH_FROM = 6;

/**
 * "Conecta tus IA": every app of the catalog (coding agents, desktop apps, AI websites) with its
 * state on each paired computer (chalito.connections, written by the computer) and signed
 * commands to that computer (app.connect / install / launch / disconnect / status, @chalito/client
 * ClientActions). An API key is sealed to the computer, never sent in
 * plaintext. Used by onboarding's connect step and by Ajustes. Without a paired computer (or
 * before this browser is paired) it offers the download instead of buttons that can't work.
 */
export const ConnectProviders = ({
  apps = CATALOG,
  compact = false,
}: {
  apps?: readonly CatalogApp[];
  /** Onboarding: agents open, desktop apps and websites folded. */
  compact?: boolean;
}) => {
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
  const [query, setQuery] = useState("");
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
        const [deviceId, appId] = k.split(":") as [string, string];
        const byApp = rows[deviceId] ?? {};
        const at = appId === "*" ? latestAt(Object.values(byApp)) : latestAt([byApp[appId]]);
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
    async (deviceId: string, appId: string, action: ConnectAction | "status", key?: string) => {
      if (!client) return;
      const byApp = rowsRef.current[deviceId] ?? {};
      const prevAt = appId === "*" ? latestAt(Object.values(byApp)) : latestAt([byApp[appId]]);
      const k = keyOf(deviceId, appId);
      setPending((cur) => ({ ...cur, [k]: { action, sentAt: Date.now(), prevAt } }));
      setNow(Date.now());
      try {
        const a = client.actions;
        if (appId === "*" || action === "status") await a.appStatus(deviceId);
        else if (action === "install") await a.installApp(deviceId, appId);
        else if (action === "launch") await a.launchApp(deviceId, appId);
        else if (action === "disconnect") await a.disconnectApp(deviceId, appId);
        else if (action === "signin") await a.connectApp(deviceId, appId, { method: "signin" });
        else if (key) await a.connectApp(deviceId, appId, { method: "api_key", key });
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

  const appLine = (a: CatalogApp) =>
    LEGACY_COPY[a.id]
      ? ti(`${LEGACY_COPY[a.id]}.howTo`)
      : t(`howTo.${a.group}`, { name: a.name, key: a.apiKey?.label ?? "" });
  const q = query.trim().toLowerCase();
  const shown = q ? apps.filter((a) => `${a.name} ${a.vendor} ${a.id}`.toLowerCase().includes(q)) : apps;
  const grouped = GROUPS.map((g) => ({ group: g, apps: shown.filter((a) => a.group === g) })).filter(
    (g) => g.apps.length > 0,
  );
  const sections = (body: (a: CatalogApp) => ReactNode) => (
    <div className="ch-chl">
      {apps.length > SEARCH_FROM ? (
        <input
          type="search"
          className="ch-input"
          placeholder={t("search")}
          aria-label={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}
      {grouped.length === 0 ? <p className="ch-muted">{t("noMatch")}</p> : null}
      {grouped.map(({ group, apps: list }) => (
        <details
          key={group}
          open={!compact || group === "agent" || !!q}
          className="ch-chl-details"
          data-group={group}
        >
          <summary className="ch-chl-strong">
            {t(`groups.${group}`)} ({list.length})
          </summary>
          <ul className="ch-chl-list">{list.map(body)}</ul>
        </details>
      ))}
    </div>
  );

  const howTo = sections((a) => (
    <li key={a.id} className="ch-card ch-chl-card ch-chl-card--sub" data-app={a.id}>
      <p className="ch-chl-strong">{a.name}</p>
      <p className="ch-chl-small" data-testid={`howto-${a.id}`}>
        {appLine(a)}
      </p>
    </li>
  ));

  if (status === "loading") return <Loading label={t("loading")} rows={2} />;

  // Not paired here, or no computer yet: the way to get one, not dead buttons.
  const noClient = !client;
  const devicesLoading = !!client && computers.length === 0 && !devicesWaited && live.status !== "live";
  if (devicesLoading) return <Loading label={t("loading")} rows={2} />;
  if (noClient || computers.length === 0)
    return (
      <div className="ch-chl" data-testid="connect-no-computer">
        <p>{noClient ? t("noBrowser") : t("noComputer")}</p>
        <Link href="/descargar" className="ch-btn ch-btn--primary ch-chl-fit">
          {t("download")}
        </Link>
        {howTo}
      </div>
    );

  return (
    <div className="ch-chl" data-testid="connect-providers">
      {load === "error" ? (
        <div
          role="alert"
          className="ch-card ch-chl-card ch-chl-card--bad ch-chl-row"
        >
          <span>{t("loadError")}</span>
          <button className="ch-btn ch-btn--danger ch-btn--compact" onClick={() => void reload()}>
            {t("retry")}
          </button>
        </div>
      ) : null}
      {sections((a) => (
        <li key={a.id} className="ch-card ch-chl-card ch-chl-card--sub ch-chl-divided" data-app={a.id}>
          <div>
            <p className="ch-chl-strong">{a.name}</p>
            <p className="ch-chl-small" data-testid={`howto-${a.id}`}>
              {appLine(a)}
            </p>
          </div>
          {computers.map((c) => (
            <ComputerRow
              key={c.deviceId}
              computer={c}
              showName={computers.length > 1}
              app={a}
              status={rows[c.deviceId]?.[a.id] ?? null}
              loaded={load !== "loading" || !!rows[c.deviceId]}
              trusted={trusted(c.deviceId)}
              pending={pending[keyOf(c.deviceId, a.id)] ?? pending[keyOf(c.deviceId, "*")] ?? null}
              form={form?.key === keyOf(c.deviceId, a.id) ? form : null}
              onForm={(f) => setForm(f ? { key: keyOf(c.deviceId, a.id), ...f } : null)}
              onAction={(action, key) => void send(c.deviceId, a.id, action, key)}
            />
          ))}
        </li>
      ))}
      <button className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit" onClick={refresh}>
        {t("refresh")}
      </button>
    </div>
  );
};

const ComputerRow = ({
  computer,
  showName,
  app,
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
  app: CatalogApp;
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
  const name = app.name;
  const busy = !!pending && !pending.failed;
  const actions = actionsFor(status, app);
  const gate = signinGate(app.planSignin);
  const legacy = LEGACY_COPY[app.id];

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
      className="ch-chl ch-chl--tight"
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
          <label className="ch-field">
            <span>{t("keyLabel", { name: app.apiKey?.label ?? name })}</span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="ch-input"
              placeholder={t("keyPlaceholder")}
              value={form.text}
              onChange={(e) => onForm({ text: e.target.value, invalid: false })}
              aria-invalid={form.invalid}
            />
          </label>
          {form.invalid ? <p className="ch-err">{t("keyInvalid")}</p> : null}
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
            <p role="alert" className="ch-err">
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
            <p className="ch-chl-warn">{legacy && ti.has(`${legacy}.ownerOnly`) ? ti(`${legacy}.ownerOnly`) : t("ownerOnly")}</p>
          ) : null}
          {actions.includes("launch") ? <p className="ch-muted">{t(`launchNote.${app.group}`)}</p> : null}
          {app.apiKey && actions.includes("api_key") ? (
            <p className="ch-muted">{t("keyWhere", { label: app.apiKey.label, url: app.apiKey.docsUrl })}</p>
          ) : null}
          {actions.includes("install") ? <p className="ch-muted">{t("installNote")}</p> : null}
        </>
      )}
    </div>
  );
};
