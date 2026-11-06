// Generates one landing image with Gemini from a committed prompt (docs/brand/landing-prompts/*.txt).
// Usage: GEMINI_API_KEY=… node scripts/gen-landing-image.mjs <prompt.txt> <out.png> [aspect=9:16] [model]
// A model override must accept imageConfig.imageSize (Gemini 3 image models do; 2.5 Flash Image does not).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const [promptFile, out, aspectRatio = '9:16', model = 'gemini-3-pro-image'] = process.argv.slice(2);
if (!promptFile || !out) {
  console.error(
    'usage: node scripts/gen-landing-image.mjs <prompt.txt> <out.png> [aspect=9:16] [model]',
  );
  process.exit(2);
}
const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!key) {
  console.error('set GEMINI_API_KEY (or GOOGLE_API_KEY)');
  process.exit(2);
}

// The base URL and delay overrides exist only so tests can point at a local mock.
const BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com';
const RETRY_DELAY_MS = Number(process.env.GEMINI_RETRY_DELAY_MS ?? 30_000);
const RETRIES = 4;

const text = readFileSync(promptFile, 'utf8').trim();
// Each call is billed, so make sure the image has somewhere to land before asking for it.
mkdirSync(dirname(out), { recursive: true });
const body = JSON.stringify({
  contents: [{ parts: [{ text }] }],
  generationConfig: {
    responseModalities: ['IMAGE'],
    imageConfig: { aspectRatio, imageSize: '1K' },
  },
});

let res;
for (let attempt = 0; ; attempt++) {
  res = await fetch(`${BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body,
  });
  if (res.status !== 503 || attempt >= RETRIES) break;
  console.error(`503 (high demand), retry ${attempt + 1}/${RETRIES} in ${RETRY_DELAY_MS / 1000}s`);
  await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
}
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 1500)}`);
  process.exit(1);
}

const data = await res.json();
const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
if (!part) {
  console.error(`no image in the response: ${JSON.stringify(data).slice(0, 1500)}`);
  process.exit(1);
}
const bytes = Buffer.from(part.inlineData.data, 'base64');
if (part.inlineData.mimeType === 'image/png') {
  writeFileSync(out, bytes);
} else {
  // Gemini often answers with JPEG; re-encode so the .png is really a PNG. sharp comes in through next.
  const sharp = createRequire(createRequire(import.meta.url).resolve('next/package.json'))('sharp');
  await sharp(bytes).png().toFile(out);
}
console.log(`saved ${out}`, JSON.stringify(data.usageMetadata ?? {}));
