"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { DeviceView } from "@chalito/client";
import { DeviceEvent } from "@chalito/protocol";
import { Link } from "@/lib/chalito/navigation";
import { useChalito, useLive } from "@/lib/chalito/provider";
import { PasskeyEnroll } from "./PasskeyEnroll";
import { SharingToggle } from "./SharingToggle";

/**
 * Devices: online/offline, Developer mode, revoke. Developer mode can only be turned OFF here
 * (the whole toggle or one toggle); there is no control, route or action that turns it on.
 */
export const Devices = () => {
  const t = useTranslations("chalito.live.devices");
  const { devices } = useLive();
  const { client, deviceId: me, revokeDevice } = useChalito();
  /** Per-computer outcome of the last revoke: delivered now, or offline (its access is already cut). */
  const [revoked, setRevoked] = useState<{
    name: string;
    agents: { name: string; online: boolean; sent: boolean }[];
  } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const agents = devices.filter((d) => d.role === "agent" && !d.revoked);
  // R-L13 / ADR 0018: a computer that refused an endorsement says so (never silent).
  const refusals = agents.flatMap((d) => {
    const e = DeviceEvent.safeParse(d.lastEvent);
    return e.success && e.data.type === "trust.endorsement_refused" ? [{ agent: d, event: e.data }] : [];
  });

  const send = async (f: () => Promise<unknown>, ok: string) => {
    setNote(null);
    try {
      await f();
      setNote(t(ok));
    } catch {
      setNote(t("failed"));
    }
  };

  /**
   * Review R-H5: first the SERVER (the device's account is disabled and its sessions end, so it
   * can't reach any computer through Chalito again), then a signed revokeClient to every computer
   * so each drops the key from its local trust list.
   */
  const revoke = async (d: DeviceView) => {
    if (!client || !revokeDevice) return;
    setNote(null);
    setRevoked(null);
    const server = await revokeDevice(d.deviceId);
    setConfirming(null);
    if (server !== "ok") return setNote(t("revokeFailed"));
    const results = await Promise.allSettled(agents.map((a) => client.actions.revokeClient(a.deviceId, d.deviceId)));
    setRevoked({
      name: d.name,
      agents: agents.map((a, i) => ({ name: a.name, online: a.online, sent: results[i]!.status === "fulfilled" })),
    });
  };

  return (
    <div className="ch-chl">
      <div className="ch-chl-row ch-chl-row--between">
        <h2 className="ch-h2">{t("title")}</h2>
        <Link
          href="/dispositivos/nuevo"
          data-testid="add-device-link"
          className="ch-btn ch-btn--primary ch-btn--compact"
        >
          {t("add")}
        </Link>
      </div>
      <PasskeyEnroll />
      {refusals.length ? (
        <section
          aria-labelledby="sec-notices"
          className="ch-card ch-chl-card ch-chl-card--warn"
        >
          <h2 id="sec-notices" className="ch-chl-strong">
            {t("notices.title")}
          </h2>
          <ul className="ch-chl ch-chl--tight ch-chl-warn">
            {refusals.map(({ agent, event }) => (
              <li
                key={`${agent.deviceId}:${event.clientDeviceId}`}
                role="alert"
                data-testid="endorse-refused"
                data-reason={event.reason}
              >
                {t(event.reason === "missing_step_up" ? "notices.missingStepUp" : "notices.refused", {
                  computer: agent.name,
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ul className="ch-chl-list">
        {devices.map((d) => (
          <li
            key={d.deviceId}
            data-testid="device"
            data-device={d.deviceId}
            className="ch-card ch-chl-card"
          >
            <div className="ch-chl-row">
              <span className="ch-chl-strong">{d.name}</span>
              <span className="ch-chl-small">{t(`role.${d.role}`)}</span>
              <span
                data-testid="presence"
                data-me={d.deviceId === me || undefined}
                className={`ch-pill ch-chl-push ${d.revoked ? "ch-pill--dark" : d.online || d.deviceId === me ? "ch-pill--ok" : "ch-pill--gray"}`}
              >
                {/* This browser is in use right now; its last_seen_at only moves on a device sign-in. */}
                {d.revoked ? t("revoked") : d.deviceId === me ? t("thisDevice") : d.online ? t("online") : t("offline")}
              </span>
            </div>
            {d.role === "agent" && !d.revoked ? <SharingToggle scope="device" target={d.deviceId} /> : null}
            {d.devMode.on ? (
              <div data-testid="devmode-controls" className="ch-card ch-chl-card ch-chl-card--bad">
                <p className="ch-chl-strong ch-chl-bad">
                  {t("devModeOn", { toggles: d.devMode.toggles.join(", ") })}
                </p>
                <div className="ch-chl-row">
                  <button
                    data-testid="devmode-off"
                    className="ch-btn ch-btn--danger ch-btn--compact"
                    onClick={() => client && void send(() => client.actions.devmodeOff(d.deviceId), "devModeOffSent")}
                  >
                    {t("devModeOff")}
                  </button>
                  {d.devMode.toggles.map((tg) => (
                    <button
                      key={tg}
                      data-testid="devmode-toggle-off"
                      className="ch-btn ch-btn--secondary ch-btn--compact"
                      onClick={() =>
                        client &&
                        void send(() => client.actions.devmodeToggleOff(d.deviceId, tg as never), "devModeOffSent")
                      }
                    >
                      {t("toggleOff", { toggle: tg })}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {d.role === "client" && !d.revoked && d.deviceId !== me ? (
              confirming === d.deviceId ? (
                <div className="ch-chl-row">
                  <span>{t("revokeConfirm", { name: d.name })}</span>
                  <button className="ch-btn ch-btn--danger ch-btn--compact" onClick={() => void revoke(d)}>
                    {t("revokeYes")}
                  </button>
                  <button className="ch-btn ch-btn--gray ch-btn--compact" onClick={() => setConfirming(null)}>
                    {t("cancel")}
                  </button>
                </div>
              ) : (
                <button
                  className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit"
                  onClick={() => setConfirming(d.deviceId)}
                >
                  {t("revoke")}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {revoked ? (
        <div role="status" data-testid="revoke-result" className="ch-card ch-chl-card">
          <p className="ch-chl-strong">{t("revokedServer", { name: revoked.name })}</p>
          <ul className="ch-chl ch-chl--tight ch-chl-small">
            {revoked.agents.map((a) => (
              <li key={a.name} data-testid="revoke-agent" data-online={a.online}>
                {a.online && a.sent
                  ? t("revokeAgentOnline", { agent: a.name })
                  : t("revokeAgentOffline", { agent: a.name })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {note ? <p role="status">{note}</p> : null}
      <SignOutEverywhere />
    </div>
  );
};

/**
 * "Cerrar sesión en todos los demás dispositivos" (POST /v1/devices/revoke-all): for a lost or
 * stolen phone. Needs this device's passkey; every other client is cut off server-side at once,
 * and each computer this device trusts gets a signed revoke. Computers stay paired.
 */
const SignOutEverywhere = () => {
  const t = useTranslations("chalito.live.devices.everywhere");
  const { revokeAll, passkey } = useChalito();
  const { devices } = useLive();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<NonNullable<typeof revokeAll>>> | null>(null);
  if (!revokeAll) return null;
  const name = (id: string) => devices.find((d) => d.deviceId === id)?.name ?? id.slice(0, 8);
  const online = (id: string) => devices.find((d) => d.deviceId === id)?.online === true;
  const run = async () => {
    setBusy(true);
    setResult(await revokeAll());
    setBusy(false);
    setConfirming(false);
  };
  return (
    <section className="ch-card ch-chl-card" aria-labelledby="everywhere">
      <h2 id="everywhere" className="ch-chl-strong">
        {t("title")}
      </h2>
      <p className="ch-muted">{t("body")}</p>
      {!passkey.enrolled ? (
        <p data-testid="everywhere-needs-passkey" className="ch-chl-small ch-chl-warn">
          {t("needsPasskey")}
        </p>
      ) : confirming ? (
        <div className="ch-chl-row">
          <span>{t("confirm")}</span>
          <button
            data-testid="everywhere-yes"
            className="ch-btn ch-btn--danger ch-btn--compact"
            disabled={busy}
            onClick={() => void run()}
          >
            {t("yes")}
          </button>
          <button className="ch-btn ch-btn--gray ch-btn--compact" disabled={busy} onClick={() => setConfirming(false)}>
            {t("cancel")}
          </button>
        </div>
      ) : (
        <button
          data-testid="everywhere"
          className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit"
          onClick={() => {
            setResult(null);
            setConfirming(true);
          }}
        >
          {t("button")}
        </button>
      )}
      {result === "cancelled" || result === "no_passkey" || result === "failed" ? (
        <p role="alert" data-testid="everywhere-error" className="ch-err">
          {t(`error.${result}`)}
        </p>
      ) : result ? (
        <div role="status" data-testid="everywhere-result" className="ch-card ch-chl-card">
          <p className="ch-chl-strong">{t("done", { n: result.revoked.length })}</p>
          <ul className="ch-chl ch-chl--tight ch-chl-small">
            {result.notified.map((id) => (
              <li key={id} data-testid="everywhere-agent" data-online={online(id)}>
                {online(id) ? t("agentOnline", { agent: name(id) }) : t("agentOffline", { agent: name(id) })}
              </li>
            ))}
            {result.untrusted.map((id) => (
              <li key={id} data-testid="everywhere-untrusted">
                {t("agentUntrusted", { agent: name(id) })}
              </li>
            ))}
          </ul>
          {result.banFailed.length ? <p className="ch-chl-warn">{t("banFailed")}</p> : null}
        </div>
      ) : null}
    </section>
  );
};
