"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/lib/chalito/navigation";
import type { ActivateError } from "@/lib/chalito/web/activate";
import { browserName } from "@/lib/chalito/web/endorse";
import { useChalito } from "@/lib/chalito/provider";
import { PasskeyEnroll } from "./PasskeyEnroll";

const stack = { display: "grid", gap: 12 } as const;

/**
 * "Activar" (tester item #1): the account has no trusted client yet, so one tap makes this browser
 * the first one, creates its passkey, and opens the chat. Accounts that already have one get the
 * usual "Esperando aprobación" link instead (the api refuses a second first client anyway).
 */
export const Activate = () => {
  const t = useTranslations("chalito.live.activate");
  const locale = useLocale();
  const { activate } = useChalito();
  const [state, setState] = useState<"idle" | "busy" | { error: ActivateError }>("idle");
  if (!activate) return null;

  const run = async () => {
    setState("busy");
    const r = await activate(browserName(navigator.userAgent, locale));
    // On success the provider reconnects and the gate shows the recovery code.
    setState(r.ok ? "idle" : { error: r.reason });
  };

  if (typeof state === "object" && state.error === "has_clients")
    return (
      <div className="ch-card" style={stack} data-testid="activate-has-clients">
        <p>{t("hasClients")}</p>
        <Link href="/vincular" className="ch-btn ch-btn--primary" style={{ width: "fit-content" }}>
          {t("hasClientsCta")}
        </Link>
      </div>
    );

  return (
    <section className="ch-card" style={stack} data-testid="activate">
      <h2 className="ch-h2">{t("title")}</h2>
      <p>{t("body")}</p>
      <button
        type="button"
        data-testid="activate-button"
        className="ch-btn ch-btn--primary"
        style={{ width: "fit-content" }}
        disabled={state === "busy"}
        onClick={() => void run()}
      >
        {state === "busy" ? t("busy") : t("cta")}
      </button>
      {typeof state === "object" ? (
        <p role="alert" data-testid="activate-error" data-reason={state.error}>
          {t(`error.${state.error}`)}
        </p>
      ) : null}
    </section>
  );
};

/**
 * Right after "Activar": the recovery code, shown once (the api keeps only its hash), and the
 * passkey again if its prompt was cancelled. "Ir al chat" opens the Mesas, which run on Energía
 * de Chalito with no computer needed.
 */
export const ActivationDone = () => {
  const t = useTranslations("chalito.live.activate");
  const { activation, finishActivation, status } = useChalito();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!activation) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activation.recoveryCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="ch-card" style={stack} data-testid="activation-done">
      <h2 className="ch-h2">{t("doneTitle")}</h2>
      <h3 className="ch-h3">{t("recoveryTitle")}</h3>
      <p>{t("recoveryBody")}</p>
      <label style={{ display: "grid", gap: 4 }}>
        <span className="ch-muted">{t("recoveryLabel")}</span>
        <input
          data-testid="activation-recovery-code"
          className="ch-input ch-input--ro"
          readOnly
          value={activation.recoveryCode}
          onFocus={(e) => e.currentTarget.select()}
          style={{ fontFamily: "monospace" }}
        />
      </label>
      <button
        type="button"
        className="ch-btn ch-btn--secondary"
        style={{ width: "fit-content" }}
        onClick={() => void copy()}
      >
        {copied ? t("copied") : t("copy")}
      </button>
      {activation.passkey !== "ok" && status === "ready" ? (
        <>
          <p data-testid="activation-passkey-missing">{t("passkeyMissing")}</p>
          <PasskeyEnroll />
        </>
      ) : null}
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          data-testid="activation-saved"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        <span>{t("saved")}</span>
      </label>
      <button
        type="button"
        data-testid="activation-continue"
        className="ch-btn ch-btn--primary"
        style={{ width: "fit-content" }}
        disabled={!saved}
        onClick={() => {
          finishActivation();
          router.push("/m");
        }}
      >
        {t("continue")}
      </button>
    </section>
  );
};
