"use client";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { env } from "@/lib/chalito/web/env";
import { pushState, type PushState } from "@/lib/chalito/web/push";
import { useChalito } from "@/lib/chalito/provider";

/** Chalito's push worker, for this locale's /app/chalito (production only, as on Chalito's site). */
const registerWorker = async (locale: string): Promise<void> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production") return;
  const scope = `${locale === "en" ? "/en" : ""}/app/chalito/`;
  await navigator.serviceWorker.register("/chalito-sw.js", { scope }).catch(() => undefined);
};

/**
 * Ajustes → Notificaciones: Web Push on THIS browser. Per device, so it isn't a synced setting
 * (packages/ui's registry); it needs this browser paired, since the subscription row is its own.
 * Inside the hub it also registers Chalito's push worker (public/chalito-sw.js), scoped to
 * /app/chalito in this locale so it never controls the rest of the hub.
 */
export const PushOptIn = () => {
  const t = useTranslations("chalito.live.push");
  const { status, push } = useChalito();
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    let alive = true;
    void registerWorker(locale)
      .then(() => pushState(env.vapidPublicKey))
      .then(
        (s) => alive && setState(s),
        () => alive && setState("unsupported"),
      );
    return () => {
      alive = false;
    };
  }, [locale]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setFailed(false);
    try {
      const r = await fn();
      if (r === "failed") setFailed(true);
      else setState(r as PushState);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="push-optin" data-state={state} className="ch-card ch-chl-card">
      <h3 className="ch-chl-h3">{t("title")}</h3>
      <p className="ch-muted">{t("hint")}</p>
      {state === "loading" ? null : state === "unsupported" ? (
        <p role="note">{t("unsupported")}</p>
      ) : state === "denied" ? (
        <p role="note">{t("denied")}</p>
      ) : !push ? (
        <p role="note">{status === "loading" ? t("loading") : t("needsPairing")}</p>
      ) : state === "on" ? (
        <div className="ch-chl-row">
          <p data-testid="push-on" className="ch-chl-ok">{t("on")}</p>
          <button className="ch-btn ch-btn--secondary ch-btn--compact" disabled={busy} onClick={() => void run(push.disable)}>
            {t("disable")}
          </button>
        </div>
      ) : (
        <button
          className="ch-btn ch-btn--primary ch-chl-fit"
          disabled={busy}
          onClick={() => void run(push.enable)}
        >
          {t("enable")}
        </button>
      )}
      {failed ? <p role="alert" className="ch-err">{t("failed")}</p> : null}
    </section>
  );
};
