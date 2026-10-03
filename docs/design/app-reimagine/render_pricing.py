# Captura 80-85 (tarjetas de precios). Playwright, device_scale_factor=2, Inter.
# Uso: python3 render_pricing.py [prefijo…]
import sys, os, asyncio
from playwright.async_api import async_playwright
B = os.path.dirname(os.path.abspath(__file__))
# PRICING_HTML / PRICING_OUT: renderizar desde/hacia otra carpeta (pruebas de layout en /tmp).
H = os.environ.get("PRICING_HTML", os.path.join(B, "html")); M = os.environ.get("PRICING_OUT", os.path.join(B, "mockups"))
SHOTS = [("80-precios-anual", 1440, 900), ("81-precios-mensual", 1440, 900), ("82-precios-prueba-usada", 1440, 900),
         ("83-precios-movil", 390, 844), ("84-precios-en", 1440, 900), ("84b-precios-en-ca", 1440, 900), ("85-precios-sin-prueba", 1440, 900)]
CHECK = r"""()=>{
  const out={};
  const vw=document.documentElement.clientWidth;
  const cards=[...document.querySelectorAll('.pk')].map(c=>c.getBoundingClientRect());
  out.cardH=cards.map(r=>Math.round(r.height)); out.cardX=cards.map(r=>[Math.round(r.left),Math.round(r.right)]);
  out.cut=cards.some(r=>r.left<0||r.right>vw);
  out.priceLines=[...document.querySelectorAll('.pk .pr')].map(p=>Math.round(p.getBoundingClientRect().height));
  out.spill=[...document.querySelectorAll('.pk')].flatMap(c=>{const r=c.getBoundingClientRect();return [...c.querySelectorAll('*')].filter(e=>{const q=e.getBoundingClientRect();return q.width>0&&!e.classList.contains('sr')&&(q.right>r.right-20||q.left<r.left+20)&&!e.classList.contains('tagx')&&!e.closest('.tagx')}).map(e=>e.className||e.tagName)});
  out.prOverflow=[...document.querySelectorAll('.pk .pr')].some(p=>p.scrollWidth>p.clientWidth+1);
  out.btnY=[...document.querySelectorAll('.pk .ct')].map(b=>Math.round(b.getBoundingClientRect().top));
  out.ftY=[...document.querySelectorAll('.pk .ft')].map(b=>Math.round(b.getBoundingClientRect().top));
  const ov=[];document.querySelectorAll('*').forEach(e=>{if(e.children.length==0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!='visible')ov.push(e.textContent.slice(0,40))});
  out.textOverflow=ov; out.docW=document.documentElement.scrollWidth; out.font=getComputedStyle(document.body).fontFamily;
  out.fontOk=document.fonts.check('16px Inter');
  return out}"""
async def main(only):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--font-render-hinting=none"])
        for name, w, h in SHOTS:
            if only and not any(name.startswith(o) for o in only): continue
            pg = await br.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            await pg.goto("file://" + os.path.join(H, name + ".html"))
            await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(250)
            info = await pg.evaluate(CHECK)
            await pg.locator("#precios").screenshot(path=os.path.join(M, name + ".png"))
            print(name, info)
            await pg.close()
        await br.close()
asyncio.run(main(sys.argv[1:]))
