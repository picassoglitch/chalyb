"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { placeOnCard, rosterEntry, type CardAnchor } from "@chalito/roster";
import { companionName } from "@chalito/ui";
import { Link } from "@/lib/chalito/navigation";
import { hubLaunchUrl } from "@/lib/chalito/web/hub";
import { signInAndReturn } from "@/lib/chalito/web/next-cookie";
import { newPurchaseId, type CompanionLook, type Slot, type StoreItem } from "@/lib/chalito/web/store";
import { useChalito } from "@/lib/chalito/provider";
import type { Balance, BalanceApi } from "@/lib/chalito/web/balance";

const ROSTER = "/roster";
const asset = (path: string) => `${ROSTER}/${path}`;

interface Card {
  width: number;
  height: number;
  anchors: Partial<Record<Slot, CardAnchor>>;
}

type Note =
  | { kind: "no_tokens"; chipHref: string }
  | { kind: "retry" }
  | { kind: "failed" }
  | { kind: "equip_failed"; reason: string };

/** The companion's card with what it wears, placed by `placeOnCard` (negative z sits behind the body). */
const Preview = ({ look, items, label }: { look: CompanionLook; items: StoreItem[]; label: string }) => {
  const [card, setCard] = useState<Card | null>(null);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const entry = rosterEntry(look.avatar);
  useEffect(() => {
    if (!entry) return;
    let alive = true;
    void fetch(asset(entry.card))
      .then((r) => (r.ok ? (r.json() as Promise<Card>) : null))
      .then((c) => alive && setCard(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entry]);
  if (!entry) return null;
  const worn = items.filter((i) => look.equipped[i.slot] === i.id);
  if (!card) return <div aria-hidden className="ch-chl-preview ch-chl-preview--empty" />;
  const cardAspect = card.height / card.width;
  return (
    // Headroom above the card: hats and auras reach past its top edge.
    <figure
      className="ch-chl-preview"
      style={{ aspectRatio: `${card.width} / ${card.height}` }}
      role="img"
      aria-label={label}
      data-testid="store-preview"
      data-worn={worn.map((i) => i.id).join(" ")}
    >
      <img
        src={asset(entry.drawings.neutral)}
        alt=""
        className="ch-chl-preview__body"
        style={{ zIndex: 0 }}
        decoding="async"
      />
      {worn.map((i) => {
        const anchor = card.anchors[i.slot];
        const aspect = aspects[i.id];
        const p = anchor && aspect ? placeOnCard(anchor, i.card, aspect, cardAspect) : null;
        return (
          <img
            key={i.id}
            src={asset(i.art)}
            alt=""
            data-testid="store-worn"
            data-item={i.id}
            decoding="async"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0) setAspects((a) => ({ ...a, [i.id]: img.naturalHeight / img.naturalWidth }));
            }}
            className="ch-chl-preview__item"
            style={
              p
                ? {
                    left: `${p.left * 100}%`,
                    top: `${p.top * 100}%`,
                    width: `${p.width * 100}%`,
                    height: `${p.height * 100}%`,
                    zIndex: p.z,
                  }
                : { visibility: "hidden", width: "10%" }
            }
          />
        );
      })}
    </figure>
  );
};

/**
 * /tienda: cosmetics for the companion. They change how it looks, never what it can do. Prices
 * are hub tokens (never money). A buy tap makes one purchaseId and reuses it on retry, so a retry
 * never charges twice; not enough tokens shows an inline chip to /creditos, never a modal. Every
 * buy, retries too, asks first with the price and the balance left after (owner decision 2026-10-06).
 */
