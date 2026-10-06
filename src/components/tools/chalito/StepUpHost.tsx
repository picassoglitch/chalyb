"use client";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

type Pending = { risk: string; resolve: (ok: boolean) => void } | null;
let pending: Pending = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Asks the person to confirm a HIGH/CRITICAL approval with their device's step-up. Resolves
 * true on confirm (the caller then runs WebAuthn or the platform biometric), false on cancel.
 */
export const confirmStepUp = (risk: string): Promise<boolean> =>
  new Promise((resolve) => {
    pending?.resolve(false);
    pending = {
      risk,
      resolve: (ok) => {
        pending = null;
        emit();
        resolve(ok);
      },
    };
    emit();
  });

export const StepUpHost = () => {
  const t = useTranslations("chalito.live.stepUp");
  const p = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => pending,
    () => null,
  );
  if (!p) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-title"
      className="ch-chl-scrim"
    >
      <div className="ch-card ch-chl-card ch-chl-modal">
        <h2 id="stepup-title" className="ch-chl-h3">
          {t("title")}
        </h2>
        <p>{t("body", { risk: p.risk })}</p>
        <div className="ch-chl-row ch-chl-row--end">
          <button className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => p.resolve(false)}>
            {t("cancel")}
          </button>
          <button className="ch-btn ch-btn--primary ch-btn--compact" onClick={() => p.resolve(true)}>
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
