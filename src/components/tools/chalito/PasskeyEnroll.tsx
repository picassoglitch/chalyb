"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChalito } from "@/lib/chalito/provider";

/**
 * "Protege tus aprobaciones con tu passkey": HIGH and CRITICAL approvals need this device's passkey
 * (the agent verifies the assertion, D-019). Shown after the first pairing and on /dispositivos.
 */
export const PasskeyEnroll = () => {
  const t = useTranslations("chalito.live.passkey");
  const { passkey } = useChalito();
  const [state, setState] = useState<"idle" | "busy" | "done" | "cancelled" | "replace_refused" | "error">("idle");
  if (!passkey.available) return <p className="ch-muted">{t("afterPairing")}</p>;
  if (passkey.enrolled)
    return (
      <div className="ch-chl ch-chl--tight">
        <p data-testid="passkey-enrolled" className="ch-chl-ok">
          {state === "done" ? t("replaced") : t("enrolled")}
        </p>
        {/* R-M11: changing it asks for the current passkey first. */}
        <button
          data-testid="passkey-replace"
          className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit"
          disabled={state === "busy"}
          onClick={() => {
            setState("busy");
            void passkey.enroll().then((r) => setState(r === "ok" ? "done" : r));
          }}
        >
          {t("replace")}
        </button>
        {state === "cancelled" || state === "replace_refused" || state === "error" ? (
          <p role="alert" data-testid="passkey-replace-error" className="ch-err">
            {t(state === "replace_refused" ? "replaceRefused" : state)}
          </p>
        ) : null}
      </div>
    );
  return (
    <section
      id="passkey"
      data-testid="passkey-enroll"
      className="ch-card ch-chl-card ch-chl-card--ok"
    >
      <h3 className="ch-chl-h3">{t("title")}</h3>
      <p>{t("body")}</p>
      <button
        className="ch-btn ch-btn--primary ch-chl-fit"
        disabled={state === "busy"}
        onClick={() => {
          setState("busy");
          void passkey.enroll().then((r) => setState(r === "ok" ? "idle" : r === "replace_refused" ? "error" : r));
        }}
      >
        {t("create")}
      </button>
      {state === "cancelled" || state === "error" ? (
        <p role="alert" className="ch-err">
          {t(state)}
        </p>
      ) : null}
    </section>
  );
};
