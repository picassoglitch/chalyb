"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";

/**
 * Live screens need a signed-in, paired, connected device; otherwise say what's missing. Inside
 * the hub the sign-in itself is HubBridge's (the layout), so there is no sign-in button here.
 */
export const LiveGate = ({ children }: { children: ReactNode }) => {
  const t = useTranslations("chalito.live.gate");
  const { status, newDevice } = useChalito();
  const live = useLive();
  // Revoked: at sign-in (the api refused the device) or while connected (the live store saw it).
  // The provider has already forgotten the agents this browser trusted.
  if (status === "revoked" || (status === "ready" && live.status === "revoked"))
    return (
      <div role="alert" data-testid="gate-revoked" className="ch-card ch-chl-card ch-chl-card--bad">
        <p>{t("revoked")}</p>
        <Link href="/vincular" className="ch-btn ch-btn--danger ch-chl-fit">
          {t("repair")}
        </Link>
      </div>
    );
  if (status === "ready") return <>{children}</>;
  if (status === "loading")
    return (
      <p aria-live="polite" className="ch-muted">
        {t("loading")}
      </p>
    );
  return (
    <div className="ch-card ch-chl-card" data-testid={`gate-${status}`}>
      <p>{t(status)}</p>
      {status === "unpaired" && newDevice ? (
        <Link href="/vincular" data-testid="gate-link" className="ch-btn ch-btn--primary ch-chl-fit">
          {t("link")}
        </Link>
      ) : null}
    </div>
  );
};
