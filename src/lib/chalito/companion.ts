import { create } from 'zustand';
import { DEFAULT_COMPANION, rosterEntry, type RosterId } from '@chalito/roster';
import type { EmotionTag } from '@chalito/protocol';

/**
 * The companion on every Chalito screen: always the character the person picked (Chalito until
 * they pick), doing something that fits the screen. Onboarding and Ajustes push a pick here the
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

export type Cosmetic =
  | 'viking_hat'
  | 'flower_crown'
  | 'round_glasses'
  | 'star_cape'
  | 'sparkle_aura'
  | 'portal_swirl';

/** Where each cosmetic sits on a card (catalog.yaml `card`), its slot and image aspect (h ÷ w). */
export const COSMETIC_PLACEMENT: Record<
  Cosmetic,
  { slot: 'head' | 'face' | 'back' | 'aura' | 'portal_fx'; width: number; pivot: [number, number]; aspect: number }
> = {
  viking_hat: { slot: 'head', width: 0.5, pivot: [0.5, 0.95], aspect: 346 / 512 },
  flower_crown: { slot: 'head', width: 0.44, pivot: [0.5, 0.62], aspect: 474 / 512 },
  round_glasses: { slot: 'face', width: 0.36, pivot: [0.5, 0.5], aspect: 226 / 512 },
  star_cape: { slot: 'back', width: 0.72, pivot: [0.5, 0.12], aspect: 450 / 512 },
  sparkle_aura: { slot: 'aura', width: 1.1, pivot: [0.5, 0.5], aspect: 314 / 512 },
  portal_swirl: { slot: 'portal_fx', width: 1.0, pivot: [0.5, 0.5], aspect: 384 / 512 },
};

export interface Activity {
  /** Key under chalito.companion for the line in its bubble. */
  key: string;
  emotion: EmotionTag;
  intensity: number;
  cosmetic?: Cosmetic;
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
  [/^\/dispositivos(\/|$)/, A('devices', 'surprised', 0.7, { cosmetic: 'round_glasses' })],
  [/^\/vincular(\/|$)/, A('devices', 'surprised', 0.7, { cosmetic: 'round_glasses' })],
  [/^\/(salas|r)(\/|$)/, A('rooms', 'happy', 0.9, { cosmetic: 'portal_swirl' })],
  [/^\/m(\/|$)/, A('mesas', 'relaxed')],
  [/^\/tienda(\/|$)/, A('store', 'excited', 0.9, { cosmetic: 'viking_hat' })],
  [/^\/creditos(\/|$)/, A('credits', 'excited', 1, { cosmetic: 'sparkle_aura' })],
  [/^\/uso(\/|$)/, A('usage', 'thinking', 0.8, { cosmetic: 'round_glasses' })],
  [/^\/conexiones(\/|$)/, A('connections', 'thinking', 0.6)],
  [/^\/ajustes(\/|$)/, A('settings', 'relaxed', 0.8, { cosmetic: 'flower_crown' })],
  [/^\/descargar(\/|$)/, A('download', 'excited', 0.8, { cosmetic: 'star_cape' })],
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
      return A('devices', 'surprised', 0.7, { cosmetic: 'round_glasses' });
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
