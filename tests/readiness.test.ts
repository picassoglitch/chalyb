import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clipsHealthProbe,
  healthDeadline,
  probePublicEngine,
  readinessEngineTarget,
  readinessResponse,
  type ReadinessDeps,
  type ReadinessEngine,
} from '@/lib/health/readiness';
import { GET as liveness } from '@/app/api/health/route';

const SECRET = 'monitor-test-secret';
const CLIPS: ReadinessEngine = {
  slug: 'chalybclip',
  status: 'active',
  external_url: 'https://clips.example.test',
};
const OBS: ReadinessEngine = {
  slug: 'chalybobs',
  status: 'active',
  external_url: 'https://obs.example.test',
};
const request = (authorization = `Bearer ${SECRET}`) =>
  new Request('https://hub.example.test/api/ready', { headers: { authorization } });
const deps = (changes: Partial<ReadinessDeps> = {}): ReadinessDeps => ({
  secret: SECRET,
  publicSlugs: new Set(['chalybclip', 'chalybobs']),
  readCatalog: async () => [CLIPS, OBS],
  probe: async () => {},
  ...changes,
});

test('readiness rejects missing, wrong and query-string auth before reading dependencies', async () => {
  let reads = 0;
  const d = deps({
    readCatalog: async () => {
      reads++;
      return [CLIPS];
    },
  });
  for (const req of [
    request(''),
    request('Bearer wrong'),
    request('Basic ' + SECRET),
    new Request('https://hub.example.test/api/ready?token=' + SECRET),
  ]) {
    const res = await readinessResponse(req, d);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { ok: false });
    assert.match(res.headers.get('cache-control')!, /no-store/);
  }
  assert.equal((await readinessResponse(request(), deps({ secret: undefined }))).status, 401);
  assert.equal(reads, 0);
});

test('readiness checks only active public tools and returns private 200 for successful probes', async () => {
  const seen: string[] = [];
  const res = await readinessResponse(
    request(),
    deps({
      readCatalog: async () => [
        CLIPS,
        { ...OBS, status: 'coming_soon' },
        { slug: 'private-engine', status: 'active', external_url: 'https://private.test' },
      ],
      probe: async (e) => {
        seen.push(e.slug);
      },
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(seen, ['chalybclip']);
  assert.deepEqual(await res.json(), {
    ok: true,
    status: 'ready',
    checks: { database: true, activeTools: true, engines: { chalybclip: true } },
  });
  assert.match(res.headers.get('cache-control')!, /private.*no-store/);
});

test('an empty active catalog, any failed tool and catalog errors cannot produce a green check', async () => {
  assert.equal(
    (await readinessResponse(request(), deps({ readCatalog: async () => [] }))).status,
    503,
  );
  const failure = await readinessResponse(
    request(),
    deps({
      probe: async (e) => {
        if (e.slug === 'chalybobs') throw new Error('https://secret-host/token');
      },
    }),
  );
  assert.equal(failure.status, 503);
  const body = await failure.text();
  assert.ok(!body.includes('secret-host'));
  assert.deepEqual(JSON.parse(body).checks.engines, { chalybclip: true, chalybobs: false });
  const unavailable = await readinessResponse(
    request(),
    deps({
      readCatalog: async () => {
        throw new Error('service-role-secret');
      },
    }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.text()).includes('service-role-secret'), false);
});

test('readiness has a total deadline and aborts work even if the dependency never settles', async () => {
  let signal: AbortSignal | undefined;
  const res = await readinessResponse(
    request(),
    deps({
      timeoutMs: 10,
      readCatalog: (s) => {
        signal = s;
        return new Promise(() => {});
      },
    }),
  );
  assert.equal(res.status, 503);
  assert.equal(signal?.aborted, true);
  let doneSignal: AbortSignal | undefined;
  await healthDeadline(async (s) => {
    doneSignal = s;
    return true;
  });
  assert.equal(doneSignal?.aborted, true, 'cleanup also aborts after success');
});

test('Clips production probe performs a real no-store /readyz request and validates the body', async () => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ status: 'ready' });
  }) as typeof fetch;
  const signal = new AbortController().signal;
  await probePublicEngine(CLIPS, signal, fetchImpl);
  assert.equal(calls[0]!.url, 'https://clips.example.test/readyz');
  assert.equal(calls[0]!.init?.signal, signal);
  assert.equal(calls[0]!.init?.cache, 'no-store');
  assert.equal(calls[0]!.init?.redirect, 'manual');
  for (const response of [
    Response.json({ status: 'ok' }),
    Response.json({ status: 'ready' }, { status: 503 }),
    new Response(null, { status: 302, headers: { location: 'https://other.test' } }),
  ]) {
    await assert.rejects(probePublicEngine(CLIPS, signal, (async () => response) as typeof fetch));
  }
});

test('En vivo probe accepts only its documented anonymous 401, not a login page or redirect', async () => {
  for (const status of [200, 302, 404, 500]) {
    await assert.rejects(
      probePublicEngine(
        OBS,
        new AbortController().signal,
        (async () => new Response(null, { status })) as typeof fetch,
      ),
    );
  }
  await probePublicEngine(
    OBS,
    new AbortController().signal,
    (async () => new Response(null, { status: 401 })) as typeof fetch,
  );
});