export const Store = () => {
  const t = useTranslations("chalito.store");
  const locale = useLocale() as "es" | "en";
  const { status, store, readCompanion, balance } = useChalito();
  const [confirm, setConfirm] = useState<{ item: StoreItem; retry: boolean } | null>(null);
  const [items, setItems] = useState<StoreItem[] | "error" | null>(null);
  const [look, setLook] = useState<CompanionLook | null | "error" | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  /** cosmeticId → the purchaseId of the tap in progress (kept until the purchase settles). */
  const pending = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!store || !readCompanion) return;
    const [c, l] = await Promise.all([store.catalog(), readCompanion()]);
    setItems(c);
    setLook(l);
  }, [store, readCompanion]);
  useEffect(() => void load(), [load]);

  const note = (id: string, n: Note | null) =>
    setNotes((all) => {
      const next = { ...all };
      if (n) next[id] = n;
      else delete next[id];
      return next;
    });

  const buy = async (item: StoreItem, retry = false) => {
    if (!store) return;
    if (!retry || !pending.current[item.id]) pending.current[item.id] = newPurchaseId();
    setBusy(item.id);
    note(item.id, null);
    const r = await store.purchase(item.id, pending.current[item.id]!);
    setBusy(null);
    if (r.ok) {
      delete pending.current[item.id];
      setItems((all) => (Array.isArray(all) ? all.map((i) => (i.id === item.id ? { ...i, owned: true } : i)) : all));
      return;
    }
    if (r.reason === "retry") return note(item.id, { kind: "retry" });
    delete pending.current[item.id];
    note(item.id, r.reason === "no_tokens" ? { kind: "no_tokens", chipHref: r.chipHref } : { kind: "failed" });
  };

  const ask = (item: StoreItem, retry = false) => {
    note(item.id, null);
    setConfirm({ item, retry });
  };

  const equip = async (item: StoreItem, on: boolean) => {
    if (!store || !look || look === "error") return;
    setBusy(item.id);
    note(item.id, null);
    const r = await store.equip(look.companionId, item.slot, on ? item.id : null);
    setBusy(null);
    if (!r.ok) return note(item.id, { kind: "equip_failed", reason: r.reason });
    setLook((l) => {
      if (!l || l === "error") return l;
      const equipped = { ...l.equipped };
      if (on) equipped[item.slot] = item.id;
      else delete equipped[item.slot];
      return { ...l, equipped };
    });
  };

  if (status === "loading") return <p aria-live="polite">{t("loading")}</p>;
  if (status === "signed_out" || !store)
    return (
      <div className="ch-chl ch-chl--tight" data-testid="store-signin">
        <h2 className="ch-h2">{t("title")}</h2>
        <p>{t("signIn")}</p>
        {hubLaunchUrl() ? (
          <a
            className="ch-btn ch-btn--primary ch-chl-fit"
            href={hubLaunchUrl()!}
            onClick={(e) => {
              e.preventDefault();
              signInAndReturn(window.location.pathname);
            }}
          >
            {t("signInCta")}
          </a>
        ) : null}
      </div>
    );

  const tokens = new Intl.NumberFormat(locale);
  return (
    <div className="ch-chl" data-testid="store">
      <div className="ch-chl-head">
        <h2 className="ch-h2">{t("title")}</h2>
        <p className="ch-sub">{t("intro")}</p>
      </div>

      {look && look !== "error" ? (
        <Preview
          look={look}
          items={Array.isArray(items) ? items : []}
          label={t("previewLabel", { name: companionName(look.avatar, locale) })}
        />
      ) : look === null ? (
        <p data-testid="store-no-companion" className="ch-card ch-chl-card ch-chl-card--inline">
          {t("noCompanion")}{" "}
          <Link href="/bienvenida" className="ch-lnk">
            {t("chooseCompanion")}
          </Link>
        </p>
      ) : null}

      {items === null ? <p aria-live="polite">{t("loading")}</p> : null}
      {items === "error" ? (
        <div role="alert" data-testid="store-error" className="ch-card ch-chl-card ch-chl-card--bad ch-chl-bad">
          <p>{t("error")}</p>
          <button className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {Array.isArray(items) ? (
        <ul className="ch-chl-grid ch-chl-grid--store">
          {items.map((item) => {
            const worn = !!look && look !== "error" && look.equipped[item.slot] === item.id;
            const n = notes[item.id];
            return (
              <li
                key={item.id}
                data-testid="store-item"
                data-item={item.id}
                data-owned={item.owned}
                data-worn={worn}
                className="ch-card ch-chl-card ch-chl-item"
              >
                <img
                  src={asset(item.art)}
                  alt=""
                  width={160}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  className="ch-chl-item__art"
                />
                <p className="ch-chl-strong">{item.name[locale]}</p>
                <p className="ch-chl-small">{t(`slot.${item.slot}`)}</p>
                <p data-testid="store-price">
                  {item.free
                    ? t("free")
                    : item.owned
                      ? t("owned")
                      : t("price", { tokens: tokens.format(item.priceTokens!) })}
                </p>
                {!item.owned ? (
                  <button
                    data-testid="store-buy"
                    className="ch-btn ch-btn--primary ch-btn--compact"
                    disabled={busy !== null}
                    onClick={() => ask(item)}
                  >
                    {t("buy")}
                  </button>
                ) : look && look !== "error" ? (
                  <button
                    data-testid={worn ? "store-unequip" : "store-equip"}
                    className="ch-btn ch-btn--secondary ch-btn--compact"
                    disabled={busy !== null}
                    aria-pressed={worn}
                    onClick={() => void equip(item, !worn)}
                  >
                    {worn ? t("unequip") : t("equip")}
                  </button>
                ) : null}
                {n?.kind === "no_tokens" ? (
                  <p role="status" data-testid="store-no-tokens" className="ch-chl-small">
                    {t("noTokens")}{" "}
                    {n.chipHref === "/creditos" ? (
                      <Link href="/creditos" className="ch-pill ch-pill--acc">
                        {t("whyChip")}
                      </Link>
                    ) : (
                      <a href={n.chipHref} className="ch-pill ch-pill--acc">
                        {t("whyChip")}
                      </a>
                    )}
                  </p>
                ) : null}
                {n?.kind === "retry" ? (
                  <p role="alert" data-testid="store-retry" className="ch-chl ch-chl--tight ch-err">
                    {t("retryBuy")}
                    <button
                      className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit"
                      disabled={busy !== null}
                      onClick={() => ask(item, true)}
                    >
                      {t("retry")}
                    </button>
                  </p>
                ) : null}
                {n?.kind === "failed" ? (
                  <p role="alert" className="ch-err">
                    {t("failed")}
                  </p>
                ) : null}
                {n?.kind === "equip_failed" ? (
                  <p role="alert" data-testid="store-equip-error" className="ch-err">
                    {t(`equipError.${n.reason}`)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="ch-chl-small">{t("lookOnly")}</p>
      {confirm ? (
        <ConfirmBuy
          item={confirm.item}
          balance={balance}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void buy(confirm.item, confirm.retry);
          }}
        />
      ) : null}
    </div>
  );
};

/** "¿Comprar …?" with the price and what's left after; the hub still has the last word. */
const ConfirmBuy = ({
  item,
  balance,
  onCancel,
  onConfirm,
}: {
  item: StoreItem;
  balance: BalanceApi | null;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const t = useTranslations("chalito.store.confirm");
  const locale = useLocale() as "es" | "en";
  const n = new Intl.NumberFormat(locale);
  const [b, setB] = useState<Balance | "loading" | "unavailable" | "error">(balance ? "loading" : "error");
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!balance) return;
    let alive = true;
    void balance().then((r) => alive && setB(r));
    return () => {
      alive = false;
    };
  }, [balance]);
  useEffect(() => {
    yes.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const price = item.priceTokens ?? 0;
  const known = typeof b === "object" && !b.unlimited ? b : null;
  return (
    <div className="ch-chl-scrim" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-confirm-title"
        data-testid="store-confirm"
        className="ch-card ch-chl-card ch-chl-modal"
      >
        <h2 id="store-confirm-title" className="ch-chl-h3">
          {t("title", { name: item.name[locale] })}
        </h2>
        <dl className="ch-chl-dl">
          <dt>{t("price")}</dt>
          <dd data-testid="store-confirm-price">{t("tokens", { tokens: n.format(price) })}</dd>
          {known ? (
            <>
              <dt>{t("now")}</dt>
              <dd>{t("tokens", { tokens: n.format(known.remaining) })}</dd>
              <dt>{t("after")}</dt>
              <dd data-testid="store-confirm-after">
                {t("tokens", { tokens: n.format(Math.max(0, known.remaining - price)) })}
              </dd>
            </>
          ) : null}
        </dl>
        {b === "loading" ? (
          <p aria-live="polite" className="ch-muted">
            {t("loading")}
          </p>
        ) : null}
        {b === "unavailable" || b === "error" ? <p className="ch-muted">{t("noBalance")}</p> : null}
        {typeof b === "object" && b.unlimited ? <p className="ch-muted">{t("unlimited")}</p> : null}
        {known && known.remaining < price ? (
          <p role="status" data-testid="store-confirm-short" className="ch-chl-warn">
            {t("short")}{" "}
            <Link href="/creditos" className="ch-pill ch-pill--acc">
              {t("recharge")}
            </Link>
          </p>
        ) : null}
        <div className="ch-chl-row ch-chl-row--end">
          <button className="ch-btn ch-btn--secondary ch-btn--compact" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button
            ref={yes}
            data-testid="store-confirm-buy"
            className="ch-btn ch-btn--primary ch-btn--compact"
            onClick={onConfirm}
          >
            {t("buy", { tokens: n.format(price) })}
          </button>
        </div>
      </div>
    </div>
  );
};
