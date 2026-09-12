import { afterEach, describe, expect, it } from 'vitest';
import { USAGE_API_ENGINE_SLUGS, adminTokenEnvName, checkEngineBearer } from './bearer';

const TOKEN = 'chalybclip-admin-token-value';

function request(authorization?: string): Request {
  return new Request('https://chalyb.com/api/engines/chalybclip/usage', {
    headers: authorization ? { authorization } : {},
  });
}

const touchedEnvKeys = new Set<string>();

function setEnv(key: string, value: string) {
  touchedEnvKeys.add(key);
  process.env[key] = value;
}

afterEach(() => {
  for (const key of touchedEnvKeys) delete process.env[key];
  touchedEnvKeys.clear();
});

describe('adminTokenEnvName', () => {
  it.each([
    ['chalybclip', 'CHALYBCLIP_ADMIN_TOKEN'],
    ['chalybobs', 'CHALYBOBS_ADMIN_TOKEN'],
    ['chalybcrypto', 'CHALYBCRYPTO_ADMIN_TOKEN'],
  ])('maps %s to %s', (slug, expected) => {
    expect(adminTokenEnvName(slug)).toBe(expected);
  });

  it('matches the env vars documented in .env.local.example for every slug', () => {
    for (const slug of USAGE_API_ENGINE_SLUGS) {
      expect(adminTokenEnvName(slug)).toMatch(/^CHALYB[A-Z]*_ADMIN_TOKEN$/);
    }
  });
});

describe('checkEngineBearer', () => {
  // The regression: the map lived in two route files and listed only
  // chalybclip, so the other two registered engines got a flat 404 from the
  // usage API and could not report anything they did.
  it.each(USAGE_API_ENGINE_SLUGS)('authenticates %s with its own token', (slug) => {
    setEnv(adminTokenEnvName(slug), TOKEN);
    expect(checkEngineBearer(request(`Bearer ${TOKEN}`), slug)).toEqual({ ok: true });
  });

  it('404s an engine that is not in the list', () => {
    const result = checkEngineBearer(request(`Bearer ${TOKEN}`), 'someone-elses-engine');
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'unknown engine: someone-elses-engine',
    });
  });

  it('503s when that engine has no token configured on this deployment', () => {
    const result = checkEngineBearer(request(`Bearer ${TOKEN}`), 'chalybobs');
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.status).toBe(503);
  });

  it('401s when no bearer is presented', () => {
    setEnv('CHALYBCLIP_ADMIN_TOKEN', TOKEN);
    const result = checkEngineBearer(request(), 'chalybclip');
    expect(result.ok === false && result.status).toBe(401);
  });

  it('401s on a non-bearer authorization scheme', () => {
    setEnv('CHALYBCLIP_ADMIN_TOKEN', TOKEN);
    const result = checkEngineBearer(request(`Basic ${TOKEN}`), 'chalybclip');
    expect(result.ok === false && result.status).toBe(401);
  });

  it('accepts the scheme case-insensitively, as RFC 7235 requires', () => {
    setEnv('CHALYBCLIP_ADMIN_TOKEN', TOKEN);
    expect(checkEngineBearer(request(`bearer ${TOKEN}`), 'chalybclip')).toEqual({ ok: true });
  });

  it('403s on the wrong token', () => {
    setEnv('CHALYBCLIP_ADMIN_TOKEN', TOKEN);
    const result = checkEngineBearer(request('Bearer not-the-token'), 'chalybclip');
    expect(result.ok === false && result.status).toBe(403);
  });

  // Defence in depth: the slug in the URL has to be the slug the token
  // belongs to, so a leaked token cannot be used to write usage as another
  // engine.
  it("403s when one engine presents another engine's token", () => {
    setEnv('CHALYBCLIP_ADMIN_TOKEN', TOKEN);
    setEnv('CHALYBOBS_ADMIN_TOKEN', 'a-different-token');
    const result = checkEngineBearer(request(`Bearer ${TOKEN}`), 'chalybobs');
    expect(result.ok === false && result.status).toBe(403);
  });
});
