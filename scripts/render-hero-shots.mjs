// Renders the hero (hero-{laptop,phone}.webp) and the 3 steps (paso-N.webp) from HTML with the clip stills.
// Run: node scripts/render-hero-shots.mjs (fetches the Inter font, so it needs network).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';

// sharp comes in through next (not a direct dependency).
const sharp = createRequire(createRequire(import.meta.url).resolve('next/package.json'))('sharp');

const LANDING = fileURLToPath(new URL('../public/landing/', import.meta.url));
const img = (name) =>
  `data:image/webp;base64,${readFileSync(`${LANDING}${name}.webp`).toString('base64')}`;

const CLIPS = [
  { still: 'clip-1', time: '0:42', top: true, cap: '¡NO LO PUEDO <b>CREER</b>!', title: 'El mejor momento del stream' },
  { still: 'clip-2', time: '0:28', cap: 'ESTO FUE <b>ÉPICO</b>', title: 'Reacción épica' },
  { still: 'clip-3', time: '0:35', cap: 'ÚLTIMO <b>SEGUNDO</b>', title: 'La jugada final' },
  { still: 'clip-4', time: '0:51', cap: '¿QUÉ ME <b>RECOMIENDAN</b>?', title: 'Respondiendo al chat' },
  { still: 'clip-5', time: '0:19', cap: 'NO PUEDO <b>MÁS</b> JAJAJA', title: 'Risa con los amigos' },
  { still: 'clip-6', time: '0:47', cap: 'EL <b>TRUCO</b> ES ESTE', title: 'El consejo del día' },
];

const BASE = `
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, sans-serif; background: #f5f5f7; color: #1d1d1f; -webkit-font-smoothing: antialiased; }
  .ic { width: 1em; height: 1em; display: inline-block; vertical-align: -0.12em; }
</style>`;

const DL = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>';
const SH = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 15V4m-4 4 4-4 4 4M5 13v6h14v-6"/></svg>';

const laptop = `<!doctype html><html><head><meta charset="utf-8">${BASE}<style>
  body { width: 536px; height: 335px; padding: 7px 15px; }
  .top { display: flex; justify-content: space-between; align-items: center; font-size: 7.5px; font-weight: 600; }
  .pill { background: #fff; border-radius: 99px; padding: 4px 9px; box-shadow: 0 1px 4px #0001; }
  h1 { font-size: 15.5px; font-weight: 800; letter-spacing: -0.03em; margin-top: 11px; }
  .row { display: flex; justify-content: space-between; align-items: flex-end; }
  .sub { font-size: 7.5px; color: #6e6e73; margin-top: 3px; }
  .btns { display: flex; gap: 5px; }
  .b { font-size: 7.5px; font-weight: 600; border-radius: 6px; padding: 6px 10px; }
  .b1 { background: #fff; color: #5b4bff; border: 1px solid #ddd; } .b2 { background: #5b4bff; color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px; margin-top: 12px; }
  .card { background: #fff; border-radius: 9px; padding: 4px; box-shadow: 0 1px 5px #0000000f; }
  .th { position: relative; aspect-ratio: 9 / 16; border-radius: 6px; background-size: cover; background-position: center; overflow: hidden; }
  .th::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 45%, #000a); }
  .t { position: absolute; top: 4px; right: 4px; background: #000a; color: #fff; font-size: 6px; font-weight: 700; padding: 1px 4px; border-radius: 4px; z-index: 1; }
  .tag { position: absolute; top: 4px; left: 4px; background: #ffd60a; font-size: 5.5px; font-weight: 800; padding: 1px 4px; border-radius: 4px; z-index: 1; }
  .cap { position: absolute; left: 3px; right: 3px; bottom: 14px; text-align: center; color: #fff; font-size: 7px; font-weight: 900; line-height: 1.1; z-index: 1; text-shadow: 0 1px 2px #000; }
  .cap b { color: #ffd60a; }
  .ti { font-size: 6.5px; font-weight: 600; margin: 4px 2px 0; height: 16px; line-height: 1.2; }
  .me { font-size: 5.5px; color: #8e8e93; margin: 1px 2px 4px; }
  .d { background: #5b4bff; color: #fff; font-size: 6px; font-weight: 600; text-align: center; border-radius: 5px; padding: 4px 0; }
  .s { background: #f2f2f7; font-size: 6px; font-weight: 600; text-align: center; border-radius: 5px; padding: 4px 0; margin-top: 3px; }
  .foot { text-align: center; font-size: 6.5px; color: #6e6e73; margin-top: 10px; }
</style></head><body>
  <div class="top"><span class="pill">‹ Inicio</span><span>✂ Hacer clips</span><span class="pill">✕</span></div>
  <div class="row"><div><h1>Tus clips están listos 🎉</h1><p class="sub">Hicimos 6 clips de “Noche de preguntas”. Ya tienen subtítulos.</p></div>
    <div class="btns"><span class="b b1">＋ Hacer más clips</span><span class="b b2">${DL} Descargar todos</span></div></div>
  <div class="grid">${CLIPS.map((c) => `<div class="card">
    <div class="th" style="background-image:url(${img(c.still)})">${c.top ? '<span class="tag">★ Top</span>' : ''}<span class="t">${c.time}</span><p class="cap">${c.cap}</p></div>
    <p class="ti">${c.title}</p><p class="me">Vertical · con subtítulos</p>
    <div class="d">${DL} Descargar</div><div class="s">${SH} Compartir</div></div>`).join('')}</div>
  <p class="foot">Tus clips se guardan en <b>Mis resultados</b>. Puedes volver por ellos cuando quieras.</p>
</body></html>`;

