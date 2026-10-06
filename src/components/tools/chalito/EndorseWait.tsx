"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { GlyphPayload } from "@chalito/protocol";
import { Link } from "@/lib/chalito/navigation";
import { browserName, type Introduced, type WaitError, type Waiting } from "@/lib/chalito/web/endorse";
import { hubLaunchUrl } from "@/lib/chalito/web/hub";
import { signInAndReturn } from "@/lib/chalito/web/next-cookie";
import { useChalito, useNow } from "@/lib/chalito/provider";
import { GlyphCanvas } from "./Glyph";

type Step =
  | { s: "name" }
  | { s: "opening" }
  | { s: "waiting"; w: Waiting }
  | { s: "done"; introduced: Introduced | null }
  | { s: "failed"; reason: WaitError };

/**
 * "Esperando aprobación" (/vincular): a new browser, signed in as the person, asks a trusted
 * device to vouch for its keys. It shows a short code and the glyph it signed; once a trusted
 * device approves, it enrols and signs in as itself.
 */
export const EndorseWait = () => {
  const t = useTranslations("chalito.endorse.wait");
  const locale = useLocale();
  const { status, newDevice } = useChalito();
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>({ s: "name" });
  const current = useRef<Waiting | null>(null);
  const now = useNow();

  useEffect(() => setName((n) => n || browserName(navigator.userAgent, locale)), [locale]);
  // Leaving the page cancels the code (the api lets it expire anyway).
  useEffect(() => () => current.current?.cancel(), []);

  const start = async () => {
    if (!newDevice) return;
    setStep({ s: "opening" });
    const w = await newDevice(name.trim() || browserName(navigator.userAgent, locale));
    if ("error" in w) return setStep({ s: "failed", reason: w.error });
    current.current = w;
    setStep({ s: "waiting", w });
    const r = await w.result;
    current.current = null;
    if (!r.ok) return setStep(r.reason === "cancelled" ? { s: "name" } : { s: "failed", reason: r.reason });
    setStep({ s: "done", introduced: r.introduced });
  };

  if (step.s === "done" || status === "ready")
    return (
      <div className="ch-chl ch-chl--tight" data-testid="endorse-done">
        <h2 className="ch-h2">{t("doneTitle")}</h2>
        {step.s === "done" && step.introduced?.trusted.length ? (
          <p data-testid="endorse-introduced">
            {t("doneIntroduced", { computers: step.introduced.trusted.map((a) => a.name).join(", ") })}
          </p>
        ) : (
          <p>{t("doneBody")}</p>
        )}
        {step.s === "done" && step.introduced?.dropped.length ? (
          <ul className="ch-chl ch-chl--tight ch-chl-small ch-chl-warn" data-testid="endorse-dropped">
            {step.introduced.dropped.map((a) => (
              <li key={a.deviceId} data-reason={a.reason}>
                {t("doneDropped", { computer: a.name })}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/bandeja" className="ch-btn ch-btn--primary ch-chl-fit">
          {t("doneCta")}
        </Link>
      </div>
    );
  if (status === "loading") return <p aria-live="polite">{t("loading")}</p>;
  if (status === "signed_out" || ((status === "unpaired" || status === "revoked") && !newDevice))
    return (
      <div className="ch-chl ch-chl--tight" data-testid="endorse-signin">
        <h2 className="ch-h2">{t("title")}</h2>
        <p>{t("signInFirst")}</p>
        {hubLaunchUrl() ? (
          <a
            className="ch-btn ch-btn--primary ch-chl-fit"
            href={hubLaunchUrl()!}
            onClick={(e) => {
              e.preventDefault();
              signInAndReturn(window.location.pathname);
            }}
          >
            {t("signIn")}
          </a>
        ) : null}
      </div>
    );
  if (!newDevice)
    return (
      <p role="alert" data-testid="endorse-unavailable" className="ch-err">
        {t("unavailable")}
      </p>
    );

  if (step.s === "waiting") {
    const { display, fingerprint } = step.w;
    const left = Math.max(0, Math.ceil((display.expiresAt - now) / 1000));
    return (
      <div className="ch-chl" data-testid="endorse-waiting">
        <h2 className="ch-h2">{t("waitingTitle")}</h2>
        <p className="ch-sub">{t("waitingBody")}</p>
        <div className="ch-card ch-chl-card ch-chl-center">
          {display.glyph ? <GlyphCanvas glyph={display.glyph as GlyphPayload} label={t("glyphLabel")} /> : null}
          <p className="ch-chl-small">{t("orType")}</p>
          <p data-testid="endorse-code" className="ch-chl-code ch-chl-code--xl">
            {display.shortCode}
          </p>
          <p>
            {t("fingerprint")}{" "}
            <span data-testid="endorse-own-fingerprint" className="ch-chl-mono">
              {fingerprint}
            </span>
          </p>
          <p aria-live="off" className="ch-chl-small">
            {t("expiresIn", { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, "0") })}
          </p>
        </div>
        <p className="ch-muted">{t("whereToApprove")}</p>
        <button className="ch-btn ch-btn--secondary ch-chl-fit" onClick={() => step.w.cancel()}>
          {t("cancel")}
        </button>
      </div>
    );
  }

  return (
    <div className="ch-chl" data-testid="endorse-start">
      <h2 className="ch-h2">{t("title")}</h2>
      <p className="ch-sub">{t("body")}</p>
      <div className="ch-field ch-chl--narrow">
        <label htmlFor="endorse-name">{t("nameLabel")}</label>
        <input
          id="endorse-name"
          data-testid="endorse-name"
          className="ch-input"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <button
        data-testid="endorse-start-button"
        className="ch-btn ch-btn--primary ch-chl-fit"
        disabled={step.s === "opening"}
        onClick={() => void start()}
      >
        {t("start")}
      </button>
      {step.s === "failed" ? (
        <p role="alert" data-testid="endorse-error" data-reason={step.reason} className="ch-err">
          {t(`error.${step.reason}`)}
        </p>
      ) : null}
    </div>
  );
};
