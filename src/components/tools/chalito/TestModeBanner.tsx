"use client";
import { useTranslations } from "next-intl";
import { DEV_BACKEND } from "@/lib/chalito/web/env";

/** Visible whenever the dev/test mock backend is on, so a test build can never pass for the real app. */
export const TestModeBanner = () => {
  const t = useTranslations("chalito.live");
  if (!DEV_BACKEND) return null;
  return (
    <div data-testid="test-mode" className="ch-bnr ch-bnr--gray">
      <span className="ch-bnr__tx">{t("testMode")}</span>
    </div>
  );
};
