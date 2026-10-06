"use client";
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Balance } from "@/lib/chalito/web/balance";
import { Link } from "@/lib/chalito/navigation";
import { useChalito } from "@/lib/chalito/provider";

/** The Chalyb tiers this page can name (packages/config plans.yaml hubTiers). */
const HUB_TIERS = new Set(["free", "pro", "vip"]);

/** Where credits are bought: the hub's own usage page (token packs). Prices only ever live there. */
export const RECHARGE_PATH = "/app/usage";

/**
 * /creditos: where the store's "no tokens" chip and budget notifications land. The plan, the hub
 * balance in tokens (/v1/billing/balance), how Chalito spends tokens, and the way to recharge on
 * Chalyb. Tokens only: no prices or currency here.
 */
const BalanceCard = () => {
  const t = useTranslations("chalito.credits.balance");
  const format = useFormatter();
  const { balance } = useChalito();
  const [b, setB] = useState<Balance | "loading" | "unavailable" | "error">("loading");
  useEffect(() => {
    if (!balance) return;
    let alive = true;
    void balance().then((r) => alive && setB(r));
    return () => {
      alive = false;
    };
  }, [balance]);
  if (!balance) return null;
  const n = (v: number) => format.number(v);
  return (
    <section className="ch-card ch-chl-card" data-testid="credits-balance">
      <h3 className="ch-ghead">{t("title")}</h3>
      {b === "loading" ? (
        <p aria-live="polite">{t("loading")}</p>
      ) : b === "unavailable" || b === "error" ? (
        <p role="alert" data-testid="balance-error">
          {t(b)}
        </p>
      ) : b.unlimited ? (
        <p data-testid="balance-remaining" className="ch-kpi__v">
          {t("unlimited")}
        </p>
      ) : (
        <>
          <p data-testid="balance-remaining" className="ch-kpi__v">
            {t("remaining", { tokens: n(b.remaining) })}
          </p>
          <dl className="ch-chl-dl">
            <dt className="ch-muted">{t("monthly")}</dt>
            <dd data-testid="balance-monthly">{t("tokens", { tokens: n(b.monthlyAllocation) })}</dd>
            {b.bonus > 0 ? (
              <>
                <dt className="ch-muted">{t("bonus")}</dt>
                <dd data-testid="balance-bonus">{t("tokens", { tokens: n(b.bonus) })}</dd>
              </>
            ) : null}
            <dt className="ch-muted">
              {t("used", { date: format.dateTime(b.periodStart, { dateStyle: "medium" }) })}
            </dt>
            <dd data-testid="balance-used">{t("tokens", { tokens: n(b.monthlyUsed) })}</dd>
            {b.reserved > 0 ? (
              <>
                <dt className="ch-muted">{t("reserved")}</dt>
                <dd data-testid="balance-reserved">{t("tokens", { tokens: n(b.reserved) })}</dd>
              </>
            ) : null}
          </dl>
        </>
      )}
    </section>
  );
};

export const Credits = () => {
  const t = useTranslations("chalito.credits");
  const tp = useTranslations("chalito.landing.plans.hub");
  const { settings, status } = useChalito();
  const [tier, setTier] = useState<string | null | "loading">("loading");

  useEffect(() => {
    if (status === "loading") return;
    if (!settings) return setTier(null);
    let alive = true;
    void settings
      .load()
      .then((r) => alive && setTier(r.values.planCredits.tier))
      .catch(() => alive && setTier(null));
    return () => {
      alive = false;
    };
  }, [settings, status]);

  return (
    <div className="ch-chl ch-chl--narrow">
      <h2 className="ch-h2">{t("title")}</h2>
      <section className="ch-card ch-chl-card" data-testid="credits-plan">
        <h3 className="ch-ghead">{t("plan.title")}</h3>
        {tier === "loading" ? (
          <p aria-live="polite">{t("plan.loading")}</p>
        ) : tier && HUB_TIERS.has(tier) ? (
          <p data-testid="credits-tier">{t("plan.yours", { plan: tp(tier) })}</p>
        ) : (
          <p data-testid="credits-tier">{status === "signed_out" ? t("plan.signedOut") : t("plan.unknown")}</p>
        )}
        <p className="ch-chl-small">{t("plan.fromHub")}</p>
      </section>
      <BalanceCard />
      <section className="ch-chl ch-chl--tight" data-testid="credits-explain">
        <h3 className="ch-ghead">{t("how.title")}</h3>
        <ul className="ch-chl-bullets">
          <li>{t("how.tokens")}</li>
          <li>{t("how.byo")}</li>
          <li>{t("how.basics")}</li>
          <li>{t("how.recharge")}</li>
        </ul>
      </section>
      <div className="ch-chl-row">
        <Link href={RECHARGE_PATH} data-testid="credits-recharge" className="ch-btn ch-btn--primary">
          {t("recharge")}
        </Link>
        <Link href="/uso" className="ch-lnk">
          {t("usage")}
        </Link>
      </div>
    </div>
  );
};
