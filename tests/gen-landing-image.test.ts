// scripts/gen-landing-image.mjs against a local mock of the Gemini REST API (no key, no spend).

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const sharp = createRequire(req.resolve('next/package.json'))('sharp');

type Hit = { url: string; key: string | undefined; body: Record<string, unknown> };

async function mock(replies: Array<{ status: number; json: unknown }>) {
  const hits: Hit[] = [];
  const server = createServer(async (rq: IncomingMessage, rs) => {
    let raw = '';
    for await (const c of rq) raw += c;
    hits.push({
      url: rq.url ?? '',
      key: rq.headers['x-goog-api-key'] as string,
      body: JSON.parse(raw),
    });
    const r = replies[Math.min(hits.length - 1, replies.length - 1)]!;
    rs.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.json));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  return { hits, base: `http://127.0.0.1:${port}`, close: () => server.close() };
}

function run(args: string[], env: Record<string, string>) {
  return new Promise<{ code: number; stderr: string }>((resolve) => {
    const clean = { ...process.env };
    delete clean.GEMINI_API_KEY;
    delete clean.GOOGLE_API_KEY;
    execFile(
      process.execPath,
      ['scripts/gen-landing-image.mjs', ...args],
      { env: { ...clean, ...env } },
      (err, _o, stderr) =>
        resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stderr }),
    );
  });
}

const dir = mkdtempSync(join(tmpdir(), 'gen-landing-'));
const promptFile = join(dir, 'p.txt');
writeFileSync(promptFile, '  A test prompt.\n');
test.after(() => rmSync(dir, { recursive: true, force: true }));

test('retries a 503, sends the documented body, and saves a real PNG from a JPEG answer', async () => {
  const jpeg: Buffer = await sharp({
    create: { width: 9, height: 16, channels: 3, background: '#808080' },
  })
    .jpeg()
    .toBuffer();
  const ok = {
    candidates: [
      {
        content: {
          parts: [
            { text: 'x' },
            { inlineData: { mimeType: 'image/jpeg', data: jpeg.toString('base64') } },
          ],
        },
      },
    ],
  };
  const m = await mock([
    { status: 503, json: { error: 'high demand' } },
    { status: 200, json: ok },
  ]);
  const out = join(dir, 'a.png');
  const r = await run([promptFile, out, '21:9'], {
    GEMINI_API_KEY: 'k1',
    GEMINI_API_BASE: m.base,
    GEMINI_RETRY_DELAY_MS: '10',
  });
  m.close();
  assert.equal(r.code, 0, r.stderr);
  assert.equal(m.hits.length, 2);
  assert.equal(m.hits[1]!.url, '/v1beta/models/gemini-3-pro-image:generateContent');
  assert.equal(m.hits[1]!.key, 'k1');
  assert.deepEqual(m.hits[1]!.body, {
    contents: [{ parts: [{ text: 'A test prompt.' }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: '21:9', imageSize: '1K' },
    },
  });
  const meta = await sharp(readFileSync(out)).metadata();
  assert.equal(meta.format, 'png');
  assert.deepEqual([meta.width, meta.height], [9, 16]);
});

test('falls back to GOOGLE_API_KEY and takes a model override', async () => {
  const png: Buffer = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#000' },
  })
    .png()
    .toBuffer();
  const ok = {
    candidates: [
      {
        content: {
          parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }],
        },
      },
    ],
  };
  const m = await mock([{ status: 200, json: ok }]);
  const out = join(dir, 'new-folder', 'b.png');
  const r = await run([promptFile, out, '9:16', 'other-model'], {
    GOOGLE_API_KEY: 'k2',
    GEMINI_API_BASE: m.base,
  });
  m.close();
  assert.equal(r.code, 0, r.stderr);
  assert.equal(m.hits[0]!.key, 'k2');
  assert.equal(m.hits[0]!.url, '/v1beta/models/other-model:generateContent');
  assert.deepEqual(readFileSync(out), png);
});

test('fails loudly without a key, on a non-503 error, after too many 503s, and with no image', async () => {
  assert.equal((await run([promptFile, join(dir, 'c.png')], {})).code, 2);

  const m400 = await mock([{ status: 400, json: { error: 'bad' } }]);
  const r400 = await run([promptFile, join(dir, 'd.png')], {
    GEMINI_API_KEY: 'k',
    GEMINI_API_BASE: m400.base,
  });
  m400.close();
  assert.equal(r400.code, 1);
  assert.equal(m400.hits.length, 1);

  const m503 = await mock([{ status: 503, json: {} }]);
  const r503 = await run([promptFile, join(dir, 'e.png')], {
    GEMINI_API_KEY: 'k',
    GEMINI_API_BASE: m503.base,
    GEMINI_RETRY_DELAY_MS: '1',
  });
  m503.close();
  assert.equal(r503.code, 1);
  assert.equal(m503.hits.length, 5);

  const mText = await mock([
    { status: 200, json: { candidates: [{ content: { parts: [{ text: 'blocked' }] } }] } },
  ]);
  const rText = await run([promptFile, join(dir, 'f.png')], {
    GEMINI_API_KEY: 'k',
    GEMINI_API_BASE: mText.base,
  });
  mText.close();
  assert.equal(rText.code, 1);
  assert.match(rText.stderr, /no image/);
  assert.equal(existsSync(join(dir, 'f.png')), false);
});

test('every committed landing prompt is complete: no-text and no-logo clauses included', () => {
  for (const n of [
    'clip-1',
    'clip-2',
    'clip-3',
    'clip-4',
    'clip-5',
    'clip-6',
    'clip-hero',
    'tool-envivo',
  ]) {
    const t = readFileSync(`docs/brand/landing-prompts/${n}.txt`, 'utf8');
    assert.match(t, /ABSOLUTELY NO text anywhere/, n);
    assert.match(t, /No brand logos/, n);
  }
});
