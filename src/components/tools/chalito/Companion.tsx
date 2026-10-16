'use client';
// The companion on every Chalito screen (owner decision 2026-10-05): the picked character, or
// Chalito until there's a pick, doing something that fits the screen, wearing only what the person
// put on in the store (owner decision 2026-10-08). Motion comes from the same
// AvatarDriver the room scene uses (bob, squash, lean, gaze toward the pointer), applied to the
// card's drawings with CSS instead of three.js. Until the person's character is known it is a
// neutral stand-in (or last visit's character, kept on this device): never other characters first.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AvatarDriver } from '@chalito/avatar-three/driver';
import { CreatureBinding } from '@chalito/avatar-three/creature';
import { EMOTION_DRAWING, DRAWINGS, placeItem, rosterEntry, type CardAnchors } from '@chalito/roster';
import { useChalito } from '@/lib/chalito/provider';
import { isSkin, type AccessoryItem } from '@/lib/chalito/web/store';
import { SKIN_SWATCH } from '@/lib/chalito/skins';
import { usePathname } from '@/lib/chalito/navigation';
import { useSettings } from '@/lib/chalito/useSettings';
import { useMyCard } from '@/lib/chalito/useMyCard';
import {
  CARD_WAIT_MS,
  companionOrDefault,
  activityFor,
  companionSettled,
  companionShown,
  loadLastCompanion,
  saveLastCompanion,
  useCompanionPick,
  useCompanionStep,
  useWornLook,
  type Activity,
} from '@/lib/chalito/companion';
import type { AppLocale } from '@/i18n/locales';
import '@/styles/chalito-companion.css';

interface CardJson {
  width: number;
  height: number;
  anchors: CardAnchors;
}

const base = (id: string) => `/roster/assets/${id}`;

