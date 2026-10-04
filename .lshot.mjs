import { chromium } from '@playwright/test';
const [out, name, path = '/'] = process.argv.slice(2);
const b = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addCookies([{ name: 'chalyb_consent', value: 'v1.a0.p0', url: 'http://localhost:3123' }]);
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text().slice(0, 160)));
  await p.goto('http://localhost:3123' + path, { waitUntil: 'networkidle' });
  await p.screenshot({ path: `${out}/${name}-${w}-fold.png` });
  await p.screenshot({ path: `${out}/${name}-${w}-full.png`, fullPage: true });
  console.log(w, await p.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth > innerWidth, document.querySelectorAll('h1').length]), errs.slice(0, 5));
  await ctx.close();
}
await b.close();
