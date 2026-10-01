// "Abrir" (P0-1…P0-4): entitlement first, inline provisioning, codes only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { runLaunch, type LaunchDeps, type LaunchLogEvent } from '@/lib/engines/launch-flow';
import type { ToolAccess } from '@/lib/billing/entitlement-core';

const ENGINE = {
  id: 'e-clip',
  slug: 'chalybclip',
  externalUrl: 'https://clip.example',
  integrationMode: 'external_sso_redirect',
  requiresProvisioning: true,
};

function deps(overrides: Partial<LaunchDeps> = {}) {
  const logs: LaunchLogEvent[] = [];
  let saved: string | null = null;
  const d: LaunchDeps = {
    defaultSource: 'manual',
    loadEngine: async () => ENGINE,
    toolAccess: (): ToolAccess => ({ state: 'included' }),
    loadAccessRow: async () => null,
    provision: async () => {
      saved = 'ten_1';
      return { ok: true, externalUserId: 'ten_1' };
    },
    buildUrl: async (id) =>
      id
        ? { ok: true, url: `https://clip.example/auth/sso?token=t&tenant=${id}` }
        : { ok: false, reason: 'not_provisioned' },
    log: (e) => logs.push(e),
    ...overrides,
  };
  return { d, logs, saved: () => saved };
}

test('missing external id → provision → id saved → URL returned', async () => {
  const { d, logs, saved } = deps();
  const result = await runLaunch(d);
  assert.deepEqual(result, { ok: true, url: 'https://clip.example/auth/sso?token=t&tenant=ten_1' });
  assert.equal(saved(), 'ten_1');
  assert.deepEqual(
    logs.map((l) => l.outcome),
    ['provisioned', 'launched'],
  );
});

test('an existing id skips provisioning', async () => {
  let provisioned = false;
  const { d } = deps({
    loadAccessRow: async () => ({ externalUserId: 'ten_9', source: 'pro_selection' }),
    provision: async () => {
      provisioned = true;
      return { ok: true, externalUserId: 'x' };
    },
  });
  const result = await runLaunch(d);
  assert.equal(result.ok, true);
  assert.equal(provisioned, false);
});

test('an existing row keeps its source when provisioning', async () => {
  let usedSource = '';
  const { d } = deps({
    loadAccessRow: async () => ({ externalUserId: null, source: 'mp_payment' }),
    provision: async (source) => {
      usedSource = source;
      return { ok: true, externalUserId: 'ten_2' };
    },
  });
  await runLaunch(d);
  assert.equal(usedSource, 'mp_payment');
});

test('not entitled → NEEDS_PLAN, refused before provisioning or signing', async () => {
  let touched = false;
  const { d } = deps({
    toolAccess: () => ({ state: 'trial_offer' }),
    loadAccessRow: async () => {
      touched = true;
      return { externalUserId: 'ten_1', source: 'manual' };
    },
    buildUrl: async () => {
      touched = true;
      return { ok: true, url: 'x' };
    },
  });
  assert.deepEqual(await runLaunch(d), { ok: false, code: 'NEEDS_PLAN' });
  assert.equal(touched, false, 'a stale subscription row must not grant access');
});

test('setup needed → SETUP_NEEDED; invisible tool → TOOL_UNAVAILABLE', async () => {
  assert.deepEqual(
    await runLaunch(deps({ toolAccess: () => ({ state: 'setup_needed', missing: 'obs' }) }).d),
    { ok: false, code: 'SETUP_NEEDED' },
  );
  assert.deepEqual(await runLaunch(deps({ toolAccess: () => null }).d), {
    ok: false,
    code: 'TOOL_UNAVAILABLE',
  });
});

test('engine 5xx while provisioning → PROVISION_FAILED, detail only in the log', async () => {
  const { d, logs } = deps({
    provision: async () => ({
      ok: false,
      reason: 'engine_error',
      error: 'ChalyClip 503: upstream down · CHALYBCLIP_ADMIN_TOKEN',
    }),
  });
  const result = await runLaunch(d);
  assert.deepEqual(result, { ok: false, code: 'PROVISION_FAILED' });
  assert.ok(!JSON.stringify(result).includes('CHALYBCLIP'), 'no env names reach the client');
  assert.match(logs.at(-1)!.detail ?? '', /503/);
});

test('missing secret at sign time → TOOL_UNAVAILABLE', async () => {
  const { d } = deps({
    loadAccessRow: async () => ({ externalUserId: 'ten_1', source: 'manual' }),
    buildUrl: async () => ({
      ok: false,
      reason: 'not_configured',
      error: 'CHALYBCLIP_SSO_SECRET missing',
    }),
  });
  assert.deepEqual(await runLaunch(d), { ok: false, code: 'TOOL_UNAVAILABLE' });
});

test('a placeholder engine never reaches the integration', async () => {
  const { d } = deps({
    loadEngine: async () => ({ ...ENGINE, integrationMode: 'internal_placeholder' }),
  });
  assert.deepEqual(await runLaunch(d), { ok: false, code: 'TOOL_UNAVAILABLE' });
});

test('two concurrent clicks end with one engine account', async () => {
  // A fake engine with the factory's contract: a repeat tenant create for the
  // same external_user_id is a 409 that returns the existing tenant.
  const tenants = new Map<string, string>();
  let row: string | null = null;
  const provision = async () => {
    await new Promise((r) => setTimeout(r, 5));
    const existing = tenants.get('u1');
    const id = existing ?? `ten_${tenants.size + 1}`;
    tenants.set('u1', id);
    row = id;
    return { ok: true as const, externalUserId: id };
  };
  const base = deps({
    provision,
    loadAccessRow: async () => (row ? { externalUserId: row, source: 'manual' } : null),
  });
  const [a, b] = await Promise.all([runLaunch(base.d), runLaunch(base.d)]);
  assert.equal(a.ok && b.ok, true);
  assert.equal(tenants.size, 1);
});
