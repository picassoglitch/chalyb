"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/chalito/navigation";
import { useChalito } from "@/lib/chalito/provider";

type ResetError =
  | "format"
  | "bad_code"
  | "expired"
  | "too_many"
  | "none"
  | "rate_limited"
  | "no_email"
  | "send_failed"
  | "failed";

type State =
  | { s: "intro" }
  | { s: "sending" }
  | { s: "code" }
  | { s: "confirming" }
  | { s: "done" };

const KNOWN: readonly ResetError[] = [
  "format",
  "bad_code",
  "expired",
  "too_many",
  "none",
  "rate_limited",
  "no_email",
  "send_failed",
  "failed",
];

const post = async (path: string, body?: unknown): Promise<{ ok: true } | { ok: false; reason: ResetError }> => {
  const r = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const j = r ? ((await r.json().catch(() => null)) as { ok?: boolean; reason?: string } | null) : null;
  if (r?.ok && j?.ok) return { ok: true };
  const reason = KNOWN.find((k) => k === j?.reason) ?? "failed";
  return { ok: false, reason };
};

/**
 * "Empezar de cero" (owner decision 2026-10-19): no approved device and no recovery code. A code
 * goes to the person's Chalyb email; with it every Chalito device of the account is retired right
 * away, and this browser activates in one tap ("Activar" on Inicio). Old encrypted chats stay locked.
 */
export const ResetDevices = ({ onBack }: { onBack: () => void }) => {
  const t = useTranslations("chalito.endorse.reset");
  const { recheck } = useChalito();
  const router = useRouter();
  const [state, setState] = useState<State>({ s: "intro" });
  const [error, setError] = useState<ResetError | null>(null);
  const [code, setCode] = useState("");

  const send = async () => {
    setError(null);
    setState({ s: "sending" });
    const r = await post("/api/tools/chalito/reset/start");
    if (!r.ok) {
      setError(r.reason);
      return setState(code ? { s: "code" } : { s: "intro" });
    }
    setCode("");
    setState({ s: "code" });
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState({ s: "confirming" });
    const r = await post("/api/tools/chalito/reset/confirm", { code });
    if (!r.ok) {
      setError(r.reason);
      return setState({ s: "code" });
    }
    setState({ s: "done" });
    // The account has no device now: reading it again makes "Activar" apply.
    recheck();
  };

  if (state.s === "done")
    return (
      <section className="ch-card ch-chl ch-chl--tight" data-testid="reset-done">
        <h2 className="ch-h2">{t("title")}</h2>
        <p>{t("done")}</p>
        <button type="button" className="ch-btn ch-btn--primary ch-chl-fit" onClick={() => router.push("/")}>
          {t("doneCta")}
        </button>
      </section>
    );

  const inCode = state.s === "code" || state.s === "confirming";
  return (
    <section className="ch-card ch-chl ch-chl--tight" data-testid="reset">
      <h2 className="ch-h2">{t("title")}</h2>
      <p>{t("body")}</p>
      <p className="ch-chl-warn" data-testid="reset-warning">
        {t("warning")}
      </p>
      {inCode ? (
        <form className="ch-chl ch-chl--tight" onSubmit={(e) => void confirm(e)}>
          <p role="status">{t("sent")}</p>
          <div className={`ch-field${error ? " ch-field--bad" : ""}`}>
            <label htmlFor="reset-code">{t("label")}</label>
            <input
              id="reset-code"
              data-testid="reset-code"
              className="ch-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={9}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={!!error}
            />
          </div>
          <div className="ch-chl-row">
            <button
              type="submit"
              data-testid="reset-confirm"
              className="ch-btn ch-btn--danger ch-btn--compact"
              disabled={state.s === "confirming"}
            >
              {state.s === "confirming" ? t("confirming") : t("confirm")}
            </button>
            <button type="button" className="ch-link" onClick={() => void send()} disabled={state.s === "confirming"}>
              {t("resend")}
            </button>
          </div>
        </form>
      ) : (
        <div className="ch-chl-row">
          <button
            type="button"
            data-testid="reset-send"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={state.s === "sending"}
            onClick={() => void send()}
          >
            {state.s === "sending" ? t("sending") : t("send")}
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="ch-err" data-testid="reset-error" data-reason={error}>
          {t(`error.${error}`)}
        </p>
      ) : null}
      <button type="button" className="ch-link" onClick={onBack}>
        {t("back")}
      </button>
    </section>
  );
};
