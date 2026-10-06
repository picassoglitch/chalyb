"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { Activate, ActivationDone } from "./Activate";
import { Recover } from "./Recover";

/**
 * Live screens need a signed-in, paired, connected device; otherwise say what's missing. Inside
 * the hub the sign-in itself is HubBridge's (the layout), so there is no sign-in button here.
 */
export const LiveGate = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("chalito.live.gate");
  const { status, newDevice, activate, canActivate, recover, needsRecovery, activation } = useChalito();
  const live = useLive();
  // Revoked: at sign-in (the api refused the device) or while connected (the live store saw it).
  // The provider has already forgotten the agents this browser trusted.
  if (status === "revoked" || (status === "ready" && live.status === "revoked"))
    return (
      <div role="alert" data-testid="gate-revoked" className="grid gap-3 rounded-lg bg-red-50 p-4 text-red-900">
        <p>{t("revoked")}</p>
        <Link href="/vincular" className="w-fit rounded-lg border border-red-800 px-4 py-2">
          {t("repair")}
        </Link>
      </div>
    );
  // Just activated: the recovery code comes first, whatever the connection is doing.
  if (activation) return <ActivationDone />;
  if (status === "ready") return <>{children}</>;
  if (status === "loading") return <p aria-live="polite">{t("loading")}</p>;
  // No trusted client on the account yet: one tap instead of a second device (tester item #1).
  if (status === "unpaired" && activate && canActivate) return <Activate />;
  // No trusted client but a paired computer: computers count, so the recovery code instead.
  if (status === "unpaired" && recover && needsRecovery) return <Recover />;
  return (
    <div className="grid gap-3 rounded-lg border p-4" data-testid={`gate-${status}`}>
      <p>{t(status)}</p>
      {status === "unpaired" && newDevice ? (
        <Link href="/vincular" data-testid="gate-link" className="w-fit rounded-lg bg-emerald-700 px-4 py-2 text-white">
          {t("link")}
        </Link>
      ) : null}
    </div>
  );
};
