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