test('unknown probes and unsafe catalog URLs are refused before sending any request', async () => {
  let called = false;
  const fetchImpl = (async () => {
    called = true;
    return Response.json({ status: 'ready' });
  }) as typeof fetch;
  for (const e of [
    { ...CLIPS, external_url: null },
    { ...CLIPS, external_url: 'http://localhost:8080' },
    { ...CLIPS, external_url: 'https://user:secret@clips.example.test' },
    { ...CLIPS, external_url: 'https://clips.example.test?secret=oops' },
    { ...CLIPS, slug: 'unknown' },
  ]) {
    await assert.rejects(probePublicEngine(e, new AbortController().signal, fetchImpl));
  }
  assert.equal(called, false);
});

test('public health is explicitly uncached liveness, without dependency claims', async () => {
  const res = liveness();
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok', service: 'chalyb', check: 'liveness' });
  assert.match(res.headers.get('cache-control')!, /no-store/);
});

test('cron Clips mode a contacts the real engine and never consults static capabilities', async () => {
  let read = 0;
  let fetched = 0;
  let capabilities = 0;
  const probe = clipsHealthProbe('a', {
    readEngine: async () => {
      read++;
      return CLIPS;
    },
    capabilities: () => {
      capabilities++;
      throw new Error('static capabilities are not a probe');
    },
    fetchImpl: (async () => {
      fetched++;
      return Response.json({ status: 'ready' });
    }) as typeof fetch,
  });
  assert.ok(probe);
  await probe();
  assert.equal(read, 1);
  assert.equal(fetched, 1);
  assert.equal(capabilities, 0);
});

test('cron Clips mode a refuses a missing engine URL instead of falling back to capabilities', async () => {
  let capabilities = 0;
  let fetched = 0;
  const probe = clipsHealthProbe('a', {
    readEngine: async () => ({ ...CLIPS, external_url: null }),
    capabilities: () => {
      capabilities++;
      return {};
    },
    fetchImpl: (async () => {
      fetched++;
      return Response.json({ status: 'ready' });
    }) as typeof fetch,
  });
  await assert.rejects(probe!());
  assert.equal(capabilities, 0);
  assert.equal(fetched, 0);
});

test('cron Clips mode a times out an uncooperative database without hanging', async () => {
  let signal: AbortSignal | undefined;
  const probe = clipsHealthProbe('a', {
    timeoutMs: 10,
    readEngine: (s) => {
      signal = s;
      return new Promise(() => {});
    },
    capabilities: () => {
      throw new Error('must not run');
    },
  });
  await assert.rejects(probe!(), /timeout/);
  assert.equal(signal?.aborted, true);
});

test('cron Clips mock uses capabilities only in mock mode; handoff modes remain unmonitored', async () => {
  let reads = 0;
  let capabilities = 0;
  const d = {
    readEngine: async () => {
      reads++;
      return CLIPS;
    },
    capabilities: () => {
      capabilities++;
      return {};
    },
  };
  await clipsHealthProbe('mock', d)!();
  assert.equal(capabilities, 1);
  assert.equal(reads, 0);
  assert.equal(clipsHealthProbe('off', d), null);
  assert.equal(clipsHealthProbe('b', d), null);
});

test('readiness targets match Clips and En vivo API overrides and fall back exactly like the adapters', async () => {
  const env = {
    CHALYBCLIP_API_BASE: 'https://clip-api.example.test/',
    CHALYBOBS_API_BASE: '  https://obs-api.example.test/  ',
  };
  assert.equal(readinessEngineTarget(CLIPS, env).external_url, 'https://clip-api.example.test');
  assert.equal(readinessEngineTarget(OBS, env).external_url, 'https://obs-api.example.test');
  assert.equal(readinessEngineTarget(CLIPS, {}).external_url, CLIPS.external_url);
  assert.equal(
    readinessEngineTarget(OBS, { CHALYBOBS_API_BASE: '  ' }).external_url,
    OBS.external_url,
  );
  assert.equal(
    readinessEngineTarget({ ...CLIPS, external_url: null }, env).external_url,
    'https://clip-api.example.test',
  );
  let requested = '';
  await probePublicEngine(readinessEngineTarget(CLIPS, env), new AbortController().signal, (async (
    url,
  ) => {
    requested = String(url);
    return Response.json({ status: 'ready' });
  }) as typeof fetch);
  assert.equal(requested, 'https://clip-api.example.test/readyz');
  await probePublicEngine(
    readinessEngineTarget(CLIPS, { CHALYBCLIP_API_BASE: 'https://clip-api.example.test/prefix/' }),
    new AbortController().signal,
    (async (url) => {
      requested = String(url);
      return Response.json({ status: 'ready' });
    }) as typeof fetch,
  );
  assert.equal(requested, 'https://clip-api.example.test/prefix/readyz');
  await assert.rejects(
    probePublicEngine(
      readinessEngineTarget(CLIPS, { CHALYBCLIP_API_BASE: 'http://unsafe.test' }),
      new AbortController().signal,
      (async () => Response.json({ status: 'ready' })) as typeof fetch,
    ),
  );
});
