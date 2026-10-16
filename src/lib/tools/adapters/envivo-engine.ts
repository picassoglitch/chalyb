// Server wiring for En vivo's engine adapter (envivo-engine-core.ts).
//
// Who: the verified hub session (getSessionUser) — the adapter refuses a user
// id that isn't the signed-in person's. Tenant: engine_subscriptions, the
// same row the SSO launch signs into its token; a person who never opened
// En vivo is provisioned here exactly like /auth/launch/chalybobs does.
// Where: CHALYBOBS_API_BASE (local development) or engines.external_url.

import 'server-only';
import { getSessionUser } from '@/lib/auth/session';
import { effectiveTier } from '@/lib/billing/tiers';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionEngineAccess } from '@/lib/engines/subscriptions';
import { createEngineEnVivoCore, EngineError, type EngineWho } from './envivo-engine-core';
import { EnVivoRefusal, type EnVivoAdapter } from './tools';

const SLUG = 'chalybobs';
const ENGINE_TTL_MS = 60_000;
const WHO_TTL_MS = 60_000;

type Cached<T> = { at: number; value: T };
const g = globalThis as unknown as {
  __chalybobsEngine?: Cached<{ id: string; base: string | null }>;
  __chalybobsWho?: Map<string, Cached<EngineWho>>;
};

export function engineSecret(): string | null {
  return process.env.CHALYBOBS_SSO_SECRET || null;
}

async function engineRow(): Promise<{ id: string; base: string | null }> {
  const hit = g.__chalybobsEngine;
  if (hit && Date.now() - hit.at < ENGINE_TTL_MS) return hit.value;
  const { data, error } = await createAdminClient()
    .from('engines')
    .select('id, external_url')
    .eq('slug', SLUG)
    .maybeSingle();
  if (error || !data) throw new EngineError(503);
  const value = { id: data.id as string, base: (data.external_url as string | null) ?? null };
  g.__chalybobsEngine = { at: Date.now(), value };
  return value;
}

/** The engine's base URL (no trailing slash). */
export async function engineBase(): Promise<string> {
  const override = process.env.CHALYBOBS_API_BASE?.trim();
  if (override) return override.replace(/\/+$/, '');
  const { base } = await engineRow();
  if (!base) throw new EngineError(503);
  return base.replace(/\/+$/, '');
}

async function who(userId: string): Promise<EngineWho> {
  g.__chalybobsWho ??= new Map();
  const hit = g.__chalybobsWho.get(userId);
  if (hit && Date.now() - hit.at < WHO_TTL_MS) return hit.value;

  const session = await getSessionUser();
  // Never act for anyone but the signed-in person.
  if (!session || session.user.id !== userId)
    throw new EnVivoRefusal('FORBIDDEN', 'session_mismatch');
  const tier = effectiveTier(session.role, session.tier);
  const { id: engineId } = await engineRow();
  const admin = createAdminClient();
  const { data } = await admin
    .from('engine_subscriptions')
    .select('external_user_id')
    .eq('user_id', userId)
    .eq('engine_id', engineId)
    .maybeSingle();
  let tenantId = (data?.external_user_id as string | null | undefined) ?? null;
  if (!tenantId) {
    // Same source rule as /auth/launch/[slug] for cross-engine launches.
    const res = await provisionEngineAccess(
      userId,
      engineId,
      tier === 'VIP' ? 'all_access_seed' : 'pro_selection',
    );
    tenantId = res.ok ? (res.externalUserId ?? null) : null;
  }
  if (!tenantId) throw new EngineError(503);
  const value: EngineWho = {
    userId,
    email: session.user.email ?? '',
    tenantId,
    tier: tier.toLowerCase(),
  };
  g.__chalybobsWho.set(userId, { at: Date.now(), value });
  return value;
}

export function createEngineEnVivo(): EnVivoAdapter {
  return createEngineEnVivoCore({
    secret: engineSecret,
    resolve: async (userId) => ({ base: await engineBase(), who: await who(userId) }),
  });
}
