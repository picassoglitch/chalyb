"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChalito } from "@/lib/chalito/provider";

// ADR 0032 — signing in is the approval: one tap, no code and no second device.
export const ApproveBrowser = () => {
  const t = useTranslations("chalito.live.gate.approve");
  const { approveThisBrowser, signInBlocked } = useChalito();
  const [busy, setBusy] = useState(false);
  if (!approveThisBrowser) return null;
  const reason = signInBlocked && signInBlocked !== "unsupported" ? signInBlocked : null;
  return (
    <section className="ch-card ch-chl-card" data-testid="approve-browser" data-reason={reason ?? ""}>
      <h2 className="ch-h2">{t("title")}</h2>
      <p>{t("body")}</p>
      {reason ? (
        <p role="alert" data-testid="approve-browser-reason" className={reason === "revoked" ? "ch-chl-warn" : "ch-err"}>
          {t(`reason.${reason}`)}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="approve-browser-button"
        className="ch-btn ch-btn--primary ch-chl-fit"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          approveThisBrowser();
        }}
      >
        {t("cta")}
      </button>
    </section>
  );
};
