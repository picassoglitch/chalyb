"use client";
import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

/** What the step-up is for: `computer_control` gets its own copy (the AI takes over a computer). */
export interface StepUpContext {
  kind?: "tool" | "computer_control";
  /** The computer's name, for computer_control. */
  computer?: string;
}

type Pending = ({ risk: string; resolve: (ok: boolean) => void } & StepUpContext) | null;
let pending: Pending = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/**
 * Asks the person to confirm a HIGH/CRITICAL approval with their device's step-up. Resolves
 * true on confirm (the caller then runs WebAuthn or the platform biometric), false on cancel.
 */
export const confirmStepUp = (risk: string, ctx: StepUpContext = {}): Promise<boolean> =>
  new Promise((resolve) => {
    pending?.resolve(false);
    pending = {
      risk,
      ...ctx,
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
  const cc = p.kind === "computer_control";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stepup-title"
      className="ch-chl-scrim"
    >
      <div className="ch-card ch-chl-card ch-chl-modal">
        <h2 id="stepup-title" className="ch-chl-h3">
          {cc ? t("computer.title") : t("title")}
        </h2>
        {cc ? (
          <div className="ch-chl ch-chl--tight" data-testid="stepup-computer">
            <p>{t("computer.body", { computer: p.computer ?? "" })}</p>
            <p>{t("computer.stop")}</p>
            <p className="ch-chl-small">{t("computer.passkey")}</p>
          </div>
        ) : (
          <p>{t("body", { risk: p.risk })}</p>
        )}
        <div className="ch-chl-row ch-chl-row--end">
          <button className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => p.resolve(false)}>
            {t("cancel")}
          </button>
          <button className="ch-btn ch-btn--primary ch-btn--compact" onClick={() => p.resolve(true)}>
            {cc ? t("computer.confirm") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
