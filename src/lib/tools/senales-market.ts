// Server side of Señales · Mercado: the pair a route may ask the engine
// about is one the engine lists (so a typo never reaches the engine as a
// 5xx that would count against the tool's health).

import 'server-only';
import { ToolRequestError } from './bff-core';
import { parsePair } from './senales-market-core';
import type { SenalesAdapter } from './adapters/tools';

const TTL_MS = 10 * 60_000;
const g = globalThis as unknown as { __chalybSenalesPairs?: { at: number; pairs: Set<string> } };

export async function knownPairs(
  a: SenalesAdapter,
  userId: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const c = g.__chalybSenalesPairs;
  if (c && Date.now() - c.at < TTL_MS && c.pairs.size) return c.pairs;
  const list = await a.markets(userId, 'bitunix', signal);
  const pairs = new Set(list.symbols.map((s) => s.symbol));
  if (pairs.size) g.__chalybSenalesPairs = { at: Date.now(), pairs };
  return pairs;
}

/** The pair from a route param, checked against the engine's list. */
export async function requirePair(
  a: SenalesAdapter,
  userId: string,
  raw: unknown,
  signal?: AbortSignal,
): Promise<string> {
  const pair = parsePair(raw);
  if (!pair) throw new ToolRequestError('pair');
  const known = await knownPairs(a, userId, signal);
  // An empty list means the venue's list couldn't be read: let the engine judge.
  if (known.size && !known.has(pair)) throw new ToolRequestError('pair');
  return pair;
}
