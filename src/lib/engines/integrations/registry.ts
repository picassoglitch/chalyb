// Engine integration registry — lookup by slug.
//
// Built from definitions.ts rather than hand-maintained: an engine that is
// defined but not registered would fail provisioning at runtime with
// "no integration registered", which is exactly the kind of wiring mistake
// that should not be possible.

import 'server-only';
import { ENGINE_INTEGRATIONS } from './definitions';
import type { EngineIntegration } from './types';

const REGISTRY: Record<string, EngineIntegration> = Object.fromEntries(
  ENGINE_INTEGRATIONS.map((integration) => [integration.slug, integration]),
);

export function getIntegration(slug: string): EngineIntegration | null {
  return REGISTRY[slug] ?? null;
}

/** Every slug the hub can provision. Used by the admin reconcile sweep and
 *  worth having so "which engines are wired?" is answerable in one call. */
export function registeredSlugs(): string[] {
  return Object.keys(REGISTRY).sort();
}
