"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useLive } from "@/lib/chalito/provider";
import { latestBlock } from "@/lib/chalito/web/coding";
import { RECHARGE_PATH } from "./Credits";

/** The session page's chip when IA de Chalyb stopped a session (chalito ADR 0030): recharge, or use your own key. */
export const CodingBlockedChip = ({ sid }: { sid: string }) => {
  const t = useTranslations("chalito.coding.blocked");
  const live = useLive();
  const reason = latestBlock(live.events[sid] ?? []);
  if (!reason) return null;
  return (
    <div role="status" className="ch-card ch-chl-card ch-chl-row" data-testid="coding-blocked" data-reason={reason}>
      <span>{t(reason)}</span>
      {reason === "out_of_energy" ? (
        <Link href={RECHARGE_PATH} className="ch-btn ch-btn--primary ch-btn--compact">
          {t("recharge")}
        </Link>
      ) : (
        <Link href="/ajustes" className="ch-btn ch-btn--primary ch-btn--compact">
          {t("raise")}
        </Link>
      )}
      <Link href="/ajustes" className="ch-btn ch-btn--secondary ch-btn--compact">
        {t("ownKey")}
      </Link>
    </div>
  );
};
