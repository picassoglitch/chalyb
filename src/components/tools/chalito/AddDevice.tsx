"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EndorseTarget } from "@chalito/client-keys";
import { Link } from "@/lib/chalito/navigation";
import type { AddError } from "@/lib/chalito/web/endorse";
import { useChalito, useNow } from "@/lib/chalito/provider";
import { GlyphScanner } from "./Glyph";

type Step =
  | { s: "input" }
  | { s: "scanning" }
  | { s: "busy" }
  | { s: "confirm"; target: EndorseTarget; at: number }
  | { s: "approving"; target: EndorseTarget; at: number }
  | { s: "done"; name: string };

/**
 * "Añadir un dispositivo" (/dispositivos/nuevo): this trusted browser vouches for a new one. The
 * person types the short code (or scans the ring), compares the fingerprint shown on both screens,
 * and approves; with a passkey on this device, the approval asks for it.
 */
export const AddDevice = () => {
  const t = useTranslations("chalito.endorse.add");
  const { addDevice, passkey } = useChalito();
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>({ s: "input" });
  const [error, setError] = useState<AddError | null>(null);
  const now = useNow();

  if (!addDevice) return null;

  const resolve = async (input: { glyph: unknown } | { shortCode: string }) => {
    setError(null);
    setStep({ s: "busy" });
    const r = await addDevice.resolve(input);
    if (!r.ok) {
      setError(r.reason);
      return setStep({ s: "input" });
    }
    setStep({ s: "confirm", target: r.target, at: Date.now() });
  };

  const approve = async (target: EndorseTarget, at: number) => {
    setError(null);
    setStep({ s: "approving", target, at });
    const r = await addDevice.approve(target);
    if (!r.ok) {
      setError(r.reason);
      // A refused step-up can be retried on the same code; anything else starts over.
      return setStep(r.reason === "step_up" ? { s: "confirm", target, at } : { s: "input" });
    }
    setStep({ s: "done", name: target.display.name });
  };

  const errorLine = error ? (
    <p role="alert" data-testid="add-error" data-reason={error} className="ch-err">
      {t(`error.${error}`)}
    </p>
  ) : null;

  if (step.s === "done")
    return (
      <div className="ch-chl ch-chl--tight" data-testid="add-done">
        <h2 className="ch-h2">{t("title")}</h2>
        <p role="status">{t("done", { name: step.name })}</p>
        <Link href="/dispositivos" className="ch-btn ch-btn--secondary ch-chl-fit">
          {t("back")}
        </Link>
      </div>
    );

  if (step.s === "confirm" || step.s === "approving") {
    const d = step.target.display;
    const left = Math.max(0, Math.ceil((d.expiresInMs - (now - step.at)) / 1000));
    return (
      <div className="ch-chl" data-testid="add-confirm">
        <h2 className="ch-h2">{t("title")}</h2>
        <div className="ch-card ch-chl-card">
          <p className="ch-chl-strong" data-testid="add-name">
            {d.name}
          </p>
          <p className="ch-chl-small">{t(`kind.${d.kind === "phone" ? "phone" : "web"}`)}</p>
          <p>{t("compare")}</p>
          <p data-testid="add-fingerprint" className="ch-chl-code">
            {d.fingerprint}
          </p>
          <p className="ch-chl-small">
            {t("expiresIn", { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, "0") })}
          </p>
        </div>
        <p className="ch-muted">{passkey.enrolled ? t("withPasskey") : t("withoutPasskey")}</p>
        <div className="ch-chl-row">
          <button
            data-testid="add-approve"
            className="ch-btn ch-btn--primary"
            disabled={step.s === "approving" || left === 0}
            onClick={() => void approve(step.target, step.at)}
          >
            {t("approve")}
          </button>
          <button
            className="ch-btn ch-btn--secondary"
            disabled={step.s === "approving"}
            onClick={() => {
              setError(null);
              setStep({ s: "input" });
            }}
          >
            {t("notMine")}
          </button>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="ch-chl" data-testid="add-input">
      <h2 className="ch-h2">{t("title")}</h2>
      <p className="ch-sub">{t("body")}</p>
      <form
        className="ch-chl-row ch-chl-row--bottom"
        onSubmit={(e) => {
          e.preventDefault();
          void resolve({ shortCode: code });
        }}
      >
        <div className="ch-field">
          <label htmlFor="add-code">{t("codeLabel")}</label>
          <input
            id="add-code"
            data-testid="add-code"
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
          data-testid="add-find"
          className="ch-btn ch-btn--primary"
          disabled={step.s === "busy" || code.trim().length < 8}
        >
          {t("find")}
        </button>
      </form>
      {step.s === "scanning" ? (
        <GlyphScanner
          onPayload={(glyph) => void resolve({ glyph })}
          labels={{
            starting: t("scan.starting"),
            scanning: t("scan.scanning"),
            denied: t("scan.denied"),
            unavailable: t("scan.unavailable"),
          }}
        />
      ) : (
        <button
          data-testid="add-scan"
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
