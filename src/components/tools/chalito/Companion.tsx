'use client';
// The companion on every Chalito screen (owner decision 2026-10-05): the picked character, or
// Chalito until there's a pick, doing something that fits the screen, wearing only what the person
// put on in the store (owner decision 2026-10-08). Motion comes from the same
// AvatarDriver the room scene uses (breathing, lean, gaze toward the pointer), applied to the
// card's drawings with CSS instead of three.js. At rest it only breathes; it moves to show what the
// person's AI sessions are doing: busy while one runs, leaning in while an answer waits, a hop when
// one finishes, a slump when one fails (owner decision 2026-10-19). A card with a cutout rig
// (Chalito first) also moves its arms and head, blinks and talks. Until the person's character is
// known it is a neutral stand-in (or last visit's character, kept on this device): never other
// characters first.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AvatarDriver } from '@chalito/avatar-three/driver';
import { CreatureBinding } from '@chalito/avatar-three/creature';
import {
  ActivityTracker,
  activityActions,
  parseRig,
  rigSrcFor,
  type Activity as SessionActivity,
  type RigPart,
  type RigPose,
  type RigSpec,
} from '@chalito/avatar';
import { EMOTION_DRAWING, DRAWINGS, placeItem, rosterEntry, type CardAnchors } from '@chalito/roster';
import { useChalito, useLive } from '@/lib/chalito/provider';
import { isSkin, type AccessoryItem } from '@/lib/chalito/web/store';
import { SKIN_SWATCH } from '@/lib/chalito/skins';
import { usePathname } from '@/lib/chalito/navigation';
import { useSettings } from '@/lib/chalito/useSettings';
import { useOwnCard, useRememberLook } from '@/lib/chalito/useOwnLook';
import { useSession } from '@/lib/chalito/web/session';
import {
  companionOrDefault,
  activityFor,
  companionSettled,
  companionShown,
  floatingHidden,
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
  rig?: unknown;
}

/** Says hello once per visit (not on every screen change). */
let greeted = false;

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
  const { store, readCompanion, status } = useChalito();

  // The person's own character ("Crea tu personaje"), when the companion wears one; its drawings
  // come from short-lived signed URLs (refreshed on error, then back to the roster art).
  const { mine, card: cardState, last } = useOwnCard();
  const input = {
    pick,
    status,
    avatar: settled ? (values?.avatar ?? null) : undefined,
    card: cardState,
    last,
  };
  const shown = companionShown(input);
  const shownKey = useRememberLook(shown, companionSettled(input));

  // The roster avatar under a custom card is the account's (for its name); pending draws nothing.
  const id = shown.kind === 'roster' ? shown.id : companionOrDefault(values?.avatar);
  const entry = rosterEntry(id)!;
  const activity: Activity = step ?? activityFor(path);
  // A finished or failed session shows on its face for a moment.
  const [flash, setFlash] = useState<'happy' | 'sad' | null>(null);
  const drawing = flash ?? EMOTION_DRAWING[activity.emotion];
  const rosterCard = useCard(id);
  const custom = shown.kind === 'custom' ? mine.card : null;
  const card: CardJson | null = custom
    ? { width: custom.manifest.width, height: custom.manifest.height, anchors: (custom.manifest.anchors ?? {}) as CardAnchors }
    : rosterCard;
  const layerSrc = (d: string): string =>
    custom
      ? (custom.urls[custom.manifest.emotions.src[d] ?? custom.manifest.emotions.src.neutral!] ?? '')
      : `${base(id)}/layer-${d}.webp`;
  const session = useSession();
  const hidden = floatingHidden({
    hero,
    activityKey: activity.key,
    settled,
    settingsLoaded: !!values,
    onboarded,
    sessionStatus: session.status,
  });
  const pending = shown.kind === 'pending';

  // What it wears: loaded once here (the store keeps it current after an equip).
  const look = useWornLook((s) => s.look);
  const items = useWornLook((s) => s.items);
  useEffect(() => {
    if (!store || !readCompanion || useWornLook.getState().look !== undefined) return;
    let live = true;
    Promise.all([readCompanion(), store.catalog()]).then(
      ([l, c]) => live && useWornLook.getState().look === undefined && useWornLook.getState().set(l, c),
      // Unreadable now: it wears nothing until a later mount (or the store) loads it.
      () => undefined,
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
  // The cutout rig (roster cards that have one); a skin tints the one flat drawing instead.
  const rig: RigSpec | null = useMemo(
    () => (!custom && !skin && rosterCard ? parseRig(rosterCard.rig) : null),
    [custom, skin, rosterCard],
  );
  const parts = useRef<Partial<Record<RigPart['id'], HTMLDivElement | null>>>({});

  const body = useRef<HTMLDivElement>(null);
  const driver = useMemo(() => new AvatarDriver({ seed: 7 }), []);

  // What the person's sessions are doing (the first look only learns, see ActivityTracker).
  const live = useLive();
  const tracker = useMemo(() => new ActivityTracker(), []);
  const lastActivity = useRef<SessionActivity | null>(null);
  useEffect(() => {
    const pending = live.approvals.filter((a) => a.status === 'pending').length;
    const act = tracker.update(live.sessions, pending);
    driver.setMode(act.mode);
    const now = performance.now();
    for (const a of activityActions(lastActivity.current, act)) {
      driver.playAction(a, now);
      setFlash(a === 'hop' ? 'happy' : 'sad');
    }
    lastActivity.current = act;
  }, [driver, tracker, live.sessions, live.approvals]);
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), flash === 'happy' ? 2500 : 3500);
    return () => clearTimeout(id);
  }, [flash]);
  useEffect(() => {
    if (greeted || hidden || pending) return;
    greeted = true;
    driver.playGesture('wave', performance.now());
  }, [driver, hidden, pending]);

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
      const frame = driver.frame(now);
      binding.apply(frame);
      applyRig(parts.current, frame.rig, el.offsetHeight);
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
          {rig ? (
            <RigParts
              rig={rig}
              base={base(id)}
              drawing={drawing}
              alt={entry.name[locale]}
              refs={parts.current}
              headItems={placed.map(({ item, p }) =>
                p && p.z >= 0 && rides(item) ? <Item key={item.id} item={item} placed={p} onAspect={setAspects} /> : null,
              )}
            />
          ) : (
            DRAWINGS.map((d) => (
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
            ))
          )}
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
            p && p.z >= 0 && !(rig && rides(item)) ? (
              <Item key={item.id} item={item} placed={p} onAspect={setAspects} />
            ) : null,
          )}
        </div>
      </div>
    </aside>
  );
};

