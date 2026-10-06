import { useId, useMemo, useState, type ReactNode } from "react";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { formatCompanionTitle } from "@chalito/brand";
import { rosterEntry } from "@chalito/roster";
import { COMPANIONS, companionName, type CompanionId } from "../companions";
import { useRosterAsset } from "../roster-assets";
import { useUiText } from "../text";
import {
  RENDER_QUALITIES,
  type ConnectionStatus,
  type PhoneVerifier,
  type QuietHours,
  type RenderQuality,
} from "./values";

/** "Pueden aplicar cargos" / "Charges may apply": shown wherever calls, SMS or WhatsApp are on. */
export const ChargesNotice = () => {
  const { t } = useUiText();
  return (
    <p
      role="note"
      data-testid="charges-notice"
      className="ch-card ch-chl-card ch-chl-card--warn ch-chl-item"
    >
      {t("charges")}
    </p>
  );
};

export const Toggle = ({
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  children?: ReactNode;
}) => {
  const id = useId();
  return (
    <div className="ch-chl ch-chl--tight">
      <div className="ch-chl-toggle">
        <label htmlFor={id} className="ch-chl-strong">
          {label}
          {hint ? <span className="ch-chl-toggle__hint">{hint}</span> : null}
        </label>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
      {children}
    </div>
  );
};

type PhoneValue = { e164: string | null; verified: boolean };

/**
 * Any country code (libphonenumber-js metadata). The flow follows the server rule: the browser
 * proposes a number, the api sends a code ("Te enviaremos un código"), and only a correct code
 * makes it verified. Nothing here marks a number verified on its own.
 */
export const PhoneField = ({
  value,
  onChange,
  verifier,
  chargesAck,
}: {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  verifier: PhoneVerifier;
  /** The api refuses to send a code before the charges notice is acknowledged. */
  chargesAck: boolean;
}) => {
  const { t, locale } = useUiText();
  const parsed = value.e164 ? parsePhoneNumberFromString(value.e164) : undefined;
  const [country, setCountry] = useState<CountryCode>(parsed?.country ?? (locale === "es" ? "MX" : "US"));
  const [national, setNational] = useState(parsed?.nationalNumber ?? "");
  const [stage, setStage] = useState<"edit" | "code" | "done">(value.verified ? "done" : "edit");
  const [pending, setPending] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"sms" | "call">("sms");
  const countryId = useId();
  const numberId = useId();
  const codeId = useId();
  const names = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const countries = useMemo(
    () => getCountries().sort((a, b) => (names.of(a) ?? a).localeCompare(names.of(b) ?? b, locale)),
    [names, locale],
  );

  const send = async () => {
    const p = parsePhoneNumberFromString(national, country);
    if (!p || !p.isValid()) return setError(t("phone.invalid"));
    setBusy(true);
    setError(null);
    const r = await verifier.start(p.number, { channel, locale });
    setBusy(false);
    if (!r.ok)
      return setError(
        t(
          r.reason === "invalid"
            ? "phone.invalid"
            : r.reason === "rate_limited"
              ? "phone.rateLimited"
              : r.reason === "charges_notice_required"
                ? "needsAck"
                : "phone.error",
        ),
      );
    setPending(p.number);
    setCode("");
    setStage("code");
  };
  const check = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    const r = await verifier.check(pending, code.trim());
    setBusy(false);
    if (!r.ok)
      return setError(
        t(r.reason === "wrong_code" ? "phone.wrongCode" : r.reason === "in_use" ? "phone.inUse" : "phone.error"),
      );
    onChange({ e164: pending, verified: true });
    setStage("done");
  };

  const verifiedNumber = value.verified ? value.e164 : stage === "done" ? pending : null;
  if (stage === "done" && verifiedNumber)
    return (
      <div className="ch-chl-row">
        <span data-testid="phone-verified">{t("phone.verified", { number: verifiedNumber })}</span>
        <button
          type="button"
          className="ch-btn ch-btn--secondary ch-btn--compact"
          onClick={() => {
            setStage("edit");
            setError(null);
          }}
        >
          {t("phone.change")}
        </button>
      </div>
    );

  if (stage === "code")
    return (
      <div className="ch-chl ch-chl--tight">
        <p>{t("phone.codeSent", { number: pending ?? "" })}</p>
        <label htmlFor={codeId} className="ch-chl-strong">
          {t("phone.code")}
        </label>
        <input
          id={codeId}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="ch-input ch-chl-shrink ch-chl-codeinput"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <div className="ch-chl-row">
          <button
            type="button"
            className="ch-btn ch-btn--primary ch-btn--compact"
            disabled={busy || code.length < 4}
            onClick={() => void check()}
          >
            {t("phone.verify")}
          </button>
          <button type="button" className="ch-btn ch-btn--secondary ch-btn--compact" onClick={() => setStage("edit")}>
            {t("phone.change")}
          </button>
        </div>
        {error ? (
          <p role="alert" className="ch-err">
            {error}
          </p>
        ) : null}
      </div>
    );

  return (
    <div className="ch-chl-phone">
      <label htmlFor={countryId} className="ch-sr">
        {t("phone.country")}
      </label>
      <select
        id={countryId}
        className="ch-select"
        value={country}
        onChange={(e) => setCountry(e.target.value as CountryCode)}
      >
        {countries.map((c) => (
          <option key={c} value={c}>
            {names.of(c) ?? c} (+{getCountryCallingCode(c)})
          </option>
        ))}
      </select>
      <label htmlFor={numberId} className="ch-sr">
        {t("phone.number")}
      </label>
      <input
        id={numberId}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className="ch-input"
        placeholder={t("phone.placeholder")}
        value={national}
        aria-invalid={!!error}
        onChange={(e) => setNational(e.target.value)}
      />
      <div className="ch-chl ch-chl--tight ch-chl-span">
        <fieldset className="ch-chl-fieldset ch-chl-row">
          <legend className="ch-sr">{t("phone.channel")}</legend>
          {(["sms", "call"] as const).map((c) => (
            <label key={c} className="ch-chl-check">
              <input type="radio" name="otp-channel" checked={channel === c} onChange={() => setChannel(c)} />
              {t(`phone.by.${c}`)}
            </label>
          ))}
        </fieldset>
        <p className="ch-chl-small">{t(channel === "sms" ? "phone.willSend" : "phone.willCall")}</p>
        {!chargesAck ? <p className="ch-chl-small ch-chl-warn">{t("needsAck")}</p> : null}
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit"
          disabled={busy || !national.trim() || !chargesAck}
          onClick={() => void send()}
        >
          {t("phone.sendCode")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="ch-err ch-chl-span">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export const CompanionPicker = ({ value, onChange }: { value: CompanionId; onChange: (c: CompanionId) => void }) => {
  const { t, locale } = useUiText();
  const asset = useRosterAsset();
  return (
    <div role="radiogroup" aria-label={t("avatar.label")} className="ch-chl-pick">
      {COMPANIONS.map((c) => (
        <label
          key={c}
          className={`ch-card ch-chl-pick__opt${value === c ? " ch-chl-pick__opt--on" : ""}`}
        >
          <input
            type="radio"
            name="companion"
            className="ch-sr"
            value={c}
            checked={value === c}
            onChange={() => onChange(c)}
          />
          {asset ? (
            <img
              src={asset(rosterEntry(c)!.thumbs[128])}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              decoding="async"
              className="ch-chl-pick__img"
            />
          ) : (
            <span aria-hidden className="ch-chl-pick__ph" />
          )}
          <span className="ch-chl-pick__name">{companionName(c, locale)}</span>
        </label>
      ))}
    </div>
  );
};

/** Name input with the live title and credit line (packages/brand, D-028). */
export const CompanionNameField = ({
  value,
  onChange,
}: {
  value: { name: string; isRenamed: boolean };
  onChange: (v: { name: string; isRenamed: boolean }) => void;
}) => {
  const { t, locale } = useUiText();
  const id = useId();
  const title = formatCompanionTitle(value.name, value.isRenamed, locale);
  return (
    <div className="ch-chl ch-chl--tight">
      <label htmlFor={id} className="ch-chl-strong">
        {t("companionName.label")}
      </label>
      <input
        id={id}
        className="ch-input"
        maxLength={80}
        placeholder={t("companionName.placeholder")}
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value, isRenamed: e.target.value.trim().length > 0 })}
      />
      <p data-testid="companion-title" className="ch-chl-h3">
        {title.title}
      </p>
      {title.credit ? (
        <p data-testid="credit-line" className="ch-chl-small">
          {title.credit}
        </p>
      ) : null}
    </div>
  );
};

