import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectPlatform } from '@chalito/releases/detect';
import { fetchChannel, loadManifest, pickDownloads } from '@chalito/releases/pick';
import { DOWNLOAD_OSES, DownloadKind, type ReleaseManifest } from '@chalito/releases/manifest';
import es from '../src/lib/chalito/messages/es.json' with { type: 'json' };
import en from '../src/lib/chalito/messages/en.json' with { type: 'json' };

const SHA = 'a'.repeat(64);
const file = (kind: string, name: string) => ({
  kind,
  name,
  url: `https://storage.example/${name}?sig=1`,
  size: 50 * 1_048_576,
  sha256: SHA,
});
const MANIFEST = {
  version: '0.1.0-beta.1',
  notes: '',
  pub_date: '2026-10-16T00:00:00Z',
  platforms: {},
  downloads: {
    windows: [file('nsis', 'UNSIGNED_Chalito_0.1.0-beta.1_x64-setup.exe')],
    macos: [file('dmg', 'Chalito_0.1.0-beta.1_universal.dmg')],
    linux: [
      file('rpm', 'Chalito-0.1.0-beta.1.x86_64.rpm'),
      file('deb', 'Chalito_0.1.0-beta.1_amd64.deb'),
      file('appimage', 'Chalito_0.1.0-beta.1_amd64.AppImage'),
    ],
  },
  unsigned: { windows: true, macos: false, linux: true },
};

const fakeFetch =
  (answers: Record<string, { status: number; body?: unknown }>): typeof fetch =>
  (async (url: string | URL) => {
    const a = answers[String(url)] ?? { status: 404 };
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;

const API = 'https://api.chalito.chalyb.com';

test('detect: macOS, Windows and Linux from the user agent or client hints; phones and iPads are not desktops', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15';
  assert.equal(detectPlatform({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 0 }), 'macos');
  assert.equal(detectPlatform({ userAgent: mac, platform: 'MacIntel', maxTouchPoints: 5 }), 'ios');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), 'windows');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), 'linux');
  assert.equal(detectPlatform({ userAgentData: { platform: 'Windows' }, userAgent: '' }), 'windows');
  assert.equal(detectPlatform({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'android');
  assert.equal(detectPlatform(undefined), 'unknown');
});

test('pick: the detected OS gets one main button with its preferred installer; the others go below', () => {
  const m = MANIFEST as unknown as ReleaseManifest;
  const linux = pickDownloads(m, 'linux', null);
  assert.equal(linux.os, 'linux');
  assert.equal(linux.primary?.kind, 'appimage');
  assert.deepEqual(
    linux.others.map((f) => f.kind),
    ['deb', 'rpm'],
  );
  assert.deepEqual(linux.otherOses, ['windows', 'macos']);

  assert.equal(pickDownloads(m, 'macos', null).primary?.kind, 'dmg');
  assert.equal(pickDownloads(m, 'windows', null).primary?.kind, 'nsis');
  // The person's switch wins over detection; a phone or unknown platform defaults to Windows.
  assert.equal(pickDownloads(m, 'windows', 'linux').os, 'linux');
  assert.equal(pickDownloads(m, 'ios', null).os, 'windows');
  // An OS with no file has no main button (the page says so instead).
  const noMac = { ...MANIFEST, downloads: { windows: MANIFEST.downloads.windows } };
  assert.equal(pickDownloads(noMac as unknown as ReleaseManifest, 'macos', null).primary, null);
});

test('manifest: stable first, then beta; a 404 or a malformed manifest on both means no release', async () => {
  const stable = `${API}/releases/stable/latest.json`;
  const beta = `${API}/releases/beta/latest.json`;

  const onlyBeta = await loadManifest(API, fakeFetch({ [beta]: { status: 200, body: MANIFEST } }));
  assert.equal(onlyBeta?.channel, 'beta');
  assert.equal(onlyBeta?.manifest.version, '0.1.0-beta.1');

  const both = await loadManifest(
    `${API}/`,
    fakeFetch({
      [stable]: { status: 200, body: { ...MANIFEST, version: '1.0.0' } },
      [beta]: { status: 200, body: MANIFEST },
    }),
  );
  assert.equal(both?.channel, 'stable');
  assert.equal(both?.manifest.version, '1.0.0');

  assert.equal(await loadManifest(API, fakeFetch({})), null);
  assert.equal(
    await fetchChannel(API, 'beta', fakeFetch({ [beta]: { status: 200, body: { version: 'v1' } } })),
    null,
  );
  const throws = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.equal(await loadManifest(API, throws), null);
});

/** Every key the page and the panel ask for, including the per-OS and per-kind ones. */
const usedKeys = () => {
  const root = join(import.meta.dirname, '..');
  const src = [
    'src/lib/chalito/pkg/releases/download.tsx',
    'src/components/tools/chalito/Download.tsx',
  ]
    .map((p) => readFileSync(join(root, p), 'utf8'))
    .join('\n');
  const literal = [...src.matchAll(/\bt\("([A-Za-z.]+)"/g)].map((m) => m[1]!);
  const dynamic = [
    ...DOWNLOAD_OSES.map((o) => `os.${o}`),
    ...DownloadKind.options.map((k) => `kinds.${k}`),
  ];
  return [...new Set([...literal, ...dynamic])];
};

const lookup = (messages: Record<string, unknown>, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], messages);

test('/descargar renders every string in es and en (no raw keys, no MISSING_MESSAGE)', () => {
  const keys = usedKeys();
  assert.ok(keys.includes('soonTitle') && keys.includes('smartscreenSteps.two') && keys.includes('primary'));
  for (const [name, messages] of [
    ['es', es],
    ['en', en],
  ] as const) {
    const ns = (messages as Record<string, unknown>).download as Record<string, unknown>;
    assert.ok(ns, `${name}: chalito.download is missing`);
    for (const k of keys) {
      const v = lookup(ns, k);
      assert.equal(typeof v, 'string', `${name}: chalito.download.${k} is missing`);
      assert.ok((v as string).trim().length > 0, `${name}: chalito.download.${k} is empty`);
    }
  }
});

test('the Windows SmartScreen steps match the real dialog buttons', () => {
  assert.match(es.download.smartscreenSteps.one, /Más información/);
  assert.match(es.download.smartscreenSteps.two, /Ejecutar de todas formas/);
  assert.match(en.download.smartscreenSteps.one, /More info/);
  assert.match(en.download.smartscreenSteps.two, /Run anyway/);
});
