"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { tokenFormat } from "@/lib/chalito/format";
import { useChalito } from "@/lib/chalito/provider";
import { parseTokens, type CapResult, type CodingSettings } from "@/lib/chalito/web/coding";

type Note = Exclude<CapResult, { ok: true }>["reason"] | "saved" | "cancelled_step_up" | "invalid" | "no_passkey";

/** Ajustes: IA de Chalyb's daily limit in tokens (chalito ADR 0030). Lowering is free; raising asks for the passkey. */
export const CodingCap = () => {
  const t = useTranslations("chalito.coding.cap");
  const locale = useLocale();
  const { coding, assertPasskey } = useChalito();
  const [s, setS] = useState<CodingSettings | "loading" | "error">("loading");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);

  const alive = useRef(true);
  const load = useCallback(async () => {
    if (!coding) return;
    setS("loading");
    const r = await coding.settings();
    if (!alive.current) return;
    setS(r);
    if (r !== "error") setText(String(r.dailyCapTokens));
  }, [coding]);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  if (!coding || s === "loading") return null;
  if (s === "error")
    return (
      <section className="ch-card ch-chl-card ch-chl-row" data-testid="coding-cap-error">
        <span role="alert">{t("error")}</span>
        <button className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => void load()}>
          {t("retry")}
        </button>
      </section>
    );
  if (!s.eligible) return null;
  const n = tokenFormat(locale);

  const save = async () => {
    const want = parseTokens(text);
    if (want === null || want > s.ceilingTokens) return setNote("invalid");
    setBusy(true);
    setNote(null);
    let stepUp: unknown;
    if (want > s.dailyCapTokens) {
      if (!assertPasskey) {
        setBusy(false);
        return setNote("no_passkey");
      }
      try {
        stepUp = await assertPasskey();
      } catch {
        setBusy(false);
        return setNote("cancelled_step_up");
      }
    }
    const r = await coding.setCap(want, stepUp);
    setBusy(false);
    setNote(r.ok ? "saved" : r.reason);
    if (r.ok) await load();
  };

  return (
    <section className="ch-card ch-chl-card ch-chl" data-testid="coding-cap" aria-labelledby="coding-cap-title">
      <h3 id="coding-cap-title" className="ch-chl-h3">
        {t("title")}
      </h3>
      <p className="ch-muted">{t("body")}</p>
      <p data-testid="coding-cap-today">
        {t("today", { used: n.format(s.today.billableTokens), cap: n.format(s.dailyCapTokens) })}
      </p>
      <label className="ch-chl">
        <span>{t("label")}</span>
        <input
          className="ch-input"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="coding-cap-help"
          data-testid="coding-cap-input"
        />
      </label>
      <p id="coding-cap-help" className="ch-muted">
        {t("help", { def: n.format(s.defaultCapTokens), max: n.format(s.ceilingTokens) })}
      </p>
      <button
        className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit"
        disabled={busy}
        onClick={() => void save()}
        data-testid="coding-cap-save"
      >
        {t("save")}
      </button>
      {note ? (
        <p role={note === "saved" ? "status" : "alert"} className={note === "saved" ? "ch-muted" : "ch-err"}>
          {t(`note.${note}`)}
        </p>
      ) : null}
      {!s.enabled ? <p className="ch-muted">{t("paused")}</p> : null}
    </section>
  );
};
