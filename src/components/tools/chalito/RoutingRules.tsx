"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RouteRules, WorkspaceLabel, type RouteRule } from "@chalito/protocol";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { START_ADAPTERS } from "@/lib/chalito/web/adapters";
import { EMPTY_RULES, addRule, computersOf, moveRule, removeRule } from "@/lib/chalito/web/remote-control";

// ADR 0031 §5: Ajustes → where new sessions run on "Automático". Saved in the owner's settings
// (prefs.routing); a rule only chooses among the owner's computers, each still applies its policy.

export const RoutingRules = () => {
  const t = useTranslations("chalito.routing");
  const { settings } = useChalito();
  const live = useLive();
  const computers = computersOf(live.devices);
  const [rules, setRules] = useState<RouteRules | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "tooMany" | "invalid">("idle");
  // One save at a time: each replaces the whole list, so a second one mustn't start from stale rules.
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ws, setWs] = useState("");
  const [ai, setAi] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (!settings) return;
    let alive = true;
    settings.routing().then(
      (r) => alive && setRules(r ?? EMPTY_RULES),
      // Never edit on top of rules we couldn't read: a save would replace the owner's real ones.
      () => alive && setLoadFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [settings]);
  if (!settings) return null;
  if (loadFailed)
    return (
      <section aria-labelledby="routing-h" className="ch-chl" data-testid="routing-rules">
        <h2 id="routing-h" className="ch-chl-h3">
          {t("title")}
        </h2>
        <p role="alert" className="ch-err">
          {t("loadFailed")}
        </p>
      </section>
    );
  if (!rules) return null;

  const nameOf = (id: string) => computers.find((c) => c.deviceId === id)?.name ?? id.slice(0, 8);
  const aiName = (id: string | undefined) => (id ? (START_ADAPTERS.find((a) => a.appId === id)?.name ?? id) : t("any"));
  const save = async (next: RouteRules): Promise<boolean> => {
    if (saving) return false;
    if (!RouteRules.safeParse(next).success) {
      setStatus("tooMany");
      return false;
    }
    setSaving(true);
    try {
      await settings.saveRouting(next);
      setRules(next);
      setStatus("saved");
      return true;
    } catch {
      setStatus("error");
      return false;
    } finally {
      setSaving(false);
    }
  };
  const add = () => {
    if (!picked.length) return;
    if (ws.trim() && !WorkspaceLabel.safeParse(ws.trim()).success) return setStatus("invalid");
    const rule: RouteRule = {
      ...(ws.trim() ? { workspaceLabel: ws.trim() } : {}),
      ...(ai ? { appId: ai } : {}),
      devices: picked,
    };
    void save(addRule(rules, rule)).then((ok) => {
      if (!ok) return;
      setWs("");
      setAi("");
      setPicked([]);
    });
  };
  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p));

  return (
    <section aria-labelledby="routing-h" className="ch-chl" data-testid="routing-rules">
      <h2 id="routing-h" className="ch-chl-h3">
        {t("title")}
      </h2>
      <p className="ch-muted">{t("body")}</p>
      {status === "saved" ? <p role="status">{t("saved")}</p> : null}
      {status === "error" ? (
        <p role="alert" className="ch-err">
          {t("error")}
        </p>
      ) : null}
      {status === "invalid" ? (
        <p role="alert" className="ch-err">
          {t("invalid")}
        </p>
      ) : null}
      {status === "tooMany" ? (
        <p role="alert" className="ch-err">
          {t("tooMany")}
        </p>
      ) : null}
      {rules.rules.length === 0 ? <p className="ch-chl-small">{t("empty")}</p> : null}
      <ol className="ch-chl ch-chl--tight">
        {rules.rules.map((r, i) => (
          <li key={i} className="ch-chl-row" data-testid="routing-rule">
            <span>
              {t("rule", {
                workspace: r.workspaceLabel ?? t("any"),
                ai: aiName(r.appId),
                computers: r.devices.map(nameOf).join(" → "),
              })}
            </span>
            {i > 0 ? (
              <button
                type="button"
                className="ch-btn ch-btn--gray ch-btn--compact"
                disabled={saving}
                onClick={() => void save(moveRule(rules, i, -1))}
              >
                {t("up")}
              </button>
            ) : null}
            <button
              type="button"
              className="ch-btn ch-btn--danger ch-btn--compact"
              disabled={saving}
              onClick={() => void save(removeRule(rules, i))}
            >
              {t("remove")}
            </button>
          </li>
        ))}
      </ol>
      <fieldset className="ch-chl-fieldset ch-chl ch-chl--tight">
        <div className="ch-field">
          <label htmlFor="routing-ws">{t("workspace")}</label>
          <input
            id="routing-ws"
            className="ch-input"
            maxLength={60}
            value={ws}
            onChange={(e) => setWs(e.target.value)}
          />
        </div>
        <div className="ch-field">
          <label htmlFor="routing-ai">{t("ai")}</label>
          <select id="routing-ai" className="ch-input" value={ai} onChange={(e) => setAi(e.target.value)}>
            <option value="">{t("any")}</option>
            {START_ADAPTERS.map((a) => (
              <option key={a.appId} value={a.appId}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="ch-chl-fieldset ch-chl-row">
          <legend className="ch-chl-strong">
            {t("computers")} <span className="ch-muted ch-chl-small">{t("maxComputers")}</span>
          </legend>
          {computers.map((c) => (
            <label key={c.deviceId} className="ch-chl-check">
              <input
                type="checkbox"
                checked={picked.includes(c.deviceId)}
                disabled={saving || (!picked.includes(c.deviceId) && picked.length >= 3)}
                onChange={() => toggle(c.deviceId)}
              />
              {c.name}
              {picked.includes(c.deviceId) ? ` (${picked.indexOf(c.deviceId) + 1})` : ""}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-chl-fit"
          onClick={add}
          disabled={saving || !picked.length}
        >
          {t("add")}
        </button>
      </fieldset>
      <fieldset className="ch-chl-fieldset">
        <legend className="ch-chl-strong">{t("fallback")}</legend>
        <div className="ch-chl-row">
          {computers.map((c) => {
            const at = rules.fallback.indexOf(c.deviceId);
            return (
              <label key={c.deviceId} className="ch-chl-check">
                <input
                  type="checkbox"
                  checked={at >= 0}
                  disabled={saving || (at < 0 && rules.fallback.length >= 6)}
                  onChange={() =>
                    void save({
                      ...rules,
                      fallback:
                        at >= 0 ? rules.fallback.filter((x) => x !== c.deviceId) : [...rules.fallback, c.deviceId],
                    })
                  }
                />
                {c.name}
                {at >= 0 ? ` (${at + 1})` : ""}
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
};
