import { create } from 'zustand';
import { DEFAULT_COMPANION, rosterEntry, type RosterId } from '@chalito/roster';
import type { EmotionTag } from '@chalito/protocol';
import type { CompanionLook, StoreItem } from '@/lib/chalito/web/store';

/**
 * The companion on every Chalito screen: always the character the person picked (Chalito until
 * they pick), doing something that fits the screen, wearing only what the person put on in the
 * store (owner decision 2026-10-08: no per-screen props). Onboarding and Ajustes push a pick here the
 * moment it changes, so the character on screen follows before the setting is saved.
 */
export const useCompanionPick = create<{ pick: RosterId | null; setPick: (id: string | null | undefined) => void }>(
  (set) => ({
    pick: null,
    setPick: (id) => set({ pick: id && rosterEntry(id) ? (id as RosterId) : null }),
  }),
);

export const companionOrDefault = (id: string | null | undefined): RosterId =>
  id && rosterEntry(id) ? (id as RosterId) : DEFAULT_COMPANION;

export interface Activity {
  /** Key under chalito.companion for the line in its bubble. */
  key: string;
  emotion: EmotionTag;
  intensity: number;
  sleepy?: boolean;
}

const A = (key: string, emotion: EmotionTag, intensity = 0.8, extra: Partial<Activity> = {}): Activity => ({
  key,
  emotion,
  intensity,
  ...extra,
});

/** First match wins; paths are Chalito's own (no /app/chalito prefix). */
const ACTIVITIES: [RegExp, Activity][] = [
  [/^\/bandeja(\/|$)/, A('inbox', 'thinking')],
  [/^\/sesiones\/nueva(\/|$)/, A('newSession', 'excited', 1)],
  [/^\/sesiones(\/|$)/, A('sessions', 'happy')],
  [/^\/dispositivos(\/|$)/, A('devices', 'surprised', 0.7)],
  [/^\/vincular(\/|$)/, A('devices', 'surprised', 0.7)],
  [/^\/(salas|r)(\/|$)/, A('rooms', 'happy', 0.9)],
  [/^\/m(\/|$)/, A('mesas', 'relaxed')],
  [/^\/tienda(\/|$)/, A('store', 'excited', 0.9)],
  [/^\/creditos(\/|$)/, A('credits', 'excited', 1)],
  [/^\/uso(\/|$)/, A('usage', 'thinking', 0.8)],
  [/^\/conexiones(\/|$)/, A('connections', 'thinking', 0.6)],
  [/^\/ajustes(\/|$)/, A('settings', 'relaxed', 0.8)],
  [/^\/descargar(\/|$)/, A('download', 'excited', 0.8)],
  [/^\/a(\/|$)/, A('approval', 'worried', 0.6)],
  [/^\/(n|oauth)(\/|$)/, A('notice', 'surprised', 0.6)],
];

/**
 * Inicio shows the big companion (and its "Hablar con…" button) once settings are loaded, onboarding
 * is done and the browser isn't signed out. The floating companion steps aside on exactly that
 * condition, so Inicio always shows one, never two or none.
 */
export const homeHeroShown = (o: { settingsLoaded: boolean; onboarded: boolean; sessionStatus: string }): boolean =>
  o.settingsLoaded && o.onboarded && o.sessionStatus !== "signed_out";

/**
 * The floating companion steps aside on Inicio while the big one shows, and while settings aren't
 * the account's yet (so it doesn't flash). Signed out after onboarding there's no hero: it stays.
 */
export const floatingHidden = (o: {
  hero: boolean;
  activityKey: string;
  settled: boolean;
  settingsLoaded: boolean;
  onboarded: boolean;
  sessionStatus: string;
}): boolean => !o.hero && o.activityKey === 'home' && (!o.settled || homeHeroShown(o));

/** A live list may say "empty" / "not found": after its first full pull, or when it's offline. */
export const liveSettled = (o: { status: string; pulled: boolean }): boolean =>
  o.pulled || o.status === 'offline' || o.status === 'revoked';

const HOME = A('home', 'happy', 0.9);
const FALLBACK = A('idle', 'relaxed', 0.7);

/** What the companion does on a Chalito path; onboarding goes by step instead (see `onboardingActivity`). */
export const activityFor = (path: string): Activity => {
  if (path === '/' || path === '') return HOME;
  return ACTIVITIES.find(([re]) => re.test(path))?.[1] ?? FALLBACK;
};

/** Onboarding, step by step: hello on "Entra a tu cuenta", showing off while you pick, etc. */
export const onboardingActivity = (step: string, signedIn: boolean): Activity => {
  switch (step) {
    case 'signIn':
      return signedIn ? A('signedIn', 'excited', 1) : A('signIn', 'happy', 0.8);
    case 'companion':
      return A('pick', 'happy', 1);
    case 'name':
      return A('name', 'surprised', 0.8);
    case 'pair':
      return A('devices', 'surprised', 0.7);
    case 'passkey':
      return A('passkey', 'thinking', 0.7);
    default:
      return A('onboarding', 'happy', 0.8);
  }
};

