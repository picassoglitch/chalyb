"use client";
import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cleanRecoveryCode, type RecoverError } from "@/lib/chalito/web/activate";
import { browserName } from "@/lib/chalito/web/endorse";
import { useChalito } from "@/lib/chalito/provider";

type State = { s: "idle" } | { s: "busy" } | { s: "cooldown"; until: number } | { s: "error"; reason: RecoverError | "format" };

/**
 * "Usa tu código de recuperación": no trusted browser left but a paired computer (owner decision
 * 2026-10-06: computers count, so no "Activar"), or a lost device from /vincular. The api's
 * cool-down starts on the first try (every device is alerted); once it's over, the same code enrols
 * this browser and the gate shows the NEW recovery code once, like "Activar".
 */
export const Recover = () => {
  const t = useTranslations("chalito.live.recover");
  const locale = useLocale();
  const { recover } = useChalito();
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ s: "idle" });
  if (!recover) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = cleanRecoveryCode(code);
    if (!clean) return setState({ s: "error", reason: "format" });
    setState({ s: "busy" });
    const r = await recover(clean, browserName(navigator.userAgent, locale));
    if (r.ok) return setState({ s: "idle" }); // the provider shows the new code
    setState(r.reason === "cooldown" ? { s: "cooldown", until: r.until } : { s: "error", reason: r.reason });
  };

  const when = (ms: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(ms));

  return (
    <section className="ch-card ch-chl ch-chl--tight" data-testid="recover">
      <h2 className="ch-h2">{t("title")}</h2>
      <p>{t("body")}</p>
      <form className="ch-chl ch-chl--tight" onSubmit={(e) => void submit(e)}>
        <div className={`ch-field${state.s === "error" ? " ch-field--bad" : ""}`}>
          <label htmlFor="recover-code">{t("label")}</label>
          <input
            id="recover-code"
            data-testid="recover-code"
            className="ch-input"
            autoComplete="off"
            spellCheck={false}
            autoCapitalize="characters"
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (state.s === "error") setState({ s: "idle" });
            }}
            aria-invalid={state.s === "error"}
          />
          {state.s === "error" ? (
            <p role="alert" className="ch-field__err" data-testid="recover-error" data-reason={state.reason}>
              {t(`error.${state.reason}`)}
            </p>
          ) : null}
        </div>
        <div className="ch-chl-row">
          <button
            type="submit"
            data-testid="recover-submit"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={state.s === "busy"}
          >
            {state.s === "busy" ? t("busy") : state.s === "cooldown" ? t("retry") : t("cta")}
          </button>
        </div>
      </form>
      {state.s === "cooldown" ? (
        <p role="status" data-testid="recover-cooldown">
          {t("cooldown", { when: when(state.until) })}
        </p>
      ) : null}
    </section>
  );
};
