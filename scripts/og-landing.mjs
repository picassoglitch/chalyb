// Builds public/og/landing.png, the landing's 1200×630 share card
// (LANDING-SPEC §6): the hero composite (laptop + phone) on --bg with the h1.
// No prices. Rerun after the hero images or the h1 change:
//   node scripts/og-landing.mjs
// The h1 is read from messages/es.json, the colors from chalyb-tokens.css.

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const dataUri = (p) => `data:image/webp;base64,${read(p).toString('base64')}`;
const tokens = read('src/styles/chalyb-tokens.css').toString();
const token = (name) => tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))[1];
const h1 = JSON.parse(read('messages/es.json')).landing.hero.title;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&display=block">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: ${token('bg')};
    font-family: Inter, sans-serif; color: ${token('ink')}; position: relative; }
  .brand { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 14px;
    font-weight: 700; font-size: 34px; letter-spacing: -0.02em; }
  h1 { position: absolute; left: 72px; top: 196px; width: 560px; font-weight: 800;
    font-size: 84px; line-height: 1.02; letter-spacing: -0.045em; }
  h1 em { font-style: normal; color: ${token('accent')}; display: block; }
  .halo { position: absolute; right: -80px; top: 60px; width: 720px; height: 520px; border-radius: 50%;
    background: radial-gradient(closest-side, ${token('accent')}22, transparent); }
  .laptop { position: absolute; left: 600px; top: 150px; width: 520px; }
  .screen { background: #1d1d1f; border-radius: 18px 18px 0 0; padding: 12px 12px 14px; }
  .screen img { display: block; width: 100%; border-radius: 6px; }
  .base { height: 18px; margin: 0 -34px; background: linear-gradient(#e4e4e9, #c9c9d0);
    border-radius: 0 0 16px 16px; box-shadow: 0 24px 50px rgba(29,29,31,.18); }
  .phone { position: absolute; left: 990px; top: 214px; width: 182px; padding: 7px;
    background: #1d1d1f; border-radius: 30px; box-shadow: 0 24px 50px rgba(29,29,31,.25); }
  .phone img { display: block; width: 100%; border-radius: 24px; }
</style></head><body>
  <div class="brand">Chalyb</div>
  <h1>${h1}</h1>
  <div class="halo"></div>
  <div class="laptop"><div class="screen"><img src="${dataUri('public/landing/hero-laptop.webp')}" alt=""></div><div class="base"></div></div>
  <div class="phone"><img src="${dataUri('public/landing/hero-phone.webp')}" alt=""></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: new URL('public/og/landing.png', root).pathname, type: 'png' });
await browser.close();
console.log('wrote public/og/landing.png');
