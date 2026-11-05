import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeOrigin, inspectResponse, runPublicChecks, PUBLIC_CHECKS } = await import(
  new URL('../scripts/check-launch-public.mjs', import.meta.url).href
);
const origin = 'https://www.chalyb.com';
const html =
  '<html><head><title>Chalyb</title><link href="https://www.chalyb.com/" rel="canonical"></head></html>';
const response = (status = 200, type = 'text/html', extra: Record<string, string> = {}) =>
  new Response('', { status, headers: { 'content-type': type, ...extra } });

test('public launch checks refuse insecure remote URLs, credentials and non-origin targets', () => {
  assert.equal(normalizeOrigin(origin + '/'), origin);
  assert.equal(normalizeOrigin('http://localhost:3000'), 'http://localhost:3000');
  for (const input of [
    'http://example.com',
    'https://user:password@example.com',
    origin + '/app',
    origin + '?secret=x',
    origin + '#x',
  ])
    assert.throws(() => normalizeOrigin(input));
});

test('public launch checks reject redirects, protection pages and missing canonicals', () => {
  const home = { path: '/', kind: 'html', canonical: true };
  assert.equal(inspectResponse(home, response(), html, origin), null);
  // Live www.chalyb.com serves the root canonical without a trailing slash.
  assert.equal(inspectResponse(home, response(), html.replace(origin + '/', origin), origin), null);
  assert.match(
    inspectResponse(home, response(), html.replace(origin + '/', '/'), origin),
    /Canonical/,
  );
  assert.match(inspectResponse(home, response(307), html, origin), /HTTP 307/);
  assert.match(
    inspectResponse(home, response(), '<html><title>Protected</title></html>', origin),
    /Canonical/,
  );
  assert.match(
    inspectResponse(home, response(), html.replace(origin, 'https://preview.example'), origin),
    /Canonical/,
  );
  assert.match(inspectResponse(home, response(200, 'application/json'), '{}', origin), /HTML/);
});

test('public launch checks reject draft/noindex legal pages from HTML or headers', () => {
  const legal = { path: '/legal/terms', kind: 'html', published: true };
  assert.equal(inspectResponse(legal, response(), html, origin), null);
  assert.match(
    inspectResponse(
      legal,
      response(),
      html.replace('</head>', '<meta content="noindex, nofollow" name="robots"></head>'),
      origin,
    ),
    /not published/,
  );
  assert.match(
    inspectResponse(legal, response(200, 'text/html', { 'x-robots-tag': 'noindex' }), html, origin),
    /not published/,
  );
});

test('public launch checks distinguish liveness JSON from an HTML fallback', () => {
  const health = { path: '/api/health', kind: 'health' };
  assert.equal(
    inspectResponse(
      health,
      response(200, 'application/json'),
      '{"status":"ok","service":"chalyb"}',
      origin,
    ),
    null,
  );
  assert.match(inspectResponse(health, response(), html, origin), /JSON/);
  assert.match(
    inspectResponse(health, response(200, 'application/json'), '{"status":"down"}', origin),
    /Unexpected/,
  );
  assert.match(
    inspectResponse(health, response(200, 'application/json'), 'invalid', origin),
    /Invalid/,
  );
});

test('public launch checks reject robots blocking everything and foreign sitemap origins', () => {
  const robots = { path: '/robots.txt', kind: 'robots' };
  assert.equal(
    inspectResponse(
      robots,
      response(200, 'text/plain'),
      'User-agent: *\nDisallow: /app\nSitemap: ' + origin + '/sitemap.xml',
      origin,
    ),
    null,
  );
  assert.match(
    inspectResponse(
      robots,
      response(200, 'text/plain'),
      'Disallow: /\nSitemap: ' + origin + '/sitemap.xml',
      origin,
    ),
    /blocks/,
  );
  const sitemap = { path: '/sitemap.xml', kind: 'sitemap' };
  const xml =
    '<urlset><url><loc>' +
    origin +
    '/</loc></url><url><loc>' +
    origin +
    '/planes</loc></url></urlset>';
  assert.equal(inspectResponse(sitemap, response(200, 'application/xml'), xml, origin), null);
  assert.match(
    inspectResponse(
      sitemap,
      response(200, 'application/xml'),
      xml.replace('</urlset>', '<url><loc>https://preview.example/</loc></url></urlset>'),
      origin,
    ),
    /different origin/,
  );
});

test('public launch runner sends GET only, refuses redirects and redacts transport errors', async () => {
  const requests: Array<{ url: string; method: string; redirect: string }> = [];
  const result = await runPublicChecks(origin, async (url: URL, options: RequestInit) => {
    requests.push({ url: String(url), method: options.method!, redirect: options.redirect! });
    throw new Error('Secret transport diagnostic must never enter report');
  });
  assert.equal(result.ok, false);
  assert.equal(result.scope, 'public-http-only');
  assert.equal(requests.length, PUBLIC_CHECKS.length);
  assert.ok(requests.every((request) => request.method === 'GET' && request.redirect === 'manual'));
  assert.ok(
    result.checks.every(
      (check: { ok: boolean; error: string }) =>
        !check.ok && check.error === 'Request failed or timed out',
    ),
  );
  assert.ok(!JSON.stringify(result).includes('Secret transport'));
});
