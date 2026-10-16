// Who the hub is when it calls an engine's API for a person.
//
// Same identity the "Abrir" launch signs (launch-actions.ts): the engine
// row's base URL, the person's engine tenant (engine_subscriptions
// .external_user_id, provisioned inline when missing — the engine treats a
// repeat as 409 = success), their email and the effective tier (admins
// present as VIP). Access itself is decided BEFORE this runs (loadTool /
// toolRoute → getEntitlements); this only answers "as whom".
//
// Cached per server process for a short time: a page render makes several
// engine calls and each would otherwise re-read three tables.

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadBilling } from '@/lib/billing/subscription-store';
import { tierAfterExpiry } from '@/lib/billing/subscription-period';
import type { SubscriptionTier, UserRole } from '@/lib/auth/session';
import { provisionEngineAccess } from './subscriptions';
import { engineTierOf } from './engine-tier';

export interface EngineIdentity {
  userId: string;
  email: string;
  tenantId: string;
  /** Lowercase, as the engines' tenants.tier columns take it. */
  tier: string;
  /** No trailing slash. */
  baseUrl: string;
}

export class EngineIdentityError extends Error {
  readonly code = 'ENGINE_NOT_CONFIGURED';
  constructor(
    readonly why: 'no_engine' | 'no_base_url' | 'no_profile' | 'provision_failed',
    detail?: string,
  ) {
    super(`engine identity: ${why}${detail ? ` (${detail})` : ''}`);
  }
}

const TTL_MS = 30_000;
const store = globalThis as unknown as {
  __chalybEngineIds?: Map<string, { at: number; id: EngineIdentity }>;
};
const cache = () => (store.__chalybEngineIds ??= new Map());

/** Drop a cached identity (e.g. after the engine answered 401). */
export function forgetEngineIdentity(slug: string, userId: string): void {
  cache().delete(`${slug}:${userId}`);
}

/**
 * Resolve the identity for `userId` at `slug`'s engine. `baseUrlEnv` (e.g.
 * CHALYBCLIP_API_BASE) overrides engines.external_url — useful when the API
 * lives on the Cloud Run URL while external_url is the public domain.
 */
export async function resolveEngineIdentity(
  slug: string,
  userId: string,
  opts: { baseUrlEnv?: string } = {},
): Promise<EngineIdentity> {
  const key = `${slug}:${userId}`;
  const hit = cache().get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.id;

  const admin = createAdminClient();
  const [{ data: engine }, { data: profile }] = await Promise.all([
    admin.from('engines').select('id, external_url').eq('slug', slug).maybeSingle(),
    admin.from('profiles').select('email, role, tier, tier_ends_at').eq('id', userId).maybeSingle(),
  ]);
  if (!engine) throw new EngineIdentityError('no_engine', slug);
  if (!profile?.email) throw new EngineIdentityError('no_profile');

  const override = opts.baseUrlEnv ? process.env[opts.baseUrlEnv] : undefined;
  const baseUrl = (override || (engine.external_url as string | null) || '').replace(/\/+$/, '');
  if (!baseUrl) throw new EngineIdentityError('no_base_url', slug);

  const { data: sub } = await admin
    .from('engine_subscriptions')
    .select('external_user_id, source')
    .eq('user_id', userId)
    .eq('engine_id', engine.id as string)
    .maybeSingle();
  let tenantId = (sub?.external_user_id as string | null) ?? null;
  if (!tenantId) {
    const source = (sub?.source as string | undefined) ?? 'manual';
    const res = await provisionEngineAccess(
      userId,
      engine.id as string,
      source as Parameters<typeof provisionEngineAccess>[2],
    );
    if (!res.ok || !res.externalUserId)
      throw new EngineIdentityError(
        'provision_failed',
        res.ok ? 'no tenant id returned' : res.reason,
      );
    tenantId = res.externalUserId;
  }

  const billing = await loadBilling(userId).catch(() => null);
  const id: EngineIdentity = {
    userId,
    email: profile.email as string,
    tenantId,
    // The effective plan the hub's screens use: a lapsed profile tier is FREE, but an active
    // subscription grant (payment grace) still counts; admins are VIP.
    tier: engineTierOf({
      role: (profile.role as UserRole | undefined) ?? 'VIEWER',
      storedTier: tierAfterExpiry(
        (profile.tier as SubscriptionTier | undefined) ?? 'FREE',
        profile.tier_ends_at as string | null,
      ),
      grantsTier: billing?.primary?.grantsTier ?? null,
      paidSuspended: billing?.restriction.paidSuspended ?? false,
    }).toLowerCase(),
    baseUrl,
  };
  cache().set(key, { at: Date.now(), id });
  return id;
}
