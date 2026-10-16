// Which adapter each tool uses, from its TOOL_HUB_MODE_<SLUG> (flags.ts).
//   mock → the in-memory adapter (one per server process)
//   a    → the engine adapter: Señales (adapters/senales-engine.ts → ChalyCrypto
//          /api/hub/v1) and En vivo (adapters/envivo-engine.ts → ChalyOBS
//          /api/hub/v1) are real; the others are still a stub that throws
//          NOT_IMPLEMENTED until their engine's API exists (OPS-13)
//   b/off→ null: the screens hand off to the engine's app over SSO

import 'server-only';
import { clipsHubMode, toolHubMode, type ToolHubMode } from '@/lib/config/flags';
import { NotImplementedError, type EnVivoAdapter } from './adapters/tools';
import { createEngineEnVivo } from './adapters/envivo-engine';
import {
  createMockAsistente,
  createMockEnVivo,
  createMockInmuebles,
  createMockInversiones,
  createMockPronosticos,
  createMockSenales,
} from './adapters/mock-tools';
import { createEngineSenales } from './adapters/senales-engine';
import { runsInHub } from './hub-runs';

export const TOOL_SLUGS = {
  clips: 'chalybclip',
  senales: 'chalybcrypto',
  envivo: 'chalybobs',
  asistente: 'chalybbot',
  pronosticos: 'chalybpicks',
  inmuebles: 'chalybrealtor',
  inversiones: 'chalybtrade',
} as const;

const store = globalThis as unknown as { __chalybMocks?: Map<string, unknown> };

function mock<T>(slug: string, make: () => T): T {
  store.__chalybMocks ??= new Map();
  if (!store.__chalybMocks.has(slug)) store.__chalybMocks.set(slug, make());
  return store.__chalybMocks.get(slug) as T;
}

/** A stub whose every method throws: Mode A without a documented API. */
function stub<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_t, prop) => () => {
      throw new NotImplementedError(`${name}.${String(prop)}`);
    },
  });
}

function pick<T extends object>(
  slug: string,
  name: string,
  make: () => T,
  real?: () => T,
): T | null {
  const mode: ToolHubMode = toolHubMode(slug);
  if (mode === 'mock') return mock(slug, make);
  if (mode === 'a') return real ? real() : stub<T>(name);
  return null;
}

export const getSenales = () =>
  pick(TOOL_SLUGS.senales, 'SenalesAdapter', createMockSenales, createEngineSenales);
/** En vivo has a real engine adapter: mode a talks to ChalyOBS's hub API. */
export const getEnVivo = (): EnVivoAdapter | null => {
  const mode = toolHubMode(TOOL_SLUGS.envivo);
  if (mode === 'mock') return mock(TOOL_SLUGS.envivo, createMockEnVivo);
  if (mode === 'a') return createEngineEnVivo();
  return null;
};
export const getAsistente = () =>
  pick(TOOL_SLUGS.asistente, 'AsistenteAdapter', createMockAsistente);
export const getPronosticos = () =>
  pick(TOOL_SLUGS.pronosticos, 'PronosticosAdapter', createMockPronosticos);
export const getInmuebles = () =>
  pick(TOOL_SLUGS.inmuebles, 'InmueblesAdapter', createMockInmuebles);
export const getInversiones = () =>
  pick(TOOL_SLUGS.inversiones, 'InversionesAdapter', createMockInversiones);

/**
 * Whether the hub shows this tool's own screens. Clips has a real adapter.
 * Señales and En vivo run in-hub in mode "a" (engine adapters) or mock. For the
 * others, Mode A is a stub until the engine's API is documented (OPS-13),
 * so only the mock runs them in-hub today; otherwise the card leads to the
 * launch page as before. "off" is always the SSO hand-off (the rollback).
 */
export function hubRunsTool(slug: string): boolean {
  if (slug === TOOL_SLUGS.clips) return clipsHubMode() !== 'off';
  // Señales' and En vivo's mode a are real engine adapters, not stubs.
  return runsInHub(slug, toolHubMode(slug));
}
