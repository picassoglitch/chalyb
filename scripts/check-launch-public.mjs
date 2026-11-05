#!/usr/bin/env node
// Read-only public HTTP smoke checks. This does not validate payments or engines.
import { pathToFileURL } from 'node:url';

export const PUBLIC_CHECKS = [
  { path: '/', kind: 'html', canonical: true },
  { path: '/en', kind: 'html', canonical: true },
  { path: '/planes', kind: 'html', canonical: true },
  { path: '/sign-in', kind: 'html' },
  { path: '/forgot-password', kind: 'html' },
  { path: '/legal/terms', kind: 'html', published: true },
  { path: '/legal/privacy', kind: 'html', published: true },
  { path: '/legal/subscription', kind: 'html', published: true },
  { path: '/legal/acceptable-use', kind: 'html', published: true },
  { path: '/quien-vende', kind: 'html', published: true },
  { path: '/robots.txt', kind: 'robots' },
  { path: '/sitemap.xml', kind: 'sitemap' },
  { path: '/api/health', kind: 'health' },
];

export function normalizeOrigin(input) {
  const url = new URL(input);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new Error('Use HTTPS, or HTTP on localhost.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Supply an origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

function attr(tag, name) {
  const match = tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\\\'])(.*?)\\1', 'i'));
  return match?.[2] ?? '';
}

// Production's root canonical omits the trailing slash; parsing makes equal URLs compare equal.
// No base URL, so a relative canonical still fails.
function absoluteHref(href) {
  try {
    return new URL(href).href;
  } catch {
    return '';
  }
}

export function inspectResponse(check, response, body, origin) {
  if (response.status !== 200) return 'HTTP ' + response.status;
  const type = response.headers.get('content-type') ?? '';
  if (check.kind === 'html') {
    if (
      !/text\/html/i.test(type) ||
      !/<html\b/i.test(body) ||
      !/<title\b[^>]*>[^<]+<\/title>/i.test(body)
    ) {
      return 'Expected an HTML page with a title';
    }
    if (check.published || check.canonical) {
      const robots = [...body.matchAll(/<meta\b[^>]*>/gi)]
        .map(([tag]) =>
          /^(robots|googlebot)$/i.test(attr(tag, 'name')) ? attr(tag, 'content') : '',
        )
        .join(',');
      if (/\bnoindex\b/i.test(robots + ',' + (response.headers.get('x-robots-tag') ?? ''))) {
        return 'Public page is not published/indexable';
      }
    }
    if (check.canonical) {
      const links = [...body.matchAll(/<link\b[^>]*>/gi)];
      const canonical = links.find(([tag]) => attr(tag, 'rel').split(/\s+/).includes('canonical'));
      const expected = new URL(check.path, origin).href;
      if (!canonical || absoluteHref(attr(canonical[0], 'href')) !== expected)
        return 'Canonical URL does not match requested origin';
    }
  } else if (check.kind === 'robots') {
    if (!/^text\/plain/i.test(type) || !body.includes('Sitemap: ' + origin + '/sitemap.xml')) {
      return 'robots.txt is missing the canonical sitemap';
    }
    if (/^Disallow:\s*\/\s*$/im.test(body)) return 'robots.txt blocks the entire site';
  } else if (check.kind === 'sitemap') {
    if (!/xml/i.test(type) || !/<urlset\b/i.test(body)) return 'Expected an XML sitemap';
    const urls = [...body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
    if (!urls.includes(origin + '/') || !urls.includes(origin + '/planes'))
      return 'Sitemap is missing public entry pages';
    if (
      urls.some((url) => {
        try {
          return new URL(url).origin !== origin;
        } catch {
          return true;
        }
      })
    )
      return 'Sitemap contains a different origin';
  } else if (check.kind === 'health') {
    if (!/application\/json/i.test(type)) return 'Expected JSON liveness response';
    try {
      const data = JSON.parse(body);
      if (data.status !== 'ok' || data.service !== 'chalyb') return 'Unexpected liveness response';
    } catch {
      return 'Invalid liveness JSON';
    }
  }
  return null;
}

export async function runPublicChecks(input, fetcher = fetch) {
  const origin = normalizeOrigin(input);
  const checks = [];
  // Sequential requests avoid a burst against the production deployment.
  for (const check of PUBLIC_CHECKS) {
    let error;
    try {
      const response = await fetcher(new URL(check.path, origin), {
        method: 'GET',
        redirect: 'manual',
        headers: { accept: '*/*' },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      error = inspectResponse(check, response, body, origin);
    } catch {
      error = 'Request failed or timed out';
    }
    checks.push({ path: check.path, ok: !error, ...(error ? { error } : {}) });
  }
  return {
    origin,
    checkedAt: new Date().toISOString(),
    ok: checks.every((check) => check.ok),
    scope: 'public-http-only',
    checks,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const origins = args.filter((arg) => !arg.startsWith('--'));
  if (origins.length !== 1 || args.some((arg) => arg.startsWith('--') && arg !== '--json')) {
    console.error('Usage: node scripts/check-launch-public.mjs https://www.chalyb.com [--json]');
    process.exitCode = 2;
  } else {
    try {
      const result = await runPublicChecks(origins[0]);
      if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
      else {
        for (const check of result.checks)
          console.log(
            (check.ok ? 'PASS ' : 'FAIL ') + check.path + (check.error ? ': ' + check.error : ''),
          );
        console.log(
          'Scope: public HTTP only; payment, email, authenticated tools and recovery still need separate evidence.',
        );
      }
      process.exitCode = result.ok ? 0 : 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 2;
    }
  }
}
