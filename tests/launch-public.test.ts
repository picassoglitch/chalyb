import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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
      'User-agent: *\nDisallow: /\nSitemap: ' + origin + '/sitemap.xml',
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

test('public launch checks catch unquoted and "none" robots tags but ignore data-name', () => {
  const legal = { path: '/legal/terms', kind: 'html', published: true };
  const withMeta = (meta: string) => html.replace('</head>', meta + '</head>');
  assert.match(
    inspectResponse(legal, response(), withMeta('<meta name=robots content=noindex>'), origin),
    /not published/,
  );
  assert.match(
    inspectResponse(legal, response(), withMeta('<meta name="robots" content="none">'), origin),
    /not published/,
  );
  assert.match(
    inspectResponse(legal, response(200, 'text/html', { 'x-robots-tag': 'none' }), html, origin),
    /not published/,
  );
  assert.match(
    inspectResponse(
      legal,
      response(),
      withMeta('<meta data-name="x" name="robots" content="noindex">'),
      origin,
    ),
    /not published/,
  );
  assert.equal(
    inspectResponse(
      legal,
      response(200, 'text/html', { 'x-robots-tag': 'max-image-preview:none' }),
      withMeta('<meta name="robots" content="index, follow, max-image-preview:none">'),
      origin,
    ),
    null,
  );
  assert.match(
    inspectResponse(
      legal,
      response(200, 'text/html', { 'x-robots-tag': 'googlebot: noindex' }),
      html,
      origin,
    ),
    /not published/,
  );
  const home = { path: '/', kind: 'html', canonical: true };
  assert.equal(
    inspectResponse(home, response(), html.replace('rel="canonical"', 'rel="Canonical"'), origin),
    null,
  );
});

test('public launch robots check only fails when the * group is blocked', () => {
  const robots = { path: '/robots.txt', kind: 'robots' };
  const sitemapLine = '\nSitemap: ' + origin + '/sitemap.xml';
  const check = (body: string) =>
    inspectResponse(robots, response(200, 'text/plain'), body, origin);
  assert.equal(
    check('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /' + sitemapLine),
    null,
  );
  assert.match(check('User-agent: GPTBot\nUser-agent: *\nDisallow: /' + sitemapLine), /blocks/);
  assert.match(check('User-agent: *\nDisallow: /*' + sitemapLine), /blocks/);
  assert.equal(check('User-agent: *\nDisallow: /app' + sitemapLine + ' # main'), null);
  assert.match(
    check('User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml.bak'),
    /missing the canonical sitemap/,
  );
});

test('public launch sitemap check accepts a slashless root and names malformed entries', () => {
  const sitemap = { path: '/sitemap.xml', kind: 'sitemap' };
  const xml = (...locs: string[]) =>
    '<urlset>' + locs.map((loc) => '<url><loc>' + loc + '</loc></url>').join('') + '</urlset>';
  const check = (body: string) =>
    inspectResponse(sitemap, response(200, 'application/xml'), body, origin);
  assert.equal(check(xml(origin, origin + '/planes')), null);
  assert.match(check(xml(origin + '/', origin + '/planes', 'not a url')), /invalid URL/);
});

test('public launch runner reports ok with no error keys when every check passes', async () => {
  const bodies: Record<string, [string, string]> = {
    '/robots.txt': ['text/plain', 'User-agent: *\nAllow: /\nSitemap: ' + origin + '/sitemap.xml'],
    '/sitemap.xml': [
      'application/xml',
      '<urlset><url><loc>' +
        origin +
        '/</loc></url><url><loc>' +
        origin +
        '/planes</loc></url></urlset>',
    ],
    '/api/health': ['application/json', '{"status":"ok","service":"chalyb"}'],
  };
  const result = await runPublicChecks(origin, async (url: URL) => {
    const [type, body] = bodies[url.pathname] ?? [
      'text/html',
      html.replace(origin + '/', new URL(url.pathname, origin).href),
    ];
    return new Response(body, { status: 200, headers: { 'content-type': type } });
  });
  assert.equal(result.ok, true);
  assert.ok(result.checks.every((check: object) => !('error' in check)));
});

test('public launch CLI exits 2 on invalid invocation without sending requests', () => {
  const script = fileURLToPath(new URL('../scripts/check-launch-public.mjs', import.meta.url));
  for (const args of [[], [origin, origin], [origin, '--yaml'], [origin + '/app'], ['garbage']]) {
    const run = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 2, args.join(' '));
  }
});
