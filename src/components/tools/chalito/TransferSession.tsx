"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ActionError } from "@chalito/client";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { canTransfer, transferOf, transferTargets } from "@/lib/chalito/web/remote-control";

// ADR 0031 §4: "Mover a otra computadora" on a session's page. The session's computer does the
// checks (link made there, clean pushed git) and reports each step as `session.transferred`.

export const TransferSession = ({ sid }: { sid: string }) => {
  const t = useTranslations("chalito.live.transfer");
  const { client } = useChalito();
  const live = useLive();
  const session = live.sessions.find((s) => s.sid === sid);
  const targets = session ? transferTargets(live.devices, session.agentDeviceId) : [];
  const [to, setTo] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!client || !session) return null;
  const view = transferOf(live.events[sid]);
  const target = to || targets.find((d) => d.online)?.deviceId || targets[0]?.deviceId || "";
  const nameOf = (id: string) => live.devices.find((d) => d.deviceId === id)?.name ?? id.slice(0, 8);
  const allowed = canTransfer(session.state, view);
  const move = async () => {
    setBusy(true);
    setFailed(null);
    try {
      await client.actions.transferSession(sid, target);
    } catch (err) {
      setFailed(err instanceof ActionError ? err.code : "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="transfer-h" className="ch-chl ch-chl--tight" data-testid="transfer-session">
      <h3 id="transfer-h" className="ch-chl-h3">
        {t("title")}
      </h3>
      <p className="ch-muted ch-chl-small">{t("body")}</p>
      {view.stage === "sent" ? (
        <p role="status" aria-live="polite" data-testid="transfer-status" data-stage="sent">
          {t("sent", { computer: nameOf(view.to) })}
        </p>
      ) : null}
      {view.stage === "delivered" ? (
        <p role="status" data-testid="transfer-status" data-stage="delivered">
          {t("delivered", { computer: nameOf(view.to) })}{" "}
          {view.peerSid ? (
            <Link href={`/sesiones/${encodeURIComponent(view.peerSid)}`} className="ch-lnk">
              {t("open")}
            </Link>
          ) : null}
        </p>
      ) : null}
      {view.stage === "refused" ? (
        <p role="alert" className="ch-err" data-testid="transfer-status" data-stage="refused">
          {t.has(`refused.${view.reason}`)
            ? t(`refused.${view.reason}`, { computer: nameOf(view.to) })
            : t("refused.link_refused")}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="ch-err">
          {failed === "error" ? t("failed") : t("failedWhy", { reason: failed })}
        </p>
      ) : null}
      {targets.length === 0 ? (
        <p className="ch-chl-small">{t("none")}</p>
      ) : (
        <div className="ch-chl-row">
          <label htmlFor="transfer-to" className="ch-chl-small">
            {t("to")}
          </label>
          <select
            id="transfer-to"
            className="ch-input"
            value={target}
            onChange={(e) => setTo(e.target.value)}
            disabled={busy || !allowed}
          >
            {targets.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            onClick={() => void move()}
            disabled={busy || !allowed || !target}
            data-testid="transfer-move"
          >
            {t("move")}
          </button>
        </div>
      )}
      {!allowed && view.stage !== "sent" ? <p className="ch-muted ch-chl-small">{t("busy")}</p> : null}
    </section>
  );
};
