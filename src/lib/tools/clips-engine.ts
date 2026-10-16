// Server helpers for the Clips screens that need the engine itself (mode
// "a"): streams, uploads, live, channels, styles, personas, admin pages.
//
//   const g = await loadClipsEngine(locale, '/app/clips/videos');
//   if (g.kind !== 'ready') return <ClipsGate gate={g} tab="history" />;
//   const res = await engineRead(g, (e, signal) => listStreams(e, 50, signal));
//
// Gate = loadTool (session, plan, risk, hand-off when mode is "off"), plus:
// mock mode has no engine, so these screens send the person to Clips' home.
// Reads go through runTool: 8 s timeout, retries, breaker, support code.

import 'server-only';
import { redirect } from '@/i18n/routing';
import { loadTool, type ToolGate } from './access';
import { getClipsAdapter, getClipsEngineAdapter } from './adapters/clips';
import type { ClipsEngineAdapter } from './adapters/clips/adapter';
import type { ClipsEngine } from './adapters/clips/client';
import type { ClipsAdapter } from './adapters/types';
import { runTool } from './bff';
import type { ToolResult } from './bff-core';

export const CLIPS_SLUG = 'chalybclip';

export type ClipsEngineGate =
  | Exclude<ToolGate<ClipsAdapter>, { kind: 'ready' }>
  | (Extract<ToolGate<ClipsAdapter>, { kind: 'ready' }> & {
      engineAdapter: ClipsEngineAdapter;
      engine: ClipsEngine;
    });

export async function loadClipsEngine(locale: string, path: string): Promise<ClipsEngineGate> {
  const gate = await loadTool(locale, CLIPS_SLUG, path, getClipsAdapter);
  if (gate.kind !== 'ready') return gate;
  const engineAdapter = getClipsEngineAdapter();
  if (!engineAdapter) return redirect({ href: '/app/clips', locale });
  return { ...gate, engineAdapter, engine: engineAdapter.engine(gate.session.user.id) };
}

/** An idempotent engine read for a page, with the BFF's guarantees. */
export function engineRead<T>(
  gate: { session: { user: { id: string } }; engine: ClipsEngine },
  op: (engine: ClipsEngine, signal: AbortSignal) => Promise<T>,
): Promise<ToolResult<T>> {
  return runTool(CLIPS_SLUG, gate.session.user.id, (signal) => op(gate.engine, signal), {
    idempotent: true,
    adapterErrorsOnly: true,
  });
}