const phone = `<!doctype html><html><head><meta charset="utf-8">${BASE}<style>
  body { width: 200px; height: 433px; background: #fff; padding: 9px 9px 0; display: flex; flex-direction: column; }
  .st { display: flex; justify-content: space-between; font-size: 7px; font-weight: 700; padding: 0 6px; }
  .hd { display: flex; align-items: center; gap: 4px; margin-top: 9px; font-size: 8.5px; font-weight: 700; }
  .lg { width: 12px; height: 12px; border-radius: 3px; background: #5b4bff; color: #fff; font-size: 7px; display: grid; place-items: center; }
  h1 { font-size: 11.5px; font-weight: 800; letter-spacing: -0.02em; margin: 12px 0 7px; }
  .it { display: flex; gap: 7px; align-items: center; border: 1px solid #e5e5ea; border-radius: 8px; padding: 7px; margin-bottom: 5px; }
  .it.on { border: 1.5px solid #5b4bff; }
  .ico { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; color: #fff; font-size: 10px; flex: none; }
  .k { font-size: 4.8px; font-weight: 800; letter-spacing: .06em; }
  .n { font-size: 7px; font-weight: 700; } .x { font-size: 5.5px; color: #6e6e73; }
  .lt { font-size: 7px; font-weight: 700; margin: 9px 0 5px; }
  .last { position: relative; height: 196px; border-radius: 9px; background: url(${img('clip-hero')}) center 30% / cover; overflow: hidden; }
  .last::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 50%, #000b); }
  .last p { position: absolute; left: 7px; bottom: 6px; color: #fff; z-index: 1; font-size: 7px; font-weight: 700; }
  .last span { display: block; font-size: 5.5px; font-weight: 500; opacity: .85; }
  .pro { margin-top: 6px; background: #f2f0ff; border-radius: 7px; font-size: 6px; font-weight: 600; padding: 5px 7px; }
  .nav { margin-top: auto; display: flex; justify-content: space-around; border-top: 1px solid #eee; padding: 6px 0 10px; font-size: 5.5px; color: #8e8e93; }
  .nav b { color: #5b4bff; }
</style></head><body>
  <div class="st"><span>9:41</span><span>●●● ▮</span></div>
  <div class="hd"><span class="lg">C</span>Chalyb</div>
  <h1>¿Qué quieres hacer hoy?</h1>
  <div class="it on"><span class="ico" style="background:#5b4bff">✂</span><div><p class="k" style="color:#5b4bff">CLIPS</p><p class="n">Hacer clips de mi stream</p><p class="x">Para TikTok, Reels y Shorts.</p></div></div>
  <div class="it"><span class="ico" style="background:#ff375f">◉</span><div><p class="k" style="color:#ff375f">EN VIVO</p><p class="n">Manejar mi transmisión</p><p class="x">Controla OBS desde tu celular.</p></div></div>
  <p class="lt">Lo último</p>
  <div class="last"><p>¡No me lo esperaba! · 0:24<span>Listo para TikTok · con subtítulos</span></p></div>
  <p class="pro">✓ Todo incluido en tu plan Pro</p>
  <div class="nav"><b>Inicio</b><span>Resultados</span><span>Cuenta</span></div>
</body></html>`;

