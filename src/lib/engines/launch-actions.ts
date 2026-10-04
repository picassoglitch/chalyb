'use server';

// Server action behind every "Abrir" button: checks access, creates the user's
// account at the engine if it is missing, and returns the signed SSO URL.
//
// The order of those steps lives in launch-flow.ts (pure, unit-tested); this
// file only wires the database, the integration registry and the audit log
// into it. The client receives `{ ok: true, url }` or `{ ok: false, code }` —
// never an error string (see lib/errors/customer-errors.ts).

import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveTier } from '@/lib/billing/tiers';
import { getEntitlements } from '@/lib/billing/entitlement';
import { logAudit } from '@/lib/audit/log';
import type { Engine } from '@/lib/data/types';
import { getIntegration } from './integrations/registry';
import { provisionEngineAccess } from './subscriptions';
import { runLaunch, type LaunchResult, type LaunchLogEvent } from './launch-flow';
import { hasRiskAck } from '@/lib/tools/consents';
import { sanitizeLaunchForward, type LaunchForward } from './launch-forward';

export type { LaunchResult } from './launch-flow';

export async function getEngineLaunchUrl(
  engineId: string,
  forward?: LaunchForward,
): Promise<LaunchResult> {
  // A server action's arguments come from the browser: validate again.
  const { next, state } = sanitizeLaunchForward(forward);
  const session = await getSessionUser();
  if (!session) return { ok: false, code: 'SESSION_EXPIRED' };

  const admin = createAdminClient();
  const userId = session.user.id;
  const actorEmail = session.user.email ?? null;
  const entitlements = await getEntitlements(session);

  let engineForIntegration: Engine | null = null;

  function log(event: LaunchLogEvent) {
    const line = `[launch] ${event.slug} ${event.outcome}${event.code ? ` ${event.code}` : ''}`;
    if (event.outcome === 'launched' || event.outcome === 'provisioned') console.info(line);
    else console.error(line, event.detail ?? '');
    if (event.outcome === 'launched') return;
    void logAudit({
      action: event.outcome === 'refused' ? 'engine.launch' : 'engine.provision',
      actorId: userId,
      actorEmail,
      targetUserId: userId,
      // The slug and a status code only: no tokens, no engine response body.
      metadata: { slug: event.slug, outcome: event.outcome, code: event.code ?? null },
    });
  }

  return runLaunch({
    defaultSource: entitlements.isAdmin ? 'admin_grant' : 'manual',
    log,
    toolAccess: (slug) => entitlements.tools[slug] ?? null,
    riskAcked: (slug) => hasRiskAck(userId, slug),

    async loadEngine() {
      const { data } = await admin
        .from('engines')
        .select(
          'id, slug, name, external_url, integration_mode, admin_api_base, requires_provisioning',
        )
        .eq('id', engineId)
        .maybeSingle();
      if (!data) return null;
      // The integration only reads these fields.
      engineForIntegration = {
        id: data.id as string,
        slug: data.slug as string,
        name: data.name as string,
        externalUrl: data.external_url as string | null,
        adminApiBase: data.admin_api_base as string | null,
        integrationMode: data.integration_mode as Engine['integrationMode'],
        requiresProvisioning: data.requires_provisioning as boolean,
      } as Engine;
      return {
        id: data.id as string,
        slug: data.slug as string,
        externalUrl: data.external_url as string | null,
        integrationMode: data.integration_mode as string,
        requiresProvisioning: Boolean(data.requires_provisioning),
      };
    },

    async loadAccessRow() {
      const { data } = await admin
        .from('engine_subscriptions')
        .select('external_user_id, source')
        .eq('user_id', userId)
        .eq('engine_id', engineId)
        .maybeSingle();
      if (!data) return null;
      return {
        externalUserId: (data.external_user_id as string | null) ?? null,
        source: data.source as string,
      };
    },

    async provision(source) {
      // Upserts on the (user_id, engine_id) unique key from migration 0011, so
      // two concurrent clicks converge on one row; the engine treats a repeat
      // tenant create as 409 = success, so they converge on one account too.
      const result = await provisionEngineAccess(
        userId,
        engineId,
        source as Parameters<typeof provisionEngineAccess>[2],
      );
      if (!result.ok) return { ok: false, reason: result.reason, error: result.error };
      return { ok: true, externalUserId: result.externalUserId ?? null };
    },

    async buildUrl(externalUserId) {
      const engine = engineForIntegration;
      if (!engine) return { ok: false, reason: 'not_configured' };
      const integration = getIntegration(engine.slug);
      if (!integration) return { ok: false, reason: 'no_integration' };
      const { data: row } = await admin
        .from('engine_subscriptions')
        .select('external_credentials')
        .eq('user_id', userId)
        .eq('engine_id', engineId)
        .maybeSingle();
      const result = await integration.buildLaunchUrl({
        userId,
        email: session.user.email ?? '',
        // Admins present as VIP to the engine, whatever profiles.tier says.
        effectiveTier: effectiveTier(session.role, session.tier),
        externalUserId,
        credentials: (row?.external_credentials as Record<string, unknown> | null) ?? null,
        engine,
        next,
        state,
      });
      return result.ok && result.url
        ? { ok: true, url: result.url }
        : { ok: false, reason: result.reason, error: result.error };
    },
  });
}
