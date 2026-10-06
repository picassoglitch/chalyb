import { useId, useState, type FormEvent } from "react";
import type { ReactNode } from "react";
import type {
  ReportInput,
  RoomError,
  RoomEventView,
  RoomInvite,
  RoomMemberView,
  RoomRetentionView,
} from "@chalito/rooms";
import { useUiText } from "./text";

/**
 * Room screens (ADR 0010), shared by the PWA and the desktop window. Props only: the shell owns a
 * @chalito/rooms RoomController and passes its snapshot and actions. Everything a room event says
 * is shown as quoted TEXT, never markup and never as instructions (room events carry data only).
 * Strings live under `settings.rooms` in messages/*.json.
 */

export type ReportReason = ReportInput["reason"];

/** What a report is about; `text` is the reporter's own decrypted copy (attached only on opt-in). */
export interface ReportTarget {
  eventId?: string;
  memberCompanionId?: string;
  text?: string | null;
}

/** Why the feed stopped: the controller's ended statuses, plus "left" when this person left. */
export type RoomEndReason = "left" | "kicked" | "dissolved" | "revoked" | "not_member";

/** "Tú", or a short stable label for another family's companion (names aren't shared across owners). */
export const memberLabel = (
  companionId: string,
  me: boolean,
  t: (k: string, v?: Record<string, string | number>) => string,
) => (me ? t("rooms.you") : t("rooms.member", { id: companionId.slice(4, 8).toUpperCase() }));

export const RoomEventList = ({
  events,
  me,
  onReport,
}: {
  events: readonly RoomEventView[];
  /** This person's companion id (their own events get no "Reportar"). */
  me: string;
  onReport?: (eid: string) => void;
}) => {
  const { t, locale } = useUiText();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  if (!events.length) return <p className="ch-chl-small">{t("rooms.empty")}</p>;
  return (
    <ol className="ch-chl-list" aria-label={t("rooms.feed")}>
      {events.map((e) => (
        <li key={e.eid} data-testid="room-event" data-eid={e.eid} className="ch-card ch-chl-card ch-chl-item">
          <div className="ch-chl-row ch-chl-small">
            <span className="ch-chl-strong">{memberLabel(e.from, e.from === me, t)}</span>
            <span>{t(`rooms.kind.${e.kind}`)}</span>
            <time className="ch-chl-push" dateTime={new Date(e.t).toISOString()}>
              {time.format(e.t)}
            </time>
          </div>
          {e.text === null ? (
            <p className="ch-chl-small">{t("rooms.sealed")}</p>
          ) : e.text ? (
            // Quoted data: rendered as text (React escapes it), whitespace kept, never HTML.
            <blockquote data-testid="room-event-text" className="ch-chl-quote">
              {e.text}
            </blockquote>
          ) : null}
          {onReport && e.from !== me ? (
            <button type="button" className="ch-lnk ch-chl-bad ch-chl-small ch-chl-fit" onClick={() => onReport(e.eid)}>
              {t("rooms.report")}
            </button>
          ) : null}
        </li>
      ))}
    </ol>
  );
};

