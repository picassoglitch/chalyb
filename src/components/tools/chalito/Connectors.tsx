"use client";
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Connector } from "@/lib/chalito/web/mcp";
import { useChalito } from "@/lib/chalito/provider";
import { Loading } from "./Loading";

/** "Apps conectadas": the person's MCP grants, each revocable at once (the gateway checks every call). */
export const Connectors = () => {
  const t = useTranslations("chalito.mcp.connectors");
  const format = useFormatter();
  const { mcp, status } = useChalito();
  const [list, setList] = useState<Connector[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revokeFailed, setRevokeFailed] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!mcp) return;
    const r = await mcp.listConnectors();
    if (typeof r === "string") setFailed(true);
    else setList(r);
  }, [mcp]);
  useEffect(() => void load(), [load]);

  // A refused or failed revoke keeps the app listed, so say so instead of closing silently.
  const revoke = async (cid: string) => {
    if (!mcp) return;
    setBusy(true);
    setRevokeFailed(null);
    const r = await mcp.revoke(cid);
    setBusy(false);
    if (r !== true && r !== "not_found") return setRevokeFailed(cid);
    setConfirming(null);
    await load();
  };

  if (status === "signed_out") return <p>{t("signedOut")}</p>;
  // No api at all (Chalito couldn't start here): a failure, not an endless "Cargando…".
  if (failed || (!mcp && status === "error"))
    return (
      <p role="alert" className="ch-card ch-chl-card ch-chl-card--bad">
        {t("failed")}
      </p>
    );
  if (!list) return <Loading label={t("loading")} />;
  const active = list.filter((c) => !c.revokedAt);
  return (
    <div className="ch-chl">
      <h2 className="ch-h2">{t("title")}</h2>
      {active.length === 0 ? <p>{t("empty")}</p> : null}
      <ul className="ch-chl-list">
        {active.map((c) => (
          <li
            key={c.cid}
            data-testid="connector"
            data-cid={c.cid}
            className="ch-card ch-chl-card"
          >
            <div className="ch-chl-row">
              <span className="ch-chl-strong">{c.clientName}</span>
              <span className="ch-chl-small">{c.scopes.join(" · ")}</span>
            </div>
            <p className="ch-chl-small">
              {c.lastUsedAt ? t("lastUsed", { when: format.relativeTime(c.lastUsedAt) }) : t("neverUsed")}
            </p>
            {confirming === c.cid ? (
              <div className="ch-chl-row">
                <span>{t("revokeConfirm", { name: c.clientName })}</span>
                <button
                  className="ch-btn ch-btn--danger ch-btn--compact"
                  disabled={busy}
                  onClick={() => void revoke(c.cid)}
                >
                  {t("revokeYes")}
                </button>
                <button
                  className="ch-btn ch-btn--secondary ch-btn--compact"
                  onClick={() => (setConfirming(null), setRevokeFailed(null))}
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit"
                onClick={() => (setConfirming(c.cid), setRevokeFailed(null))}
              >
                {t("revoke")}
              </button>
            )}
            {revokeFailed === c.cid ? (
              <p role="alert" className="ch-err">
                {t("revokeFailed")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};
