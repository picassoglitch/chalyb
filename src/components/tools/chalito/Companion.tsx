'use client';
// The companion on every Chalito screen (owner decision 2026-10-05): the picked character, or
// Chalito until there's a pick, doing something that fits the screen. Motion comes from the same
// AvatarDriver the room scene uses (bob, squash, lean, gaze toward the pointer), applied to the
// card's drawings with CSS instead of three.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AvatarDriver } from '@chalito/avatar-three/driver';
import { CreatureBinding } from '@chalito/avatar-three/creature';
import { EMOTION_DRAWING, DRAWINGS, placeItem, rosterEntry, type CardAnchors } from '@chalito/roster';
import { usePathname } from '@/lib/chalito/navigation';
import { useSettings } from '@/lib/chalito/useSettings';
import { useMyCard } from '@/lib/chalito/useMyCard';
import {
  COSMETIC_PLACEMENT,
  activityFor,
  companionOrDefault,
  useCompanionPick,
  useCompanionStep,
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

export const Companion = () => {
  const t = useTranslations('chalito.companion');
  const locale = useLocale() as AppLocale;
  const path = usePathname();
  const { values } = useSettings();
  const pick = useCompanionPick((s) => s.pick);
  const step = useCompanionStep((s) => s.step);

  const id = companionOrDefault(pick ?? values?.avatar);
  const entry = rosterEntry(id)!;
  const activity: Activity = step ?? activityFor(path);
  const drawing = EMOTION_DRAWING[activity.emotion];
  const rosterCard = useCard(id);
  // The person's own character ("Crea tu personaje"), when the companion wears one; its drawings
  // come from short-lived signed URLs (refreshed on error, then back to the roster art).
  const mine = useMyCard();
  const custom = mine.card;
  const card: CardJson | null = custom
    ? { width: custom.manifest.width, height: custom.manifest.height, anchors: (custom.manifest.anchors ?? {}) as CardAnchors }
    : rosterCard;
  const layerSrc = (d: string): string =>
    custom
      ? (custom.urls[custom.manifest.emotions.src[d] ?? custom.manifest.emotions.src.neutral!] ?? '')
      : `${base(id)}/layer-${d}.webp`;

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
    if (!el || reducedMotion()) return;
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
  }, [driver]);

  const cosmetic = activity.cosmetic && card ? COSMETIC_PLACEMENT[activity.cosmetic] : null;
  const placed =
    cosmetic && card ? placeItem(card.anchors, cosmetic.slot, cosmetic, cosmetic.aspect, card.height / card.width) : null;
  const aspect = card ? `${card.width} / ${card.height}` : '3 / 4';

  return (
    <aside className="chc" aria-label={t('aria', { name: entry.name[locale] })} data-companion={id} data-custom={custom ? 'true' : undefined} data-activity={activity.key}>
      <p className="chc__bubble" aria-live="polite" key={`${id}-${activity.key}`}>
        {t(`do.${activity.key}`, { name: entry.name[locale] })}
      </p>
      <div className="chc__stage" style={{ aspectRatio: aspect }}>
        <span className="chc__shadow" aria-hidden="true" />
        <div ref={body} className="chc__body" key={id}>
          {placed && placed.z < 0 ? <Item name={activity.cosmetic!} placed={placed} /> : null}
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
          {placed && placed.z >= 0 ? <Item name={activity.cosmetic!} placed={placed} /> : null}
        </div>
      </div>
    </aside>
  );
};

const Item = ({
  name,
  placed,
}: {
  name: string;
  placed: { left: number; top: number; width: number; height: number; z: number };
}) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={`/roster/cosmetics/${name}.webp`}
    alt=""
    aria-hidden="true"
    className="chc__item"
    style={{
      left: `${placed.left * 100}%`,
      top: `${placed.top * 100}%`,
      width: `${placed.width * 100}%`,
      height: `${placed.height * 100}%`,
      zIndex: placed.z < 0 ? 0 : 2,
    }}
  />
);