/** Onboarding reports its step here so the layout's companion can follow it. */
export const useCompanionStep = create<{ step: Activity | null; setStep: (a: Activity | null) => void }>(
  (set) => ({ step: null, setStep: (step) => set({ step }) }),
);

/**
 * What the companion wears (its equipped cosmetics, and the catalog to draw them), shared by the
 * companion on every screen and the store: an equip in the store shows on the companion at once.
 * `items: null` keeps the catalog already loaded.
 */
export const useWornLook = create<{
  look: CompanionLook | null | 'error' | undefined;
  items: StoreItem[] | 'error' | undefined;
  set: (look: CompanionLook | null | 'error', items: StoreItem[] | 'error' | null) => void;
}>((set) => ({
  look: undefined,
  items: undefined,
  set: (look, items) => set((prev) => ({ look, items: items ?? prev.items })),
}));

/**
 * What the companion shows: the neutral stand-in until the person's character is known, then that
 * character, once. It never shows Chalito (or this device's leftover settings) on the way to the
 * real one: before this, signing in drew the default, then the device's pick, then the account's,
 * then the custom card, each for a moment.
 */
export type CompanionShown = { kind: 'pending' } | { kind: 'roster'; id: RosterId } | { kind: 'custom' };

/** What this browser showed last for an account (a per-device convenience, never authoritative). */
export type LastCompanion = { owner: string; kind: 'roster'; id: RosterId } | { owner: string; kind: 'custom' };

/** How long the companion waits for the custom card's answer before drawing the roster avatar. */
export const CARD_WAIT_MS = 5000;

export const companionShown = (o: {
  /** A pick made on this screen just now (onboarding, Ajustes): it shows at once. */
  pick: RosterId | null;
  /** The connection's status: until it's signed in (the hub bridge signs in), nothing is known. */
  status: string;
  /** The account's roster avatar, once the settings are the account's own (useSettings `settled`). */
  avatar: string | null | undefined;
  /** The custom card: unknown until the api answers (or CARD_WAIT_MS passes), then drawable or not. */
  card: 'unknown' | 'none' | 'custom';
  /** This browser's last look for this same account. */
  last: LastCompanion | null;
}): CompanionShown => {
  if (o.card === 'custom') return { kind: 'custom' };
  if (o.pick) return { kind: 'roster', id: o.pick };
  const signedIn = o.status !== 'loading' && o.status !== 'signed_out';
  if (signedIn && o.avatar !== undefined && o.card === 'none')
    return { kind: 'roster', id: companionOrDefault(o.avatar) };
  // Not known yet: a returning person sees last time's roster character straight away.
  return o.last?.kind === 'roster' ? { kind: 'roster', id: o.last.id } : { kind: 'pending' };
};

/** Whether `shown` is the account's settled look (worth remembering), not a guess from the cache. */
export const companionSettled = (o: Parameters<typeof companionShown>[0]): boolean =>
  o.card === 'custom' ||
  (o.status !== 'loading' && o.status !== 'signed_out' && o.avatar !== undefined && o.card === 'none');

const LAST_KEY = 'chalito.companion.last';

export const loadLastCompanion = (
  owner: string | undefined,
  storage: () => Pick<Storage, 'getItem'> = () => window.localStorage,
): LastCompanion | null => {
  if (!owner) return null;
  try {
    type Stored = Partial<{ owner: unknown; kind: unknown; id: unknown }> | null;
    const v = JSON.parse(storage().getItem(LAST_KEY) ?? 'null') as Stored;
    // Another account's look on a shared browser is never shown.
    if (!v || v.owner !== owner) return null;
    if (v.kind === 'custom') return { owner, kind: 'custom' };
    if (v.kind === 'roster' && typeof v.id === 'string' && rosterEntry(v.id))
      return { owner, kind: 'roster', id: v.id as RosterId };
    return null;
  } catch {
    return null;
  }
};

export const saveLastCompanion = (
  v: LastCompanion,
  storage: () => Pick<Storage, 'setItem'> = () => window.localStorage,
): void => {
  try {
    storage().setItem(LAST_KEY, JSON.stringify(v));
  } catch {
    // Blocked or full: next time it waits for the account instead.
  }
};

/**
 * The store's preview and swatches: the companion's roster avatar is already known there (its row),
 * only whether it wears a custom card isn't. Unknown: the roster avatar when last visit drew a
 * roster one for this account, else the stand-in, so it never shows the roster art and then swaps.
 */
export const storeLookShown = (o: {
  avatar: string;
  card: 'unknown' | 'none' | 'custom';
  last: LastCompanion | null;
}): CompanionShown => {
  if (o.card === 'custom') return { kind: 'custom' };
  if (o.card === 'none' || o.last?.kind === 'roster') return { kind: 'roster', id: companionOrDefault(o.avatar) };
  return { kind: 'pending' };
};
