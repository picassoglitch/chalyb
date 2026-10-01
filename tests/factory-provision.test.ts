// The engine integration's own error contract (P0-2): 409 is success, other
// failures carry a reason the launch flow can map — their text is for logs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngineIntegration } from '@/lib/engines/integrations/factory';
import { codeForIntegrationFailure } from '@/lib/errors/customer-errors';

const engine = {
  id: 'e',
  slug: 'chalybclip',
  name: 'Clips',
  externalUrl: 'https://clip.example',
  adminApiBase: 'https://clip.example/admin',
  integrationMode: 'external_sso_redirect',
  requiresProvisioning: true,
} as never;

const input = {
  userId: 'u1',
  email: 'a@b.c',
  fullName: null,
  effectiveTier: 'PRO' as const,
  engine,
};

async function withFetch<T>(response: Response, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  process.env.CHALYBCLIP_ADMIN_TOKEN = 'test-token';
  globalThis.fetch = (async () => response) as typeof fetch;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
    delete process.env.CHALYBCLIP_ADMIN_TOKEN;
  }
}

const integration = createEngineIntegration({ slug: 'chalybclip', displayName: 'Clips' });

test('409 duplicate is success and returns the existing tenant', async () => {
  const res = new Response(
    JSON.stringify({ error: 'duplicate', tenant_id: 'ten_1', api_token: 'k' }),
    { status: 409 },
  );
  const result = await withFetch(res, () => integration.provision(input));
  assert.equal(result.ok, true);
  assert.equal(result.externalUserId, 'ten_1');
});

test('5xx maps to PROVISION_FAILED', async () => {
  const result = await withFetch(new Response('boom', { status: 503 }), () =>
    integration.provision(input),
  );
  assert.equal(result.ok, false);
  assert.equal(codeForIntegrationFailure(result.reason, 'provision'), 'PROVISION_FAILED');
});

test('a missing admin token maps to TOOL_UNAVAILABLE', async () => {
  const result = await integration.provision(input);
  assert.equal(result.reason, 'not_configured');
  assert.equal(codeForIntegrationFailure(result.reason, 'provision'), 'TOOL_UNAVAILABLE');
});