const useCard = (id: string): CardJson | null => {
  const [card, setCard] = useState<{ id: string; json: CardJson } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`${base(id)}/card.json`)
      .then((r) => (r.ok ? (r.json() as Promise<CardJson>) : null))
      .then((json) => live && json && setCard({ id, json }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return card?.id === id ? card.json : null;
};

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// `hero`: the big one on Chalito's Inicio once onboarding is done (owner decision 2026-10-06);
// the floating one steps aside there so there's only one.
export const Companion = ({ hero = false }: { hero?: boolean }) => {
  const t = useTranslations('chalito.companion');
  const locale = useLocale() as AppLocale;
  const path = usePathname();
  const { values, onboarded, settled } = useSettings();
  const pick = useCompanionPick((s) => s.pick);
  const step = useCompanionStep((s) => s.step);
  const { store, readCompanion, status, hubUserId, myCard: cardSource } = useChalito();

  // The person's own character ("Crea tu personaje"), when the companion wears one; its drawings
  // come from short-lived signed URLs (refreshed on error, then back to the roster art).
  const mine = useMyCard();
  // No answer about the custom card for a while (the api is down): draw the roster one.
  const [cardWaitOver, setCardWaitOver] = useState(false);
  useEffect(() => {
    if (!cardSource || mine.known) return;
    const t = setTimeout(() => setCardWaitOver(true), CARD_WAIT_MS);
    return () => clearTimeout(t);
  }, [cardSource, mine.known]);
  // Last visit's look on this device, read after hydration (the server renders the stand-in).
  const [last, setLast] = useState<ReturnType<typeof loadLastCompanion>>(null);
  useEffect(() => setLast(loadLastCompanion(hubUserId ?? undefined)), [hubUserId]);
  const input = {
    pick,
    status,
    avatar: settled ? (values?.avatar ?? null) : undefined,
    card: mine.card ? ('custom' as const) : mine.known || cardWaitOver ? ('none' as const) : ('unknown' as const),
    last,
  };
  const shown = companionShown(input);
  const known = companionSettled(input);
  const shownId = shown.kind === 'roster' ? shown.id : null;
  const shownKey = shownId ?? shown.kind;
  // Remember the account's settled look for next time (never a guess from the cache itself).
  useEffect(() => {
    if (!known || !hubUserId || shownKey === 'pending') return;
    saveLastCompanion(
      shownId ? { owner: hubUserId, kind: 'roster', id: shownId } : { owner: hubUserId, kind: 'custom' },
    );
  }, [known, hubUserId, shownKey, shownId]);

  // The roster avatar under a custom card is the account's (for its name); pending draws nothing.
  const id = shown.kind === 'roster' ? shown.id : companionOrDefault(values?.avatar);
  const entry = rosterEntry(id)!;
  const activity: Activity = step ?? activityFor(path);
  const drawing = EMOTION_DRAWING[activity.emotion];
  const rosterCard = useCard(id);
  const custom = shown.kind === 'custom' ? mine.card : null;
  const card: CardJson | null = custom
    ? { width: custom.manifest.width, height: custom.manifest.height, anchors: (custom.manifest.anchors ?? {}) as CardAnchors }
    : rosterCard;
  const layerSrc = (d: string): string =>
    custom
      ? (custom.urls[custom.manifest.emotions.src[d] ?? custom.manifest.emotions.src.neutral!] ?? '')
      : `${base(id)}/layer-${d}.webp`;
  // On Inicio the hero takes over once onboarded; until that's known the floating one waits too.
  const hidden = !hero && activity.key === 'home' && (onboarded || !settled);
  const pending = shown.kind === 'pending';

  // What it wears: loaded once here (the store keeps it current after an equip).
  const look = useWornLook((s) => s.look);
  const items = useWornLook((s) => s.items);
  useEffect(() => {
    if (!store || !readCompanion || useWornLook.getState().look !== undefined) return;
    let live = true;
    void Promise.all([readCompanion(), store.catalog()]).then(
      ([l, c]) => live && useWornLook.getState().look === undefined && useWornLook.getState().set(l, c),
    );
    return () => {
      live = false;
    };
  }, [store, readCompanion]);
  const equipped = look && look !== 'error' ? look.equipped : {};
  const all = Array.isArray(items) ? items : [];
  const worn = all.filter((i): i is AccessoryItem => !isSkin(i) && equipped[i.slot] === i.id);
  const skinItem = all.find((i) => isSkin(i) && equipped.skin === i.id);
  const skin = skinItem && isSkin(skinItem) ? skinItem.skin : null;
  const [aspects, setAspects] = useState<Record<string, number>>({});

  const body = useRef<HTMLDivElement>(null);
  const driver = useMemo(() => new AvatarDriver({ seed: 7 }), []);

  useEffect(() => {
    const now = performance.now();
    driver.setEmotion({ tag: activity.emotion, intensity: activity.intensity }, now);
    driver.setSleepy(!!activity.sleepy);
  }, [driver, activity.emotion, activity.intensity, activity.sleepy]);

  // Bob, squash and lean from the driver; turn toward the pointer.
  useEffect(() => {
    const el = body.current;
    if (hidden || pending || !el || reducedMotion()) return;
    type V3 = [number, number, number];
    const tf: { s: V3; p: V3; r: V3 } = { s: [1, 1, 1], p: [0, 0, 0], r: [0, 0, 0] };
    const vec = (k: keyof typeof tf) => ({ set: (x: number, y: number, z: number) => void (tf[k] = [x, y, z]) });
    const binding = new CreatureBinding({ scale: vec('s'), position: vec('p'), rotation: vec('r') });
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      const dy = (e.clientY - (r.top + r.height / 3)) / window.innerHeight;
      driver.lookAt({ yaw: Math.max(-30, Math.min(30, dx * 60)), pitch: Math.max(-20, Math.min(20, dy * 40)) });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    let raf = 0;
    const tick = (now: number) => {
      binding.apply(driver.frame(now));
      const h = el.offsetHeight;
      const deg = 180 / Math.PI;
      el.style.transform =
        `translateY(${(-tf.p[1] * h).toFixed(2)}px) ` +
        `rotateX(${(tf.r[0] * deg).toFixed(2)}deg) rotateY(${(tf.r[1] * deg).toFixed(2)}deg) ` +
        `rotateZ(${(tf.r[2] * deg).toFixed(2)}deg) scale(${tf.s[0].toFixed(4)}, ${tf.s[1].toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    };
    // The body is remounted per character (key), so rebind when it changes.
  }, [driver, hidden, pending, shownKey]);

  const placed = card
    ? worn.map((i) => {
        const a = aspects[i.id];
        const p = a ? placeItem(card.anchors, i.slot, i.card, a, card.height / card.width) : null;
        return { item: i, p };
      })
    : [];
  const drawn = layerSrc(drawing);
  const aspect = card ? `${card.width} / ${card.height}` : '3 / 4';
  if (hidden) return null;
  if (pending)
    return (
      <aside className={hero ? 'chc chc--hero chc--pending' : 'chc chc--pending'} aria-hidden="true" data-pending="true">
        <div className="chc__stage" style={{ aspectRatio: '3 / 4' }}>
          <span className="chc__shadow" aria-hidden="true" />
          <span className="chc__ghost" aria-hidden="true" />
        </div>
      </aside>
    );

  return (
    <aside className={hero ? 'chc chc--hero' : 'chc'} aria-label={t('aria', { name: entry.name[locale] })} data-companion={id} data-custom={custom ? 'true' : undefined} data-activity={activity.key}>
      <p className="chc__bubble" aria-live="polite" key={`${id}-${activity.key}`}>
        {t(`do.${activity.key}`, { name: entry.name[locale] })}
      </p>
      <div className="chc__stage" style={{ aspectRatio: aspect }}>
        <span className="chc__shadow" aria-hidden="true" />
        <div ref={body} className="chc__body" key={id}>
          {placed.map(({ item, p }) =>
            !p || p.z < 0 ? <Item key={item.id} item={item} placed={p} onAspect={setAspects} /> : null,
          )}
          {DRAWINGS.map((d) => (
            <img
              key={d}
              src={layerSrc(d)}
              onError={custom ? mine.onError : undefined}
              alt={d === drawing ? entry.name[locale] : ''}
              aria-hidden={d === drawing ? undefined : true}
              className="chc__layer"
              data-on={d === drawing}
              decoding="async"
            />
          ))}
          {skin ? (
            <span
              aria-hidden="true"
              className="chc__tint"
              data-skin={skin}
              style={{
                background: SKIN_SWATCH[skin],
                maskImage: `url(${drawn})`,
                WebkitMaskImage: `url(${drawn})`,
              }}
            />
          ) : null}
          {placed.map(({ item, p }) =>
            p && p.z >= 0 ? <Item key={item.id} item={item} placed={p} onAspect={setAspects} /> : null,
          )}
        </div>
      </div>
    </aside>
  );
};

// A worn item; until its image has loaded (and its aspect is known) it waits, hidden, to be placed.
const Item = ({
  item,
  placed,
  onAspect,
}: {
  item: AccessoryItem;
  placed: { left: number; top: number; width: number; height: number; z: number } | null;
  onAspect: (f: (a: Record<string, number>) => Record<string, number>) => void;
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`/roster/${item.art}`}
    alt=""
    aria-hidden="true"
    className="chc__item"
    data-item={item.id}
    decoding="async"
    onLoad={(e) => {
      const img = e.currentTarget;
      if (img.naturalWidth > 0) onAspect((a) => ({ ...a, [item.id]: img.naturalHeight / img.naturalWidth }));
    }}
    style={
      placed
        ? {
            left: `${placed.left * 100}%`,
            top: `${placed.top * 100}%`,
            width: `${placed.width * 100}%`,
            height: `${placed.height * 100}%`,
            zIndex: placed.z < 0 ? 0 : 2,
          }
        : { visibility: 'hidden', width: '10%' }
    }
  />
);
