// Builds an EngineIntegration from a small config object.
//
// WHY: chalybclip.ts, chalybobs.ts and chalybcrypto.ts were ~197 lines of
// executable code each and differed by FIVE lines — the post-SSO path and the
// env-var prefix. Every new agent meant copying 250 lines and hoping the copy
// stayed in sync. A fix to the 409-duplicate handling had to be made three
// times, and the stale comments across those files showed it was not happening.
//
// Adding an agent is now one entry in definitions.ts.
//
// THE CONTRACT an engine must expose to be driven by this factory:
//
//   POST {admin_api_base}/tenants
//     Headers:  Authorization: Bearer <ADMIN_TOKEN>
//     Body:     { external_user_id, email, display_name, tier }
//     Returns:  { tenant_id, api_token }                   (200 / 201)
//               { error: 'duplicate', tenant_id, api_token } (409 — success)
//
//   POST {admin_api_base}/tenants/{tenant_id}/status
//     Body:     { status: 'active' | 'paused' }
//     Returns:  200 / 204
//
//   GET {external_url}/auth/sso?token=<hmac>&next=<relative path>
//     Engine verifies the HMAC, sets its session cookie, redirects to `next`.
//     `next` MUST be rejected if absolute or off-origin — otherwise /auth/sso
//     is an open redirect.
//
// An engine that cannot meet this contract writes its own module implementing
// EngineIntegration directly and registers that instead; the factory is the
// common case, not a straitjacket.

import 'server-only';
import { createHmac } from 'node:crypto';
import type {
  EngineIntegration,
  LaunchTokenInput,
  LaunchTokenResult,
  PauseInput,
  PauseResult,
  ProvisionInput,
  ProvisionResult,
} from './types';

export interface EngineIntegrationConfig {
  /** Matches engines.slug. Also derives the env-var prefix. */
  slug: string;

  /** Human-readable name used in error messages and admin logs. */
  displayName: string;

  /** Where a fresh SSO login should land, as a RELATIVE same-origin path.
   *  Sent as `next`. Omit when the engine's own /auth/sso decides — ChalybOBS
   *  and ChalybCrypto do, ChalybClip wants /dashboard/start. */
  postSsoPath?: string;

  /** Launch-token lifetime. Long enough to redirect, short enough that an
   *  intercepted token is not useful. */
  ssoTtlSeconds?: number;

  /** Override the env-var prefix. Defaults to the slug uppercased, which is
   *  the convention: CHALYBCLIP_ADMIN_TOKEN, CHALYBCLIP_SSO_SECRET. */
  envPrefix?: string;
}

const DEFAULT_SSO_TTL_SECONDS = 300;

