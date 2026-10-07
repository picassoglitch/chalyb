"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { placeItem, rosterEntry, type CardAnchors } from "@chalito/roster";
import { companionName } from "@chalito/ui";
import { Link } from "@/lib/chalito/navigation";
import { hubLaunchUrl } from "@/lib/chalito/web/hub";
import { signInAndReturn } from "@/lib/chalito/web/next-cookie";
import type { CardPreview } from "@chalito/scene";
import type { CardRef } from "@chalito/scene/custom-card";
import {
  isSkin,
  newPurchaseId,
  type AccessoryItem,
  type AccessorySlot,
  type CompanionLook,
  type SkinEffect,
  type StoreItem,
} from "@/lib/chalito/web/store";
import { useChalito } from "@/lib/chalito/provider";
import type { Balance, BalanceApi } from "@/lib/chalito/web/balance";
import { Loading } from "./Loading";
import { useMyCard, type MyCard } from "@/lib/chalito/useMyCard";

const ROSTER = "/roster";
const asset = (path: string) => `${ROSTER}/${path}`;

interface Card {
  width: number;
  height: number;
  anchors: CardAnchors;
}

/** The accessories tab, grouped by where an item goes (Spanish first: Cuello, Cabeza, Cara, Espalda, Efectos). */
const ACCESSORY_GROUPS: readonly {
  key: "neck" | "head" | "face" | "back" | "effects";
  slots: readonly AccessorySlot[];
}[] = [
  { key: "neck", slots: ["neck"] },
  { key: "head", slots: ["head"] },
  { key: "face", slots: ["face"] },
  { key: "back", slots: ["back"] },
  // Nothing is sold for `body` yet; should something be, it shows with the effects rather than vanish.
  { key: "effects", slots: ["aura", "portal_fx", "body"] },
];

type Note =
  | { kind: "no_tokens"; chipHref: string }
  | { kind: "retry" }
  | { kind: "failed" }
  | { kind: "equip_failed"; reason: string };

/**
 * A CSS stand-in for each skin (the tile swatch, and the preview while WebGL loads or is missing):
 * the real look is the card renderer's shader, drawn live in the preview.
 */
const SKIN_SWATCH: Record<SkinEffect, string> = {
  gold: "linear-gradient(135deg, #6b3d04, #e9a12a 42%, #fff0c0 50%, #e9a12a 58%, #6b3d04)",
  galaxy:
    "radial-gradient(circle at 30% 30%, #d14fa0 0, transparent 38%), radial-gradient(circle at 70% 68%, #2c6bd6 0, transparent 42%), #180a3a",
  neon: "linear-gradient(135deg, #00e5ff, #ff2bd6)",
  crystal: "linear-gradient(160deg, #e6f7ff, #6fa6d8 50%, #eaf8ff)",
  holo: "linear-gradient(120deg, #ff9ad5, #ffe48a, #9affc8, #8ad1ff, #d29aff)",
  shadow: "radial-gradient(circle, #2a1940 55%, #8b3dff)",
  pixel: "repeating-conic-gradient(#f59e5b 0 25%, #fde3c4 0 50%) 0 0 / 12px 12px",
};

