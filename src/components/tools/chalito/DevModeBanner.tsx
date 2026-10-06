"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/chalito/navigation";
import { useLive } from "@/lib/chalito/provider";

/** "Modo desarrollador ACTIVO" on every screen while any of the owner's devices has it on. */
export const DevModeBanner = () => {
  const t = useTranslations("chalito.live.devMode");
  const { devModeActive } = useLive();
  if (!devModeActive) return null;
  return (
    <div
      role="status"
      data-testid="devmode-banner"
      className="ch-bnr ch-bnr--bad"
    >
      <span className="ch-bnr__tx">
        {t("banner")}{" "}
        <Link href="/dispositivos" className="ch-lnk">
          {t("manage")}
        </Link>
      </span>
    </div>
  );
};