export const QuietHoursField = ({ value, onChange }: { value: QuietHours; onChange: (v: QuietHours) => void }) => {
  const { t } = useUiText();
  const startId = useId();
  const endId = useId();
  return (
    <fieldset className="ch-chl-fieldset ch-chl ch-chl--tight">
      <legend className="ch-chl-strong">{t("quietHours.label")}</legend>
      <p className="ch-chl-small">{t("quietHours.hint")}</p>
      {(["default", "custom", "off"] as const).map((m) => (
        <label key={m} className="ch-chl-check">
          <input
            type="radio"
            name="quiet-hours"
            checked={value.mode === m}
            onChange={() => onChange({ ...value, mode: m })}
          />
          {t(`quietHours.${m}`)}
        </label>
      ))}
      {value.mode === "custom" ? (
        <div className="ch-chl-row">
          <label htmlFor={startId}>{t("quietHours.from")}</label>
          <input
            id={startId}
            type="time"
            className="ch-input ch-chl-shrink"
            value={value.start}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
          <label htmlFor={endId}>{t("quietHours.to")}</label>
          <input
            id={endId}
            type="time"
            className="ch-input ch-chl-shrink"
            value={value.end}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </div>
      ) : null}
    </fieldset>
  );
};

export const RenderQualityField = ({
  value,
  onChange,
}: {
  value: RenderQuality;
  onChange: (q: RenderQuality) => void;
}) => {
  const { t } = useUiText();
  const id = useId();
  return (
    <div className="ch-chl-row ch-chl-row--between">
      <label htmlFor={id} className="ch-chl-strong">
        {t("renderQuality.label")}
      </label>
      <select
        id={id}
        className="ch-select"
        value={value}
        onChange={(e) => onChange(e.target.value as RenderQuality)}
      >
        {RENDER_QUALITIES.map((q) => (
          <option key={q} value={q}>
            {t(`renderQuality.${q}`)}
          </option>
        ))}
      </select>
    </div>
  );
};

/** BYO connections: mode and status per provider, never a secret. Provider names live under integrations.*. */
export const ConnectionsField = ({
  value,
  providerLabel,
}: {
  value: ConnectionStatus[];
  providerLabel: (provider: string) => string;
}) => {
  const { t } = useUiText();
  if (value.length === 0) return <p className="ch-chl-small">{t("connections.none")}</p>;
  return (
    <ul className="ch-group ch-chl-rows">
      {value.map((c) => (
        <li key={c.provider} className="ch-row">
          <span className="ch-row__tx">{providerLabel(c.provider)}</span>
          <span className="ch-row__val">
            {c.connected ? t(`connections.mode.${c.mode}`) : t("connections.notConnected")}
          </span>
        </li>
      ))}
    </ul>
  );
};
