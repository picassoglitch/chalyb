'use server';

// Server action that builds the engine launch URL (with signed SSO token
// when applicable) and returns it to the client. Client then does
// `window.location.href = url` or window.open() in a new tab.
//
// Separated from the workspace page so we can call it from a button click
// without re-fetching the whole engine + access record on the client.

import { getSessionUser } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveTier as computeEffectiveTier } from '@/lib/billing/tiers';
import { getIntegration } from './integrations/registry';

interface LaunchResult {
  ok: boolean;
  url?: string;
  reason?: 'not_authed' | 'engine_not_found' | 'no_access' | 'not_configured' | 'integration_failed';
  error?: string;
}

export async function getEngineLaunchUrl(engineId: string): Promise<LaunchResult> {
  const session = await getSessionUser();
  if (!session) return { ok: false, reason: 'not_authed', error: 'No autenticado' };

  const admin = createAdminClient();

  // Pull engine + the user's access record in parallel.
  const [{ data: engineRow }, { data: accessRow }] = await Promise.all([
    admin
      .from('engines')
      .select(
        'id, slug, name, external_url, integration_mode, admin_api_base, requires_provisioning',
      )
      .eq('id', engineId)
      .maybeSingle(),
    admin
      .from('engine_subscriptions')
      .select('external_user_id, external_credentials')
      .eq('user_id', session.user.id)
      .eq('engine_id', engineId)
      .maybeSingle(),
  ]);

  if (!engineRow) return { ok: false, reason: 'engine_not_found', error: 'Engine no encontrado' };

  // Internal-placeholder engines have no real URL — return a sentinel so the
  // client knows to stay on the workspace page instead of redirecting.
  if (engineRow.integration_mode === 'internal_placeholder' || !engineRow.external_url) {
    return {
      ok: false,
      reason: 'not_configured',
      error: 'Este engine aún no tiene URL externa. Estás en modo placeholder.',
    };
  }

  if (!accessRow) {
    return {
      ok: false,
      reason: 'no_access',
      error: 'No tienes acceso provisionado a este engine. Actívalo desde /app/engines.',
    };
  }

  const integration = getIntegration(engineRow.slug as string);
  if (!integration) {
    return {
      ok: false,
      reason: 'not_configured',
      error: `No hay integración registrada para slug=${engineRow.slug}`,
    };
  }

  const engineForIntegration = {
    id: engineRow.id as string,
    slug: engineRow.slug as string,
    name: engineRow.name as string,
    externalUrl: engineRow.external_url as string | null,
    adminApiBase: engineRow.admin_api_base as string | null,
    integrationMode: engineRow.integration_mode as 'internal_placeholder' | 'external_sso_redirect' | 'iframe_embed',
    requiresProvisioning: engineRow.requires_provisioning as boolean,
  } as Parameters<typeof integration.buildLaunchUrl>[0]['engine'];

  // Effective tier — admin override applied. Admins always present as
  // VIP to the engine, even if profiles.tier says FREE.
  const tier = computeEffectiveTier(session.role, session.tier);

  const result = await integration.buildLaunchUrl({
    userId: session.user.id,
    email: session.user.email ?? '',
    effectiveTier: tier,
    externalUserId: (accessRow.external_user_id as string | null) ?? null,
    credentials: (accessRow.external_credentials as Record<string, unknown> | null) ?? null,
    engine: engineForIntegration,
  });

  if (!result.ok || !result.url) {
    return {
      ok: false,
      reason: 'integration_failed',
      error: result.error ?? 'Integración falló al generar URL',
    };
  }

  return { ok: true, url: result.url };
}