export function createEngineIntegration(config: EngineIntegrationConfig): EngineIntegration {
  const {
    slug,
    displayName,
    postSsoPath,
    ssoTtlSeconds = DEFAULT_SSO_TTL_SECONDS,
    envPrefix = slug.toUpperCase(),
  } = config;

  const adminTokenVar = `${envPrefix}_ADMIN_TOKEN`;
  const ssoSecretVar = `${envPrefix}_SSO_SECRET`;

  // Read at call time, not module load: Next.js evaluates modules during the
  // build, when Vercel's runtime env is not yet populated. Caching these at
  // import would bake in `undefined`.
  const adminToken = () => process.env[adminTokenVar] ?? null;
  const ssoSecret = () => process.env[ssoSecretVar] ?? null;

  /** HMAC-SHA256 over the base64url payload. The engine verifies with the
   *  same shared secret before creating a session. */
  function signLaunchToken(payload: {
    user_id: string;
    email: string;
    tenant_id: string;
    tier: string;
    exp: number;
  }): string {
    const secret = ssoSecret();
    if (!secret) throw new Error(`${ssoSecretVar} not configured`);
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  async function setTenantStatus(
    { externalUserId, engine }: PauseInput,
    status: 'active' | 'paused',
  ): Promise<PauseResult> {
    if (!engine.adminApiBase) {
      return { ok: false, reason: 'not_configured', error: `${displayName} admin_api_base not set` };
    }
    const token = adminToken();
    if (!token) {
      return { ok: false, reason: 'not_configured', error: `${adminTokenVar} missing` };
    }
    if (!externalUserId) {
      return {
        ok: false,
        reason: 'engine_error',
        error: 'tenant_id missing on engine_subscriptions row',
      };
    }

    let response: Response;
    try {
      response = await fetch(
        `${engine.adminApiBase}/tenants/${encodeURIComponent(externalUserId)}/status`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      );
    } catch (err) {
      return {
        ok: false,
        reason: 'network',
        error: err instanceof Error ? err.message : 'fetch failed',
      };
    }

    if (response.status === 200 || response.status === 204) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'auth_error', error: `${displayName} rejected admin token` };
    }
    if (response.status === 404) {
      // Not on the engine side — likely never provisioned. Nothing to pause;
      // but resuming a tenant that does not exist is a real failure.
      return status === 'paused'
        ? { ok: true }
        : { ok: false, reason: 'engine_error', error: `Tenant not found on ${displayName}` };
    }
    const errText = await response.text().catch(() => '');
    return {
      ok: false,
      reason: 'engine_error',
      error: `${displayName} ${response.status}: ${errText.slice(0, 200)}`,
    };
  }

  return {
    slug,

    async provision({
      userId,
      email,
      fullName,
      effectiveTier,
      engine,
    }: ProvisionInput): Promise<ProvisionResult> {
      if (!engine.adminApiBase) {
        return {
          ok: false,
          reason: 'not_configured',
          error: `${displayName} admin_api_base not set`,
        };
      }
      const token = adminToken();
      if (!token) {
        return { ok: false, reason: 'not_configured', error: `${adminTokenVar} missing` };
      }

      let response: Response;
      try {
        response = await fetch(`${engine.adminApiBase}/tenants`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Chalyb's user_id is the external_user_id on the engine side, so
            // the link is bidirectional and duplicates are detectable.
            external_user_id: userId,
            email,
            display_name: fullName ?? email.split('@')[0],
            // Lowercase ('free' | 'pro' | 'vip') — what the engines' tenants.tier
            // columns accept.
            tier: effectiveTier.toLowerCase(),
          }),
        });
      } catch (err) {
        return {
          ok: false,
          reason: 'network',
          error: err instanceof Error ? err.message : 'fetch failed',
        };
      }

      // 409 means the tenant already exists — that is success. Admin re-grants
      // and provisioning retries both land here.
      if (response.status === 409 || response.status === 200 || response.status === 201) {
        try {
          const data = (await response.json()) as {
            tenant_id?: string;
            api_token?: string;
            error?: string;
          };
          if (!data.tenant_id || !data.api_token) {
            return {
              ok: false,
              reason: 'engine_error',
              error: `${displayName} response missing fields`,
            };
          }
          return {
            ok: true,
            externalUserId: data.tenant_id,
            credentials: { api_token: data.api_token },
          };
        } catch {
          return {
            ok: false,
            reason: 'engine_error',
            error: `${displayName} returned invalid JSON`,
          };
        }
      }

      if (response.status === 401 || response.status === 403) {
        return { ok: false, reason: 'auth_error', error: `${displayName} rejected admin token` };
      }

      const errText = await response.text().catch(() => '');
      return {
        ok: false,
        reason: 'engine_error',
        error: `${displayName} ${response.status}: ${errText.slice(0, 200)}`,
      };
    },

    async buildLaunchUrl({
      userId,
      email,
      effectiveTier,
      externalUserId,
      engine,
    }: LaunchTokenInput): Promise<LaunchTokenResult> {
      if (!engine.externalUrl) {
        return { ok: false, reason: 'not_configured', error: `${displayName} external_url not set` };
      }
      if (!externalUserId) {
        return {
          ok: false,
          reason: 'not_provisioned',
          error: `User has not been provisioned in ${displayName} yet`,
        };
      }
      if (!ssoSecret()) {
        return { ok: false, reason: 'not_configured', error: `${ssoSecretVar} missing` };
      }

      let token: string;
      try {
        token = signLaunchToken({
          user_id: userId,
          email,
          tenant_id: externalUserId,
          tier: effectiveTier.toLowerCase(),
          exp: Math.floor(Date.now() / 1000) + ssoTtlSeconds,
        });
      } catch (err) {
        return {
          ok: false,
          reason: 'not_configured',
          error: err instanceof Error ? err.message : 'sign failed',
        };
      }

      const base = `${engine.externalUrl}/auth/sso?token=${encodeURIComponent(token)}`;
      const url = postSsoPath ? `${base}&next=${encodeURIComponent(postSsoPath)}` : base;
      return { ok: true, url };
    },

    async pause(input: PauseInput): Promise<PauseResult> {
      return setTenantStatus(input, 'paused');
    },

    async resume(input: PauseInput): Promise<PauseResult> {
      return setTenantStatus(input, 'active');
    },
  };
}
