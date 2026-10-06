"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { safeOAuthRedirect, type ConsentRequest } from "@/lib/chalito/web/mcp";
import { signInAndReturn } from "@/lib/chalito/web/next-cookie";
import { useSession } from "@/lib/chalito/web/session";
import { useChalito } from "@/lib/chalito/provider";

/**
 * /oauth/consent?request=<id>: a connected app (Claude, ChatGPT) asks for access to the MCP gateway.
 * Shows who is asking and where the browser goes next; session:prompt is never pre-checked.
 * Approving needs this device's passkey; denying doesn't.
 */
export const OAuthConsent = () => {
  const t = useTranslations("chalito.mcp.consent");
  const locale = useLocale() as "es" | "en";
  const session = useSession();
  const { status, mcp, passkey, assertPasskey } = useChalito();
  const [req, setReq] = useState<ConsentRequest | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<"loading" | "ready" | "busy" | "missing" | "gone" | "error">("loading");
  const [note, setNote] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const id = new URL(window.location.href).searchParams.get("request");
    if (!id) return void setState("missing");
    if (status === "signed_out" && session.status === "signed_out") {
      started.current = true;
      return signInAndReturn(window.location.pathname + window.location.search);
    }
    if (!mcp) return;
    started.current = true;
    void mcp.getRequest(id).then((r) => {
      if (typeof r === "string") return setState(r === "not_found" ? "gone" : "error");
      setReq(r);
      setChecked(Object.fromEntries(r.scopes.map((s) => [s.scope, s.defaultChecked])));
      setState("ready");
    });
  }, [status, session.status, mcp]);

  const go = (redirect: string) => {
    const u = safeOAuthRedirect(redirect);
    if (u) window.location.assign(u);
    else setNote(t("badRedirect"));
  };
  const approve = async () => {
    if (!req || !mcp || !assertPasskey) return;
    setState("busy");
    setNote(null);
    try {
      const assertion = await assertPasskey();
      const r = await mcp.approve(
        req.requestId,
        Object.keys(checked).filter((k) => checked[k]),
        assertion,
      );
      if (typeof r === "string") {
        setState("ready");
        return setNote(t(`error.${r}`));
      }
      go(r.redirect);
    } catch {
      setState("ready");
      setNote(t("error.passkey_failed"));
    }
  };
  const deny = async () => {
    if (!req || !mcp) return;
    setState("busy");
    const r = await mcp.deny(req.requestId);
    if (typeof r === "string") {
      setState("ready");
      return setNote(t(`error.${r}`));
    }
    go(r.redirect);
  };

  if (state === "missing" || state === "gone" || state === "error")
    return (
      <p role="alert" className="ch-card ch-chl-card ch-chl-card--bad">
        {t(state)}
      </p>
    );
  if (!req) return <p aria-live="polite">{t("loading")}</p>;
  const selected = Object.values(checked).some(Boolean);
  const canApprove = status === "ready" && passkey.enrolled;
  return (
    <div className="ch-chl" data-testid="consent">
      <header className="ch-chl-head">
        <h2 className="ch-h2">{t("title", { client: req.client.name })}</h2>
        <p className="ch-sub">
          {t("redirect")} <strong data-testid="redirect-host">{req.client.redirectHost}</strong>
        </p>
      </header>
      <fieldset className="ch-card ch-chl-card ch-chl-fieldset">
        <legend className="ch-chl-strong">{t("scopes")}</legend>
        {req.scopes.map((s) => (
          <label
            key={s.scope}
            data-scope={s.scope}
            className={`ch-chl-check${s.scope === "session:prompt" ? " ch-chl-check--warn" : ""}`}
          >
            <input
              type="checkbox"
              checked={!!checked[s.scope]}
              onChange={(e) => setChecked({ ...checked, [s.scope]: e.target.checked })}
            />
            <span>{s[locale]}</span>
          </label>
        ))}
      </fieldset>
      {status !== "ready" ? <p className="ch-chl-warn">{t("needsDevice")}</p> : null}
      {status === "ready" && !passkey.enrolled ? (
        <p data-testid="consent-needs-passkey" className="ch-chl-warn">
          {t("needsPasskey")}{" "}
          <Link href="/dispositivos" className="ch-lnk">
            {t("enrolPasskey")}
          </Link>
        </p>
      ) : null}
      <div className="ch-chl-row">
        <button
          className="ch-btn ch-btn--primary"
          disabled={state === "busy" || !selected || !canApprove}
          onClick={() => void approve()}
        >
          {t("approve")}
        </button>
        <button
          className="ch-btn ch-btn--secondary"
          disabled={state === "busy"}
          onClick={() => void deny()}
        >
          {t("deny")}
        </button>
      </div>
      {note ? (
        <p role="alert" className="ch-err">
          {note}
        </p>
      ) : null}
    </div>
  );
};
