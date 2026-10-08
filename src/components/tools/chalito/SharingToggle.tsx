"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useChalito } from "@/lib/chalito/provider";

/**
 * "Compartir tarjeta con apps conectadas" for one session or device. Off by default; turning it on
 * stores the card in plaintext for the connected apps, so it shows that warning and needs an ack.
 */
export const SharingToggle = ({ scope, target }: { scope: "session" | "device"; target: string }) => {
  const t = useTranslations("chalito.mcp.sharing");
  const { mcp, readSharing } = useChalito();
  const [on, setOn] = useState(false);
  const [asking, setAsking] = useState(false);
  const [ack, setAck] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!readSharing) return;
    let alive = true;
    readSharing(scope, target)
      .then((v) => alive && setOn(v))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [readSharing, scope, target]);
  if (!mcp) return null;
  const send = async (enabled: boolean) => {
    setFailed(false);
    const r = await mcp.setSharing({
      ...(scope === "session" ? { sessionId: target } : { deviceId: target }),
      enabled,
      ...(enabled ? { plaintextAck: true } : {}),
    });
    if (r === true) {
      setOn(enabled);
      setAsking(false);
      setAck(false);
    } else setFailed(true);
  };
  return (
    <div data-testid={`sharing-${scope}`} className="ch-card ch-chl-card ch-chl-card--sub">
      <label className="ch-chl-check ch-chl-row--between">
        <span className="ch-chl-strong">{t("label")}</span>
        <input
          type="checkbox"
          role="switch"
          checked={on || asking}
          onChange={(e) => (e.target.checked ? setAsking(true) : on ? void send(false) : setAsking(false))}
        />
      </label>
      {asking && !on ? (
        <div className="ch-card ch-chl-card ch-chl-card--warn">
          <p role="note">{t("warning")}</p>
          <label className="ch-chl-check">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            {t("ack")}
          </label>
          <div className="ch-chl-row">
            <button
              className="ch-btn ch-btn--primary ch-btn--compact"
              disabled={!ack}
              onClick={() => void send(true)}
            >
              {t("confirm")}
            </button>
            <button className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => setAsking(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {failed ? <p role="alert" className="ch-err">{t("failed")}</p> : null}
    </div>
  );
};
