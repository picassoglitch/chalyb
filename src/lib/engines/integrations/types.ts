// Generic interface every engine integration implements. Drop in a new
// engine = write a file that exports an `EngineIntegration` with the right
// slug, register it in registry.ts, set the DB row's integration_mode +
// external_url + requires_provisioning, done.

import type { SubscriptionTier } from '@/lib/auth/session';
import type { Engine } from '@/lib/data/types';

export interface ProvisionInput {
  /** Chalyb user id — stable, primary key for cross-system identification. */
  userId: string;
  /** User's email — engines typically need this for their own user record. */
  email: string;
  /** Display name from auth metadata. May be null. */
  fullName: string | null;
  /** Effective tier (admin override applied). Engines that have their own
   *  tier concept (ChalybClip's watermark, etc.) write this on the engine-side
   *  tenant record. Always pass effective, never stored — admin = VIP
   *  regardless of profiles.tier. */
  effectiveTier: SubscriptionTier;
  /** The Engine row (so the integration can read its own admin_api_base, etc.). */
  engine: Engine;
}

export interface ProvisionResult {
  ok: boolean;
  /** Engine's internal user/tenant id (e.g. ChalybClip's `ten_...` ULID).
   *  Stored in engine_subscriptions.external_user_id. */
  externalUserId?: string;
  /** Secrets needed for later calls (api token, etc.). Stored in
   *  engine_subscriptions.external_credentials (jsonb). Never logged or
   *  exposed to client components. */
  credentials?: Record<string, unknown>;
  /** Machine-readable error reason. */
  reason?: 'not_configured' | 'engine_error' | 'auth_error' | 'duplicate' | 'network';
  /** Human-readable error for logs / admin debugging. */
  error?: string;
}

export interface LaunchTokenInput {
  /** Same identity bundle as provisioning. */
  userId: string;
  email: string;
  /** Effective tier, signed into the SSO token so the engine can sync its
   *  own tier column on login. Carries admin override (admin = VIP). */
  effectiveTier: SubscriptionTier;
  /** The provisioned external user id from engine_subscriptions row. May be
   *  null if provisioning never ran — integration should bail in that case. */
  externalUserId: string | null;
  /** Credentials blob persisted at provisioning time. */
  credentials: Record<string, unknown> | null;
  engine: Engine;
}

export interface LaunchTokenResult {
  ok: boolean;
  /** Fully-formed URL the browser should navigate to. Includes any signed
   *  token query params the engine needs to validate the session. */
  url?: string;
  reason?: 'not_provisioned' | 'not_configured' | 'engine_error';
  error?: string;
}

export interface PauseInput {
  userId: string;
  externalUserId: string;
  engine: Engine;
}

export interface PauseResult {
  ok: boolean;
  reason?: 'not_configured' | 'engine_error' | 'auth_error' | 'network';
  error?: string;
}

export interface EngineIntegration {
  /** Matches the `slug` column in the engines table. */
  slug: string;

  /** Called when a user activates the engine (Pro selection, VIP seed,
   *  admin grant, or paid MP upgrade). Should be idempotent — if the user is
   *  already provisioned in the external engine, return the existing identity
   *  rather than creating a duplicate. */
  provision(input: ProvisionInput): Promise<ProvisionResult>;

  /** Called when the user clicks "Abrir engine →". Returns the URL Chalyb
   *  should redirect/window.open to, including any signed auth token. */
  buildLaunchUrl(input: LaunchTokenInput): Promise<LaunchTokenResult>;

  /** Pause this tenant on the engine side. Called when a PRO user switches
   *  their live engine selection — the previous engine should stop running
   *  jobs / publishing / spending tokens for this user. Idempotent. */
  pause(input: PauseInput): Promise<PauseResult>;

  /** Resume a previously-paused tenant. Called when the user activates this
   *  engine again (PRO swap back, or VIP upgrade after pause). */
  resume(input: PauseInput): Promise<PauseResult>;
}
