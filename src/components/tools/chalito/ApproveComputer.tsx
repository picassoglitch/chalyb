"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useNow } from "@/lib/chalito/provider";
import { ApproveFlow, askLoopback, type Store } from "@/lib/chalito/web/approve-computer";
import { GlyphScanner } from "./Glyph";

const OS: Record<string, string> = { macos: "macOS", windows: "Windows", linux: "Linux" };

const session = (): Store | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * "Aprobar computadora" (/computadoras/aprobar, ADR 0028 §3–§4, decision #52). Opened by the
 * desktop app with `#c=<codeId>&p=<port>`, or with no link: type the short code shown on the
 * computer, or scan its colour code from a phone. One tap only when the agent on this computer
 * proves it's here (loopback); otherwise a plain warning, the short code typed from the computer
 * (the api refuses the claim without it), and a prominent decline. The logic is ApproveFlow
 * (approve-computer.ts); this only renders it.
 */
export const ApproveComputer = () => {
  const t = useTranslations("chalito.approveComputer");
  const { approveComputer, passkey } = useChalito();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const now = useNow();

  const flow = useMemo(
    () =>
      approveComputer
        ? new ApproveFlow({
            api: approveComputer,
            store: session(),
            location: window.location,
            history: window.history,
            loopback: (h, nonce) => askLoopback(window.fetch.bind(window), h, nonce),
            now: Date.now,
          })
        : null,
    [approveComputer],
  );
  const view = useSyncExternalStore(
    (fn) => flow?.subscribe(fn) ?? (() => undefined),
    () => flow?.view ?? { s: "loading" as const },
    () => ({ s: "loading" as const }),
  );
  useEffect(() => {
    void flow?.start();
  }, [flow]);

  if (!flow) return null;

  const errorLine = (error: string | null) =>
    error ? (
      <p role="alert" data-testid="approve-error" data-reason={error} className="ch-err">
        {t(`error.${error}`)}
      </p>
    ) : null;

  if (view.s === "loading")
    return (
      <p aria-busy="true" className="ch-muted" data-testid="approve-loading">
        {t("loading")}
      </p>
    );

  if (view.s === "done")
    return (
      <div className="ch-chl" data-testid="approve-done" data-trusted={view.trusted}>
        <h2 className="ch-h2">{t("title")}</h2>
        <p role="status">{view.trusted ? t("done", { name: view.name }) : t("doneFinish", { name: view.name })}</p>
        <p>{t("doneReverse")}</p>
        <p data-testid="approve-my-fingerprint" className="ch-chl-code">
          {view.fingerprint}
        </p>
        <Link href="/dispositivos" className="ch-btn ch-btn--secondary ch-chl-fit">
          {t("back")}
        </Link>
      </div>
    );

  if (view.s === "declined")
    return (
      <div className="ch-chl ch-chl--tight" data-testid="approve-declined">
        <h2 className="ch-h2">{t("title")}</h2>
        <p role="status">{t("declined")}</p>
        <Link href="/dispositivos" className="ch-btn ch-btn--secondary ch-chl-fit">
          {t("back")}
        </Link>
      </div>
    );

  if (view.s === "confirm") {
    const { display, view: v } = view.target;
    const left = Math.max(0, Math.ceil((v.expiresAt - now) / 1000));
    return (
      <div
        className="ch-chl"
        data-testid="approve-confirm"
        data-same-computer={view.sameComputer}
        data-warn={view.warn}
        data-blocked={view.blocked}
      >
        <h2 className="ch-h2">{t("title")}</h2>
        {view.sameComputer ? (
          <p role="status" data-testid="approve-same-computer" className="ch-muted">
            {t("sameComputer")}
          </p>
        ) : null}
        {view.warn ? (
          <div role="alert" data-testid="approve-warning" className="ch-card ch-chl-card ch-chl-card--bad">
            <p className="ch-chl-strong">
              {v.network === "different"
                ? v.city
                  ? t("otherNetworkCity", { city: v.city })
                  : t("otherNetwork")
                : t("notProven")}
            </p>
            <p>{t("phishing")}</p>
          </div>
        ) : null}
        <div className="ch-card ch-chl-card">
          <p className="ch-chl-strong" data-testid="approve-name">
            {display.label}
          </p>
          <p className="ch-chl-small">{OS[v.platform] ?? v.platform}</p>
          <p>{t("compare")}</p>
          <p data-testid="approve-fingerprint" className="ch-chl-code">
            {display.fingerprint}
          </p>
          <p className="ch-chl-small" data-testid="approve-expires">
            {left === 0
              ? t("error.expired")
              : t("expiresIn", { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, "0") })}
          </p>
        </div>
        {view.needsCode ? (
          <div className="ch-field">
            <label htmlFor="approve-typed">{t("typeCode")}</label>
            <input
              id="approve-typed"
              data-testid="approve-typed"
              className="ch-input ch-chl-codeinput"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={12}
              placeholder="XXXX-XXXX"
              value={view.typed}
              onChange={(e) => flow.setTyped(e.target.value)}
            />
          </div>
        ) : null}
        {!view.blocked ? (
          <p className="ch-muted">{passkey.enrolled ? t("withPasskey") : t("withoutPasskey")}</p>
        ) : null}
        <div className="ch-chl-row">
          <button
            data-testid="approve-decline"
            className={view.warn ? "ch-btn ch-btn--danger" : "ch-btn ch-btn--secondary"}
            disabled={view.busy}
            onClick={() => void flow.decline()}
          >
            {t("notInFront")}
          </button>
          {!view.blocked ? (
            <button
              data-testid="approve-approve"
              className={view.warn ? "ch-btn ch-btn--secondary" : "ch-btn ch-btn--primary"}
              disabled={view.busy || left === 0 || (view.needsCode && view.typed.trim().length < 8)}
              onClick={() => void flow.approve()}
            >
              {t("approve")}
            </button>
          ) : null}
        </div>
        {errorLine(view.error)}
      </div>
    );
  }

  return (
    <div className="ch-chl" data-testid="approve-input">
      <h2 className="ch-h2">{t("title")}</h2>
      <p className="ch-sub">{t("body")}</p>
      <form
        className="ch-chl-row ch-chl-row--bottom"
        onSubmit={(e) => {
          e.preventDefault();
          void flow.findCode(code);
        }}
      >
        <div className="ch-field">
          <label htmlFor="approve-code">{t("codeLabel")}</label>
          <input
            id="approve-code"
            data-testid="approve-code"
            className="ch-input ch-chl-codeinput"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            placeholder="XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button
          data-testid="approve-find"
          className="ch-btn ch-btn--primary"
          disabled={view.busy || code.trim().length < 8}
        >
          {t("find")}
        </button>
      </form>
      {scanning ? (
        <GlyphScanner
          onPayload={(glyph) => {
            setScanning(false);
            void flow.findGlyph(glyph);
          }}
          labels={{
            starting: t("scan.starting"),
            scanning: t("scan.scanning"),
            denied: t("scan.denied"),
            unavailable: t("scan.unavailable"),
          }}
        />
      ) : (
        <button
          data-testid="approve-scan"
          className="ch-btn ch-btn--secondary ch-chl-fit"
          disabled={view.busy}
          onClick={() => setScanning(true)}
        >
          {t("scan.start")}
        </button>
      )}
      {errorLine(view.error)}
    </div>
  );
};
