"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { tokenFormat } from "@/lib/chalito/format";
import { useChalito } from "@/lib/chalito/provider";
import { spendByAgent, type CodingSettings } from "@/lib/chalito/web/coding";

/** Uso: the "Agentes de código" line, tokens spent on IA de Chalyb in the last 30 days, per agent. */
export const CodingUsage = () => {
  const t = useTranslations("chalito.coding.usage");
  const locale = useLocale();
  const { coding } = useChalito();
  const [s, setS] = useState<CodingSettings | null>(null);
  useEffect(() => {
    if (!coding) return;
    let alive = true;
    void coding.settings().then((r) => alive && setS(r === "error" || r === "unavailable" ? null : r));
    return () => {
      alive = false;
    };
  }, [coding]);
  if (!s || s.days.length === 0) return null;
  const n = tokenFormat(locale);
  return (
    <section className="ch-card ch-chl-card ch-chl" data-testid="coding-usage" aria-labelledby="coding-usage-title">
      <h3 id="coding-usage-title" className="ch-chl-h3">
        {t("title")}
      </h3>
      <ul className="ch-chl-list">
        {spendByAgent(s).map((a) => (
          <li key={a.agent} data-agent={a.agent}>
            {t("line", {
              agent: t(`agents.${a.agent}`),
              tokens: n.format(a.billableTokens),
              requests: a.requests,
            })}
          </li>
        ))}
      </ul>
      <p className="ch-muted">{t("today", { tokens: n.format(s.today.billableTokens) })}</p>
    </section>
  );
};
