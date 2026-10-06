"use client";
import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { CatalogApp } from "@/lib/chalito/web/apps-catalog";
import { checkApiKey, type KeyCheck } from "@/lib/chalito/web/connect";

/**
 * "Pega tu clave": one app's API key, checked here (shape and the provider's usual prefix) and
 * handed to `onSend`, which seals it to the computer (ClientActions.connectApp). The key is never
 * kept beyond this field, logged or sent in plaintext.
 */
export const PasteKeyForm = ({
  app,
  onSend,
  onCancel,
}: {
  app: Pick<CatalogApp, "id" | "name" | "apiKey">;
  onSend: (key: string) => void;
  onCancel: () => void;
}) => {
  const t = useTranslations("chalito.connect");
  const id = useId();
  const [text, setText] = useState("");
  const [bad, setBad] = useState<Extract<KeyCheck, { ok: false }> | null>(null);
  // The prefix the key lacks, once warned: the next submit sends it anyway.
  const [warned, setWarned] = useState<string | null>(null);
  const label = app.apiKey?.label ?? app.name;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = checkApiKey(app.id, text);
    if (!r.ok) return setBad(r);
    if (r.warn && warned === null) return setWarned(r.warn);
    setText("");
    setWarned(null);
    onSend(r.key);
  };

  return (
    <form className="ch-chl ch-chl--tight" onSubmit={submit} data-testid={`paste-key-${app.id}`}>
      <div className={`ch-field${bad ? " ch-field--bad" : ""}`}>
        <label htmlFor={id}>{t("keyLabel", { name: label })}</label>
        <div className="ch-paste">
          <input
            id={id}
            className="ch-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={t("keyPlaceholder")}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBad(null);
              setWarned(null);
            }}
            aria-invalid={!!bad}
            aria-describedby={bad ? `${id}-err` : `${id}-hint`}
          />
        </div>
        {bad ? (
          <p id={`${id}-err`} role="alert" className="ch-field__err">
            {t("keyInvalid")}
          </p>
        ) : warned !== null ? (
          <p id={`${id}-hint`} role="status" className="ch-field__hint">
            {t("keyShape", { name: app.name, prefix: warned })}
          </p>
        ) : (
          <p id={`${id}-hint`} className="ch-muted ch-field__hint">
            {t("keyNote")}
          </p>
        )}
      </div>
      {app.apiKey ? <p className="ch-muted">{t("keyWhere", { label: app.apiKey.label, url: app.apiKey.docsUrl })}</p> : null}
      <div className="ch-chl-row">
        <button type="submit" className="ch-btn ch-btn--primary ch-btn--compact">
          {warned !== null ? t("keySendAnyway") : t("send")}
        </button>
        <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
};
