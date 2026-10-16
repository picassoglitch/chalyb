"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useNow } from "@/lib/chalito/provider";
import {
  clearHandoff,
  handoffCodeId,
  type ApproveError,
  type ComputerTarget,
} from "@/lib/chalito/web/approve-computer";
import { GlyphScanner } from "./Glyph";

type Step =
  | { s: "start" }
  | { s: "input" }
  | { s: "scanning" }
  | { s: "busy" }
  | { s: "confirm"; target: ComputerTarget; at: number }
  | { s: "approving"; target: ComputerTarget; at: number }
  | { s: "done"; name: string; fingerprint: string }
  | { s: "declined" };

const OS: Record<string, string> = { macos: "macOS", windows: "Windows", linux: "Linux" };

const session = (): Pick<Storage, "getItem" | "setItem" | "removeItem"> | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * "Aprobar computadora" (/computadoras/aprobar, ADR 0028 §3–§4). Opened by the desktop app with
 * `#c=<codeId>`, or with no link: type the short code shown on the computer, or scan its glyph
 * from a phone. Same network: one tap. Another network: a plain warning, the short code typed
 * from the computer (the api refuses the claim without it), and a prominent decline.
 */
export const ApproveComputer = () => {
  const t = useTranslations("chalito.approveComputer");
  const { approveComputer, passkey } = useChalito();
  const [step, setStep] = useState<Step>({ s: "start" });
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<ApproveError | null>(null);
  const now = useNow();

  // The link's code id: from the fragment, or from before a sign-in redirect dropped it.
  useEffect(() => {
    if (!approveComputer || step.s !== "start") return;
    const store = session();
    const codeId = store ? handoffCodeId(store, window.location.hash, Date.now()) : null;
    if (!codeId) return setStep({ s: "input" });
    setStep({ s: "busy" });
    void approveComputer.findByLink(codeId).then((r) => {
      if (!r.ok) {
        setError(r.reason);
        return setStep({ s: "input" });
      }
      setStep({ s: "confirm", target: r.target, at: Date.now() });
    });
  }, [approveComputer, step.s]);

  if (!approveComputer) return null;

  const find = async (input: { shortCode: string } | { glyph: unknown }) => {
    setError(null);
    setStep({ s: "busy" });
    let r;
    if ("shortCode" in input) {
      r = await approveComputer.findByCode(input.shortCode);
      // Typing the code here is already the proof the api wants from another network.
      if (r.ok) setTyped(input.shortCode);
    } else {
      const g = input.glyph as { body?: { codeId?: unknown } } | null;
      r =
        typeof g?.body?.codeId === "string"
          ? await approveComputer.findByLink(g.body.codeId)
          : ({ ok: false, reason: "invalid_code" } as const);
    }
    if (!r.ok) {
      setError(r.reason);
      return setStep({ s: "input" });
    }
    setStep({ s: "confirm", target: r.target, at: Date.now() });
  };

  const approve = async (target: ComputerTarget, at: number) => {
    setError(null);
    setStep({ s: "approving", target, at });
    const needsCode = target.view.approval === "code_required";
    const r = await approveComputer.approve(target, needsCode ? typed : undefined);
    if (!r.ok) {
      setError(r.reason);
      return setStep(
        ["step_up", "wrong_code", "code_required"].includes(r.reason) ? { s: "confirm", target, at } : { s: "input" },
      );
    }
    const store = session();
    if (store) clearHandoff(store);
    setStep({ s: "done", name: r.name, fingerprint: await approveComputer.fingerprint() });
  };

  const decline = async (target: ComputerTarget) => {
    setError(null);
    const r = await approveComputer.decline(target.codeId);
    if (r !== "ok") return setError("failed");
    const store = session();
    if (store) clearHandoff(store);
    setStep({ s: "declined" });
  };

  const errorLine = error ? (
    <p role="alert" data-testid="approve-error" data-reason={error} className="ch-err">
      {t(`error.${error}`)}
    </p>
  ) : null;

  if (step.s === "done")
    return (
      <div className="ch-chl" data-testid="approve-done">
        <h2 className="ch-h2">{t("title")}</h2>
        <p role="status">{t("done", { name: step.name })}</p>
        <p>{t("doneReverse")}</p>
        <p data-testid="approve-my-fingerprint" className="ch-chl-code">
          {step.fingerprint}
        </p>
        <Link href="/dispositivos" className="ch-btn ch-btn--secondary ch-chl-fit">
          {t("back")}
        </Link>
      </div>
    );

  if (step.s === "declined")
    return (
      <div className="ch-chl ch-chl--tight" data-testid="approve-declined">
        <h2 className="ch-h2">{t("title")}</h2>
        <p role="status">{t("declined")}</p>
        <Link href="/dispositivos" className="ch-btn ch-btn--secondary ch-chl-fit">
          {t("back")}
        </Link>
      </div>
    );

  if (step.s === "confirm" || step.s === "approving") {
    const { display, view } = step.target;
    const left = Math.max(0, Math.ceil((display.expiresInMs - (now - step.at)) / 1000));
    const other = view.approval !== "one_tap";
    const blocked = view.approval === "blocked";
    const busy = step.s === "approving";
    return (
      <div className="ch-chl" data-testid="approve-confirm" data-approval={view.approval}>
        <h2 className="ch-h2">{t("title")}</h2>
        {other ? (
          <div role="alert" data-testid="approve-other-network" className="ch-card ch-chl-card ch-chl-card--bad">
            <p className="ch-chl-strong">{view.city ? t("otherNetworkCity", { city: view.city }) : t("otherNetwork")}</p>
            <p>{t("phishing")}</p>
          </div>
        ) : null}
        <div className="ch-card ch-chl-card">
          <p className="ch-chl-strong" data-testid="approve-name">
            {display.label}
          </p>
          <p className="ch-chl-small">{OS[view.platform] ?? view.platform}</p>
          <p>{t("compare")}</p>
          <p data-testid="approve-fingerprint" className="ch-chl-code">
            {display.fingerprint}
          </p>
          <p className="ch-chl-small">
            {t("expiresIn", { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, "0") })}
          </p>
        </div>
        {other && !blocked ? (
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
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        {!blocked ? (
          <p className="ch-muted">{passkey.enrolled ? t("withPasskey") : t("withoutPasskey")}</p>
        ) : null}
        <div className="ch-chl-row">
          <button
            data-testid="approve-decline"
            className={other ? "ch-btn ch-btn--danger" : "ch-btn ch-btn--secondary"}
            disabled={busy}
            onClick={() => void decline(step.target)}
          >
            {t("notInFront")}
          </button>
          {!blocked ? (
            <button
              data-testid="approve-approve"
              className={other ? "ch-btn ch-btn--secondary" : "ch-btn ch-btn--primary"}
              disabled={busy || left === 0 || (other && typed.trim().length < 8)}
              onClick={() => void approve(step.target, step.at)}
            >
              {t("approve")}
            </button>
          ) : null}
        </div>
        {errorLine}
      </div>
    );
  }

  if (step.s === "start" || (step.s === "busy" && !code))
    return (
      <p aria-busy="true" className="ch-muted" data-testid="approve-loading">
        {t("loading")}
      </p>
    );

  return (
    <div className="ch-chl" data-testid="approve-input">
      <h2 className="ch-h2">{t("title")}</h2>
      <p className="ch-sub">{t("body")}</p>
      <form
        className="ch-chl-row ch-chl-row--bottom"
        onSubmit={(e) => {
          e.preventDefault();
          void find({ shortCode: code });
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
          disabled={step.s === "busy" || code.trim().length < 8}
        >
          {t("find")}
        </button>
      </form>
      {step.s === "scanning" ? (
        <GlyphScanner
          onPayload={(glyph) => void find({ glyph })}
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
          disabled={step.s === "busy"}
          onClick={() => setStep({ s: "scanning" })}
        >
          {t("scan.start")}
        </button>
      )}
      {errorLine}
    </div>
  );
};
