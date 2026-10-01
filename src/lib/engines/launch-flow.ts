// The "Abrir" decision, as a pure function over injected dependencies.
//
// launch-actions.ts wires the real database, integrations and audit log into
// this; the unit tests wire fakes. Keeping the order of checks here — and only
// here — is what guarantees the three invariants P0 asks for:
//
//   1. Access is decided by getEntitlements BEFORE anything is provisioned or
//      signed (P0-3). A stale engine_subscriptions row grants nothing.
//   2. An entitled user with no account at the engine yet gets one inline,
//      then the SSO URL, in the same click (P0-2).
//   3. The customer gets a code, never text. Integration detail goes to the
//      log (P0-4).

import type { ToolAccess } from '@/lib/billing/entitlement-core';
import { codeForIntegrationFailure, type CustomerErrorCode } from '@/lib/errors/customer-errors';

export type LaunchResult = { ok: true; url: string } | { ok: false; code: CustomerErrorCode };

export interface LaunchEngine {
  id: string;
  slug: string;
  externalUrl: string | null;
  integrationMode: string;
  requiresProvisioning: boolean;
}

export interface LaunchAccessRow {
  externalUserId: string | null;
  source: string;
}

export type ProvisionOutcome =
  | { ok: true; externalUserId: string | null }
  | { ok: false; reason: string; error?: string };

export type UrlOutcome = { ok: true; url: string } | { ok: false; reason?: string; error?: string };

export interface LaunchLogEvent {
  slug: string;
  outcome: 'launched' | 'refused' | 'provisioned' | 'provision_failed' | 'launch_failed';
  code?: CustomerErrorCode;
  /** Server-side detail only. Never returned to the client. */
  detail?: string;
}

export interface LaunchDeps {
  loadEngine(): Promise<LaunchEngine | null>;
  /** The user's access for this tool from getEntitlements, or null when the
   *  tool is not visible to customers at all. */
  toolAccess(slug: string): ToolAccess | null;
  loadAccessRow(): Promise<LaunchAccessRow | null>;
  /** Create (or re-link) the user's account at the engine and persist its id.
   *  Must be idempotent: the engine treats a repeat as 409 = success. */
  provision(source: string): Promise<ProvisionOutcome>;
  buildUrl(externalUserId: string | null): Promise<UrlOutcome>;
  log(event: LaunchLogEvent): void;
  /** Source recorded on a newly created access row. */
  defaultSource: string;
}

export async function runLaunch(deps: LaunchDeps): Promise<LaunchResult> {
  const engine = await deps.loadEngine();
  if (!engine) return { ok: false, code: 'TOOL_UNAVAILABLE' };

  const access = deps.toolAccess(engine.slug);
  const refused = refusalFor(access);
  if (refused) {
    deps.log({ slug: engine.slug, outcome: 'refused', code: refused });
    return { ok: false, code: refused };
  }

  if (engine.integrationMode === 'internal_placeholder' || !engine.externalUrl) {
    deps.log({
      slug: engine.slug,
      outcome: 'launch_failed',
      code: 'TOOL_UNAVAILABLE',
      detail: 'engine has no external surface (integration_mode/external_url)',
    });
    return { ok: false, code: 'TOOL_UNAVAILABLE' };
  }

  const row = await deps.loadAccessRow();
  let externalUserId = row?.externalUserId ?? null;

  if (!externalUserId && engine.requiresProvisioning) {
    // Keep the source an existing row already has; a new row gets the default.
    const provisioned = await deps.provision(row?.source ?? deps.defaultSource);
    if (!provisioned.ok) {
      const code = codeForIntegrationFailure(provisioned.reason, 'provision');
      deps.log({
        slug: engine.slug,
        outcome: 'provision_failed',
        code,
        detail: `${provisioned.reason}${provisioned.error ? `: ${provisioned.error}` : ''}`,
      });
      return { ok: false, code };
    }
    externalUserId = provisioned.externalUserId;
    deps.log({ slug: engine.slug, outcome: 'provisioned' });
  }

  const built = await deps.buildUrl(externalUserId);
  if (!built.ok) {
    const code = codeForIntegrationFailure(built.reason, 'launch');
    deps.log({
      slug: engine.slug,
      outcome: 'launch_failed',
      code,
      detail: `${built.reason ?? 'unknown'}${built.error ? `: ${built.error}` : ''}`,
    });
    return { ok: false, code };
  }

  deps.log({ slug: engine.slug, outcome: 'launched' });
  return { ok: true, url: built.url };
}

function refusalFor(access: ToolAccess | null): CustomerErrorCode | null {
  if (!access) return 'TOOL_UNAVAILABLE';
  if (access.state === 'trial_offer') return 'NEEDS_PLAN';
  if (access.state === 'setup_needed') return 'SETUP_NEEDED';
  return null;
}