/** The skin's swatch in the companion's silhouette (its drawing as a mask), or a plain swatch. */
const SkinSwatch = ({ skin, drawing }: { skin: SkinEffect; drawing: string | null }) => {
  const mask = drawing
    ? {
        maskImage: `url(${drawing})`,
        WebkitMaskImage: `url(${drawing})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }
    : { borderRadius: "9999px", inset: "20%" };
  return (
    <div aria-hidden className="ch-chl-swatch-box" data-testid="store-skin-swatch">
      <div className="ch-chl-swatch-box__fill" style={{ background: SKIN_SWATCH[skin], ...mask }} />
    </div>
  );
};

/**
 * The companion's card drawn by the real renderer (@chalito/scene CardPreview, three.js loaded on
 * demand) with the skin's shader. Mounted the first time a skin is shown and kept, so trying skins
 * on doesn't make a new WebGL context each time. Reports whether it is drawing.
 */
const SkinLayer = ({
  avatar,
  skin,
  onReady,
}: {
  /** The roster id, or the person's own custom card's files. */
  avatar: CardRef;
  skin: SkinEffect | null;
  onReady: (ready: boolean) => void;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<CardPreview | null>(null);
  const want = useRef(skin);
  useEffect(() => {
    want.current = skin;
  }, [skin]);
  useEffect(() => {
    let alive = true;
    let p: CardPreview | null = null;
    void (async () => {
      try {
        const { CardPreview } = await import("@chalito/scene");
        if (!alive || !canvas.current) return;
        p = new CardPreview({ canvas: canvas.current, assetBase: `${ROSTER}/`, avatar, drawing: "neutral" });
        preview.current = p;
        p.setSkin(want.current);
        await p.load();
        if (alive) onReady(true);
      } catch {
        // No WebGL: the CSS stand-in stays.
        if (alive) onReady(false);
      }
    })();
    return () => {
      alive = false;
      p?.dispose();
      preview.current = null;
      onReady(false);
    };
  }, [avatar, onReady]);
  useEffect(() => preview.current?.setSkin(skin), [skin]);
  return (
    <canvas
      ref={canvas}
      aria-hidden
      data-testid="store-skin-canvas"
      className="ch-chl-preview__canvas"
      style={{ visibility: skin ? "visible" : "hidden" }}
    />
  );
};

/**
 * The companion's card with what it wears, placed by `placeItem` (negative z sits behind the body),
 * and the skin (worn, or being tried on) drawn over it by the card renderer. The person's own
 * custom character, when the companion wears one, with its own anchors; else the roster card.
 */
const Preview = ({
  look,
  mine,
  items,
  skin,
  label,
}: {
  look: CompanionLook;
  mine: MyCard;
  items: StoreItem[];
  skin: SkinEffect | null;
  label: string;
}) => {
  const [rosterCard, setCard] = useState<Card | null>(null);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [skinned, setSkinned] = useState(false);
  const [gl, setGl] = useState(false);
  if (skin && !skinned) setSkinned(true);
  const entry = rosterEntry(look.avatar);
  const custom = mine.card;
  const card: Card | null = custom
    ? { width: custom.manifest.width, height: custom.manifest.height, anchors: custom.manifest.anchors ?? {} }
    : rosterCard;
  const drawing = mine.drawing ?? (entry ? asset(entry.drawings.neutral) : null);
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
  if (!entry && !custom) return null;
  const worn = items.filter((i): i is AccessoryItem => !isSkin(i) && look.equipped[i.slot] === i.id);
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
      data-skin={skin ?? ""}
      data-custom={custom ? "true" : undefined}
    >
      <img
        src={drawing ?? undefined}
        onError={custom ? mine.onError : undefined}
        alt=""
        className="ch-chl-preview__body"
        style={{ zIndex: 0, visibility: skin && gl ? "hidden" : "visible" }}
        decoding="async"
      />
      {skin && !gl ? (
        // While the renderer loads (or without WebGL): the skin's colours over the drawing.
        <div
          aria-hidden
          className="ch-chl-preview__tint"
          style={{
            background: SKIN_SWATCH[skin],
            maskImage: `url(${drawing})`,
            WebkitMaskImage: `url(${drawing})`,
            maskSize: "100% 100%",
            WebkitMaskSize: "100% 100%",
          }}
        />
      ) : null}
      {skinned ? <SkinLayer avatar={mine.files ?? look.avatar} skin={skin} onReady={setGl} /> : null}
      {worn.map((i) => {
        // Neck items land on the card's neck (detected, or derived from face and body).
        const aspect = aspects[i.id];
        const p = aspect ? placeItem(card.anchors, i.slot, i.card, aspect, cardAspect) : null;
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
  const mine = useMyCard();
  const [items, setItems] = useState<StoreItem[] | "error" | null>(null);
  const [look, setLook] = useState<CompanionLook | null | "error" | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, Note>>({});
  /** cosmeticId → the purchaseId of the tap in progress (kept until the purchase settles). */
  const pending = useRef<Record<string, string>>({});
  const [tab, setTab] = useState<"accessories" | "skins">("accessories");
  /** A skin being tried on in the preview (any skin, bought or not); null shows what's worn. */
  const [trying, setTrying] = useState<SkinEffect | null>(null);

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
    if (isSkin(item)) setTrying(null);
    setLook((l) => {
      if (!l || l === "error") return l;
      const equipped = { ...l.equipped };
      if (on) equipped[item.slot] = item.id;
      else delete equipped[item.slot];
      return { ...l, equipped };
    });
  };

  if (status === "loading") return <Loading label={t("loading")} rows={2} height={200} />;
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
  const all = Array.isArray(items) ? items : [];
  const wornSkin = look && look !== "error" ? all.find((i) => isSkin(i) && look.equipped.skin === i.id) : undefined;
  const shownSkin = trying ?? (wornSkin && isSkin(wornSkin) ? wornSkin.skin : null);
  const entry = look && look !== "error" ? rosterEntry(look.avatar) : null;
  const drawing = mine.drawing ?? (entry ? asset(entry.drawings.neutral) : null);
  const shown = all.filter((i) => (tab === "skins") === isSkin(i));
  // Accessories by where they go (neck, head, face, back, effects); skins in one list.
  const groups =
    tab === "skins"
      ? [{ key: "skins" as const, items: shown }]
      : ACCESSORY_GROUPS.map((g) => ({
          key: g.key,
          items: shown.filter((i) => (g.slots as readonly string[]).includes(i.slot)),
        })).filter((g) => g.items.length > 0);
  const renderItem = (item: StoreItem) => {
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
        {isSkin(item) ? (
          <SkinSwatch skin={item.skin} drawing={drawing} />
        ) : (
          <img
            src={asset(item.art)}
            alt=""
            width={160}
            height={160}
            loading="lazy"
            decoding="async"
            className="ch-chl-item__art"
          />
        )}
        <p className="ch-chl-strong">{item.name[locale]}</p>
        <p className="ch-chl-small">{t(`slot.${item.slot}`)}</p>
        <p data-testid="store-price">
          {item.free
            ? t("free")
            : isSkin(item) && item.includedInPlan
              ? t("includedVip")
              : item.owned
                ? t("owned")
                : t("price", { tokens: tokens.format(item.priceTokens!) })}
        </p>
        {isSkin(item) && item.vip && !item.owned ? (
          <p className="ch-chl-small" data-testid="store-vip">
            {t("freeWithVip")}
          </p>
        ) : null}
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
        {isSkin(item) && look && look !== "error" && !worn ? (
          <button
            data-testid="store-try"
            className="ch-btn ch-btn--secondary ch-btn--compact"
            aria-pressed={trying === item.skin}
            onClick={() => setTrying((x) => (x === item.skin ? null : item.skin))}
          >
            {trying === item.skin ? t("stopTrying") : t("tryOn")}
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
  };
  return (
    <div className="ch-chl" data-testid="store">
      <div className="ch-chl-head">
        <h2 className="ch-h2">{t("title")}</h2>
        <p className="ch-sub">{t("intro")}</p>
      </div>

      {look && look !== "error" ? (
        <Preview
          look={look}
          mine={mine}
          items={all}
          skin={shownSkin}
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

      {items === null ? <Loading label={t("loading")} rows={2} height={200} /> : null}
      {items === "error" ? (
        <div role="alert" data-testid="store-error" className="ch-card ch-chl-card ch-chl-card--bad ch-chl-bad">
          <p>{t("error")}</p>
          <button className="ch-btn ch-btn--danger ch-btn--compact ch-chl-fit" onClick={() => void load()}>
            {t("retry")}
          </button>
        </div>
      ) : null}

      {Array.isArray(items) ? (
        <div role="tablist" aria-label={t("tabsLabel")} className="ch-chl-chips">
          {(["accessories", "skins"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              id={`store-tab-${k}`}
              aria-selected={tab === k}
              aria-controls="store-items"
              data-testid={`store-tab-${k}`}
              className={`ch-chip ch-chip--sm${tab === k ? " ch-chip--on" : ""}`}
              onClick={() => {
                setTab(k);
                setTrying(null);
              }}
            >
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
      ) : null}
      {Array.isArray(items) && tab === "skins" ? <p className="ch-chl-small">{t("skinsIntro")}</p> : null}

      {Array.isArray(items) ? (
        <div id="store-items" role="tabpanel" aria-labelledby={`store-tab-${tab}`} className="ch-chl">
          {groups.map((g) => (
            <section
              key={g.key}
              data-testid="store-group"
              data-group={g.key}
              aria-labelledby={g.key === "skins" ? undefined : `store-group-${g.key}`}
              className="ch-chl ch-chl--tight"
            >
              {g.key === "skins" ? null : (
                <h3 id={`store-group-${g.key}`} className="ch-chl-h3">
                  {t(`groups.${g.key}`)}
                </h3>
              )}
              <ul className="ch-chl-grid ch-chl-grid--store">{g.items.map(renderItem)}</ul>
            </section>
          ))}
        </div>
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
