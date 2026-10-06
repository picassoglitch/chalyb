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
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
    >
      <div className="grid max-w-sm gap-3 rounded-xl bg-white p-5 shadow-xl">
        <h2 id="stepup-title" className="text-lg font-semibold">
          {cc ? t("computer.title") : t("title")}
        </h2>
        {cc ? (
          <div className="grid gap-2" data-testid="stepup-computer">
            <p>{t("computer.body", { computer: p.computer ?? "" })}</p>
            <p>{t("computer.stop")}</p>
            <p className="text-sm text-neutral-700">{t("computer.passkey")}</p>
          </div>
        ) : (
          <p>{t("body", { risk: p.risk })}</p>
        )}
        <div className="flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2" onClick={() => p.resolve(false)}>
            {t("cancel")}
          </button>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white" onClick={() => p.resolve(true)}>
            {cc ? t("computer.confirm") : t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};
