// Which adapter each tool uses, from its TOOL_HUB_MODE_<SLUG> (flags.ts).
//   mock → the in-memory adapter (one per server process)
//   a    → the engine adapter: Señales has a real one (adapters/senales-engine.ts,
//          the engine's /api/hub/v1); the others are still a stub that throws
//          NOT_IMPLEMENTED until their engine's API exists (OPS-13)
//   b/off→ null: the screens hand off to the engine's app over SSO

import 'server-only';
import { clipsHubMode, toolHubMode, type ToolHubMode } from '@/lib/config/flags';
import { NotImplementedError } from './adapters/tools';
import {
  createMockAsistente,
  createMockEnVivo,
  createMockInmuebles,
  createMockInversiones,
  createMockPronosticos,
  createMockSenales,
} from './adapters/mock-tools';
import { createEngineSenales } from './adapters/senales-engine';

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

/** Engine adapters that exist (mode "a" renders in-hub for these). */
const REAL_ADAPTERS = new Set<string>([TOOL_SLUGS.senales]);

export const getSenales = () =>
  pick(TOOL_SLUGS.senales, 'SenalesAdapter', createMockSenales, createEngineSenales);
export const getEnVivo = () => pick(TOOL_SLUGS.envivo, 'EnVivoAdapter', createMockEnVivo);
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
 * Señales runs in-hub in mode "a" (its engine adapter) or mock. For the
 * others, Mode A is a stub until the engine's API is documented (OPS-13),
 * so only the mock runs them in-hub today; otherwise the card leads to the
 * launch page as before. "off" is always the SSO hand-off (the rollback).
 */
export function hubRunsTool(slug: string): boolean {
  if (slug === TOOL_SLUGS.clips) return clipsHubMode() !== 'off';
  const mode = toolHubMode(slug);
  return mode === 'mock' || (mode === 'a' && REAL_ADAPTERS.has(slug));
}