const STEP = `<!doctype html><html><head><meta charset="utf-8">${BASE}<style>
  body { width: 340px; height: 135px; background: #fff; padding: 8px 12px; text-align: center; overflow: hidden; }
  .dots { display: flex; gap: 3px; justify-content: center; } .dots i { width: 16px; height: 3px; border-radius: 2px; background: #e5e5ea; } .dots i.on { background: #5b4bff; }
  .of { font-size: 5px; color: #8e8e93; margin-top: 2px; }
  h2 { font-size: 10px; font-weight: 800; margin-top: 5px; letter-spacing: -0.02em; } .sub { font-size: 5.5px; color: #6e6e73; margin-top: 2px; }
</style>`;
const dots = (n) => `<div class="dots">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}"></i>`).join('')}</div><p class="of">Paso ${n} de 3</p>`;

const paso1 = `${STEP}<style>
  .in { margin: 8px auto 0; width: 250px; display: flex; gap: 4px; align-items: center; border: 1.5px solid #5b4bff; border-radius: 7px; padding: 3px 3px 3px 7px; font-size: 6.5px; text-align: left; }
  .in span { flex: 1; color: #1d1d1f; } .in b { background: #5b4bff; color: #fff; border-radius: 5px; padding: 4px 9px; font-size: 6px; }
  .vid { margin: 6px auto 0; width: 250px; display: flex; gap: 7px; align-items: center; background: #f5f5f7; border-radius: 7px; padding: 4px; text-align: left; }
  .th { width: 64px; height: 36px; border-radius: 4px; background: url(${img('tool-envivo')}) center / cover; position: relative; }
  .th i { position: absolute; right: 2px; bottom: 2px; background: #000b; color: #fff; font-size: 4.5px; font-style: normal; padding: 0 2px; border-radius: 2px; }
  .vid p { font-size: 6.5px; font-weight: 700; } .vid span { font-size: 5px; color: #34a853; font-weight: 600; }
</style></head><body>${dots(1)}<h2>Pega el enlace de tu stream o video</h2><p class="sub">Copia la dirección de tu video y pégala aquí. Nosotros hacemos el resto.</p>
  <div class="in"><span>🔗 youtube.com/live/noche-de-preguntas</span><b>Pegar</b></div>
  <div class="vid"><div class="th"><i>2:14:08</i></div><div><p>Noche de preguntas 🔴 EN VIVO</p><span>✓ Video encontrado · listo para hacer clips</span></div></div>
</body></html>`;

const paso2 = `${STEP}<style>
  .opts { display: flex; gap: 6px; justify-content: center; margin-top: 7px; }
  .o { border: 1px solid #e5e5ea; border-radius: 7px; padding: 4px; width: 92px; }
  .o.on { border: 1.5px solid #5b4bff; box-shadow: 0 0 0 2px #efedff; }
  .f { margin: 0 auto; border-radius: 4px; background-size: cover; background-position: center; }
  .o p { font-size: 6px; font-weight: 700; margin-top: 3px; } .o span { font-size: 5px; color: #8e8e93; }
  .rec { display: inline-block; background: #5b4bff; color: #fff; font-size: 4.5px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-bottom: 2px; }
</style></head><body>${dots(2)}<h2>¿Dónde los vas a publicar?</h2>
  <div class="opts">
    <div class="o on"><span class="rec">Recomendado</span><div class="f" style="width:26px;height:46px;background-image:url(${img('clip-1')})"></div><p>TikTok / Reels / Shorts</p><span>Vertical</span></div>
    <div class="o" style="padding-top:12px"><div class="f" style="width:72px;height:41px;background-image:url(${img('tool-envivo')})"></div><p>YouTube</p><span>Horizontal</span></div>
    <div class="o" style="padding-top:12px"><div class="f" style="width:41px;height:41px;background-image:url(${img('clip-4')})"></div><p>Cuadrado</p><span>Instagram</span></div>
  </div>
</body></html>`;

const paso3 = `${STEP}<style>
  body { text-align: left; } .of { text-align: center; }
  .row { display: flex; justify-content: space-between; align-items: center; margin-top: 3px; }
  h2 { margin: 0; } .dl { background: #5b4bff; color: #fff; font-size: 5.5px; font-weight: 600; border-radius: 4px; padding: 3px 6px; }
  .g { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-top: 5px; }
  .c { position: relative; aspect-ratio: 9 / 16; border-radius: 4px; background-size: cover; background-position: center; overflow: hidden; }
  .c::after { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 50%, #000a); }
  .c p { position: absolute; left: 2px; right: 2px; bottom: 5px; z-index: 1; color: #fff; font-size: 4.5px; font-weight: 900; text-align: center; line-height: 1.1; }
  .c p b { color: #ffd60a; } .c i { position: absolute; top: 2px; right: 2px; z-index: 1; background: #000a; color: #fff; font-size: 4px; font-style: normal; padding: 0 2px; border-radius: 2px; }
</style></head><body>${dots(3)}<div class="row"><h2>Tus clips están listos 🎉</h2><span class="dl">⬇ Descargar todos</span></div>
  <div class="g">${CLIPS.map((c) => `<div class="c" style="background-image:url(${img(c.still)})"><i>${c.time}</i><p>${c.cap}</p></div>`).join('')}</div>
</body></html>`;

const browser = await chromium.launch();
async function shot(html, w, h, name) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  if (!(await page.evaluate(() => document.fonts.check('800 12px Inter'))))
    throw new Error('Inter did not load: the shots would render in a fallback font');
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82 }).toFile(`${LANDING}${name}.webp`);
  await page.close();
}
await shot(laptop, 536, 335, 'hero-laptop');
await shot(phone, 200, 433, 'hero-phone');
await shot(paso1, 340, 135, 'paso-1');
await shot(paso2, 340, 135, 'paso-2');
await shot(paso3, 340, 135, 'paso-3');
await browser.close();
console.log('wrote hero-laptop, hero-phone and paso-1..3 (.webp)');