/** Hats and glasses ride on a rigged head. */
const rides = (item: AccessoryItem) => item.slot === 'head' || item.slot === 'face';

/**
 * Turns the rig's parts: arms about their shoulders, the head about the neck (eyelids and mouth
 * ride on it), eyelids shown while closed, the mouth opened with the voice. CSS turns clockwise,
 * the pose's head tilt anticlockwise (as three.js).
 */
const applyRig = (els: Partial<Record<RigPart['id'], HTMLDivElement | null>>, pose: RigPose, h: number) => {
  if (els.armL) els.armL.style.transform = `rotate(${pose.armL.toFixed(2)}deg)`;
  if (els.armR) els.armR.style.transform = `rotate(${(-pose.armR).toFixed(2)}deg)`;
  if (els.head)
    els.head.style.transform = `translateY(${(pose.headDrop * h).toFixed(2)}px) rotate(${(-pose.head).toFixed(2)}deg)`;
  if (els.lids) els.lids.style.opacity = pose.lids > 0.5 ? '1' : '0';
  if (els.mouth) {
    els.mouth.style.opacity = pose.mouth > 0.08 ? '1' : '0';
    els.mouth.style.transform = `scale(${(0.8 + 0.2 * pose.mouth).toFixed(3)}, ${(0.3 + 0.7 * pose.mouth).toFixed(3)})`;
  }
};

/** The rig's parts as nested layers: each one turns about its pivot; children sit in their parent. */
const RigParts = ({
  rig,
  base: dir,
  drawing,
  alt,
  refs,
  headItems,
}: {
  rig: RigSpec;
  base: string;
  drawing: string;
  alt: string;
  refs: Partial<Record<RigPart['id'], HTMLDivElement | null>>;
  headItems: ReactNode;
}) => {
  const layer = (part: RigPart): ReactNode => {
    const srcs = typeof part.src === 'string' ? { [drawing]: part.src } : part.src;
    const shown = rigSrcFor(part, drawing);
    const children = rig.parts.filter((c) => c.parent === part.id).sort((a, b) => a.z - b.z);
    return (
      <div
        key={part.id}
        ref={(el) => {
          refs[part.id] = el;
        }}
        className="chc__part"
        data-part={part.id}
        style={{ transformOrigin: `${part.pivot[0] * 100}% ${part.pivot[1] * 100}%`, zIndex: 1 + part.z }}
      >
        {[...new Set(Object.values(srcs))].map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={`${dir}/${src}`}
            alt={part.id === 'body' ? alt : ''}
            aria-hidden={part.id === 'body' ? undefined : true}
            className="chc__layer"
            data-on={src === shown}
            decoding="async"
          />
        ))}
        {children.map(layer)}
        {part.id === 'head' ? <div className="chc__part chc__part--items">{headItems}</div> : null}
      </div>
    );
  };
  return <>{rig.parts.filter((p) => !p.parent).sort((a, b) => a.z - b.z).map(layer)}</>;
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