export const RoomMembers = ({
  members,
  onReport,
  onRemove,
}: {
  members: readonly RoomMemberView[];
  onReport?: (companionId: string) => void;
  /** "Quitar de la sala": pass it only when this companion owns the room. Never on yourself or the owner. */
  onRemove?: (companionId: string) => Promise<RoomError | null>;
}) => {
  const { t } = useUiText();
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const remove = async (id: string) => {
    if (!onRemove) return;
    setBusy(true);
    const err = await onRemove(id);
    setBusy(false);
    setError(err);
    if (!err) setAsking(null);
  };
  return (
    <div className="ch-chl ch-chl--tight">
      <ul className="ch-chl-list" aria-label={t("rooms.members")}>
        {members.map((m) => (
          <li
            key={m.companionId}
            data-testid="room-member"
            data-companion={m.companionId}
            className="ch-chl-row"
          >
            <span>{memberLabel(m.companionId, m.me, t)}</span>
            {m.role === "owner" ? <span className="ch-pill ch-pill--gray">{t("rooms.owner")}</span> : null}
            <span className="ch-chl-row ch-chl-push">
              {onRemove && !m.me && m.role !== "owner" ? (
                asking === m.companionId ? (
                  <span className="ch-chl-row ch-chl-small">
                    {t("rooms.removeConfirm", { member: memberLabel(m.companionId, false, t) })}
                    <button
                      type="button"
                      className="ch-btn ch-btn--danger ch-btn--compact"
                      disabled={busy}
                      onClick={() => void remove(m.companionId)}
                    >
                      {t("rooms.removeYes")}
                    </button>
                    <button type="button" className="ch-btn ch-btn--gray ch-btn--compact" onClick={() => setAsking(null)}>
                      {t("rooms.cancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="ch-lnk ch-chl-bad ch-chl-small"
                    onClick={() => (setError(null), setAsking(m.companionId))}
                  >
                    {t("rooms.remove")}
                  </button>
                )
              ) : null}
              {onReport && !m.me ? (
                <button
                  type="button"
                  className="ch-lnk ch-chl-bad ch-chl-small"
                  onClick={() => onReport(m.companionId)}
                >
                  {t("rooms.report")}
                </button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="ch-err">
          {t(`rooms.error.${error}`)}
        </p>
      ) : null}
    </div>
  );
};

/** Event lifetimes the owner can pick (rooms.yaml allowedEphemeralTtl; the database checks the same list). */
export const ROOM_TTLS = ["PT1H", "PT24H", "P7D", "P30D", "until_dissolved"] as const;
export const ROOM_TYPES = ["family", "business", "project"] as const;
export type RoomTypeId = (typeof ROOM_TYPES)[number];

/** "Nueva sala": a name and a type; the shell creates it (createRoom) and opens it. */
export const NewRoomForm = ({
  onCreate,
}: {
  /** Resolves to null when created (the shell navigates), or an error key under rooms.create.error. */
  onCreate: (name: string, type: RoomTypeId) => Promise<string | null>;
}) => {
  const { t } = useUiText();
  const nameId = useId();
  const typeId = useId();
  const [name, setName] = useState("");
  const [type, setType] = useState<RoomTypeId>("family");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      data-testid="room-new"
      className="ch-chl ch-chl--tight"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        void onCreate(name.trim(), type).then((err) => {
          setBusy(false);
          setError(err);
        });
      }}
    >
      <div className="ch-chl-row ch-chl-row--bottom">
        <label htmlFor={nameId} className="ch-chl ch-chl--tight ch-chl-grow">
          <span className="ch-chl-strong">{t("rooms.create.name")}</span>
          <input
            id={nameId}
            className="ch-input"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label htmlFor={typeId} className="ch-chl ch-chl--tight">
          <span className="ch-chl-strong">{t("rooms.create.type")}</span>
          <select
            id={typeId}
            className="ch-select"
            value={type}
            onChange={(e) => setType(e.target.value as RoomTypeId)}
          >
            {ROOM_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`rooms.types.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="ch-btn ch-btn--primary ch-btn--compact" disabled={busy || !name.trim()}
        >
          {t("rooms.create.submit")}
        </button>
      </div>
      {error ? (
        <p role="alert" data-testid="room-new-error" className="ch-err">
          {t(`rooms.create.error.${error}`)}
        </p>
      ) : null}
    </form>
  );
};

/** "Invitar": a new invite's glyph (drawn by the shell) and short code, with its expiry. */
export const RoomInvitePanel = ({
  onInvite,
  renderGlyph,
}: {
  onInvite: () => Promise<{ ok: true; invite: RoomInvite } | { ok: false; reason: RoomError }>;
  /** The shell's glyph canvas. */
  renderGlyph: (glyph: RoomInvite["glyph"]) => ReactNode;
}) => {
  const { t, locale } = useUiText();
  const [invite, setInvite] = useState<RoomInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="ch-chl ch-chl--tight" data-testid="room-invite">
      <button
        type="button"
        className="ch-btn ch-btn--secondary ch-btn--compact ch-chl-fit"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void onInvite().then((r) => {
            setBusy(false);
            if (r.ok) setInvite(r.invite);
            else setError(r.reason);
          });
        }}
      >
        {invite ? t("rooms.invite.again") : t("rooms.invite.create")}
      </button>
      {invite ? (
        <div className="ch-card ch-chl-card">
          <p className="ch-muted">{t("rooms.invite.how")}</p>
          {renderGlyph(invite.glyph)}
          <p className="ch-chl-code ch-chl-code--xl" data-testid="room-invite-code">
            {invite.shortCode}
          </p>
          <p className="ch-chl-small">
            {t("rooms.invite.expires", { date: date.format(invite.expiresAt) })}
          </p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="ch-err">
          {t(`rooms.error.${error}`)}
        </p>
      ) : null}
    </div>
  );
};

/** Someone left or was removed: posting is refused until a remaining member rotates the key. */
export const RoomRotation = ({ onRotate }: { onRotate: () => Promise<RoomError | null> }) => {
  const { t } = useUiText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  return (
    <div role="status" data-testid="room-rotation" className="ch-card ch-chl-card ch-chl-card--warn">
      <p>{t("rooms.rotation.why")}</p>
      <button
        type="button"
        className="ch-btn ch-btn--primary ch-btn--compact ch-chl-fit"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onRotate().then((err) => {
            setBusy(false);
            setError(err);
          });
        }}
      >
        {t("rooms.rotation.rotate")}
      </button>
      {error ? (
        <p role="alert" className="ch-err">
          {t(`rooms.error.${error}`)}
        </p>
      ) : null}
    </div>
  );
};

/** The owner's settings: how long events last, whether promoted records stay, and dissolving. */
export const RoomOwnerSettings = ({
  retention,
  onRetention,
  onDissolve,
}: {
  retention: RoomRetentionView;
  onRetention: (r: RoomRetentionView) => Promise<RoomError | null>;
  onDissolve: () => Promise<RoomError | null>;
}) => {
  const { t } = useUiText();
  const ttlId = useId();
  const [ttl, setTtl] = useState(retention.ephemeralTtl);
  const [keep, setKeep] = useState(retention.keepPromoted);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const [confirm, setConfirm] = useState(false);
  const run = async (fn: () => Promise<RoomError | null>, after?: () => void) => {
    setBusy(true);
    setError(null);
    setSaved(false);
    const err = await fn();
    setBusy(false);
    setError(err);
    if (!err) after?.();
  };
  const changed = ttl !== retention.ephemeralTtl || keep !== retention.keepPromoted;
  return (
    <section className="ch-card ch-chl-card" data-testid="room-owner">
      <h2 className="ch-chl-h3">{t("rooms.ownerTitle")}</h2>
      <label htmlFor={ttlId} className="ch-chl ch-chl--tight">
        <span className="ch-chl-strong">{t("rooms.retention.ttl")}</span>
        <select
          id={ttlId}
          className="ch-select ch-chl-fit"
          value={ttl}
          onChange={(e) => setTtl(e.target.value)}
        >
          {ROOM_TTLS.map((x) => (
            <option key={x} value={x}>
              {t(`rooms.retention.ttls.${x}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="ch-chl-check">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        {t("rooms.retention.keepPromoted")}
      </label>
      <div className="ch-chl-row">
        <button
          type="button"
          className="ch-btn ch-btn--primary ch-btn--compact"
          disabled={busy || !changed}
          onClick={() =>
            void run(
              () => onRetention({ ephemeralTtl: ttl, keepPromoted: keep }),
              () => setSaved(true),
            )
          }
        >
          {t("rooms.retention.save")}
        </button>
        {saved ? (
          <span role="status" data-testid="room-retention-saved" className="ch-chl-ok">
            {t("rooms.retention.saved")}
          </span>
        ) : null}
      </div>
      {confirm ? (
        <div className="ch-card ch-chl-card ch-chl-card--bad">
          <p>{t("rooms.dissolve.confirm")}</p>
          <div className="ch-chl-row">
            <button
              type="button"
              className="ch-btn ch-btn--danger ch-btn--compact"
              disabled={busy}
              onClick={() => void run(onDissolve, () => setConfirm(false))}
            >
              {t("rooms.dissolve.yes")}
            </button>
            <button type="button" className="ch-btn ch-btn--gray ch-btn--compact" onClick={() => setConfirm(false)}>
              {t("rooms.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit"
          onClick={() => setConfirm(true)}
        >
          {t("rooms.dissolve.button")}
        </button>
      )}
      {error ? (
        <p role="alert" className="ch-err">
          {t(`rooms.error.${error}`)}
        </p>
      ) : null}
    </section>
  );
};

/** Posts a notice (the only thing a person writes here; 500 characters, like the protocol). */
export const RoomComposer = ({
  onSend,
  disabled,
}: {
  /** Resolves to null when sent, or why not. */
  onSend: (text: string) => Promise<RoomError | null>;
  disabled?: boolean;
}) => {
  const { t } = useUiText();
  const id = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RoomError | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    const err = await onSend(v);
    setError(err);
    if (!err) setText("");
    setBusy(false);
  };
  return (
    <form className="ch-chl ch-chl--tight" onSubmit={(e) => void submit(e)}>
      <div className="ch-chl-row">
        <label htmlFor={id} className="ch-sr">
          {t("rooms.composer")}
        </label>
        <input
          id={id}
          data-testid="room-composer"
          className="ch-input ch-chl-grow"
          maxLength={500}
          placeholder={t("rooms.composer")}
          value={text}
          disabled={disabled || busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="ch-btn ch-btn--primary" disabled={disabled || busy || !text.trim()}
        >
          {t("rooms.send")}
        </button>
      </div>
      {error ? (
        <p role="alert" data-testid="room-composer-error" className="ch-err">
          {t(`rooms.error.${error}`)}
        </p>
      ) : null}
    </form>
  );
};

/**
 * Report an event or a member. The decrypted text goes along ONLY if the person ticks the box
 * (off by default, and only offered for an event they could read).
 */
export const RoomReportDialog = ({
  target,
  label,
  onSubmit,
  onCancel,
}: {
  target: ReportTarget;
  /** What is being reported, for the person ("Aviso · Miembro ABCD"). */
  label?: string;
  onSubmit: (r: ReportInput) => Promise<void>;
  onCancel: () => void;
}) => {
  const { t } = useUiText();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [attach, setAttach] = useState(false);
  const [busy, setBusy] = useState(false);
  const canAttach = !!target.eventId && !!target.text;
  return (
    <form
      role="dialog"
      aria-label={t("rooms.reportTitle")}
      data-testid="room-report"
      className="ch-card ch-chl-card ch-chl-card--bad"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSubmit({
          ...(target.eventId ? { eventId: target.eventId } : {}),
          ...(target.memberCompanionId ? { memberCompanionId: target.memberCompanionId } : {}),
          reason,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(canAttach && attach ? { attachText: target.text! } : {}),
        }).finally(() => setBusy(false));
      }}
    >
      <p className="ch-chl-h3">{t("rooms.reportTitle")}</p>
      {label ? <p className="ch-muted">{label}</p> : null}
      <fieldset className="ch-chl-fieldset ch-chl ch-chl--tight">
        <legend className="ch-chl-strong">{t("rooms.reason")}</legend>
        {(["spam", "abuse", "impersonation", "other"] as const).map((r) => (
          <label key={r} className="ch-chl-check">
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
            {t(`rooms.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <label className="ch-chl ch-chl--tight">
        <span className="ch-chl-strong">{t("rooms.note")}</span>
        <textarea
          className="ch-input ch-textarea"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {canAttach ? (
        <label className="ch-chl-check">
          <input
            type="checkbox"
            data-testid="room-report-attach"
            checked={attach}
            onChange={(e) => setAttach(e.target.checked)}
          />
          <span>{t("rooms.attach")}</span>
        </label>
      ) : null}
      <div className="ch-chl-row">
        <button className="ch-btn ch-btn--danger ch-btn--compact" disabled={busy}>
          {t("rooms.reportSend")}
        </button>
        <button type="button" className="ch-btn ch-btn--gray ch-btn--compact" onClick={onCancel}>
          {t("rooms.cancel")}
        </button>
      </div>
    </form>
  );
};

/** The feed stopped: say why (review R-L14). */
export const RoomEnded = ({ status }: { status: RoomEndReason }) => {
  const { t } = useUiText();
  return (
    <p role="alert" data-testid="room-ended" data-reason={status} className="ch-card ch-chl-card">
      {t(`rooms.ended.${status}`)}
    </p>
  );
};

/** "Unirse con código": the typed short code of an invite. */
export const JoinRoomForm = ({ onJoin }: { onJoin: (code: string) => Promise<void> }) => {
  const { t } = useUiText();
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="ch-chl-row ch-chl-row--bottom"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onJoin(code.trim()).finally(() => setBusy(false));
      }}
    >
      <label htmlFor={id} className="ch-chl ch-chl--tight">
        <span className="ch-chl-strong">{t("rooms.joinLabel")}</span>
        <input
          id={id}
          data-testid="room-join-code"
          className="ch-input ch-chl-codeinput"
          autoComplete="off"
          maxLength={12}
          placeholder="XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button className="ch-btn ch-btn--primary" disabled={busy || code.trim().length < 8}
      >
        {t("rooms.join")}
      </button>
    </form>
  );
};
