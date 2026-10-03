# Captura 86-88 (Pro Lealtad). Playwright, 2x, Inter. Uso: python3 render_reducto.py [prefijo…]
import sys, os, asyncio
from playwright.async_api import async_playwright
B = os.path.dirname(os.path.abspath(__file__)); H, M = os.path.join(B, "html"), os.path.join(B, "mockups")
SHOTS = [("86-precios-reducto", 1440, 900, "#precios"), ("87-mi-plan-reducto", 1440, 900, None), ("88-reducto-movil", 390, 844, "#precios"), ("89-aviso-nuevo-precio", 1440, 900, None)]
CHECK = r"""()=>{const vw=document.documentElement.clientWidth;const o={};
 o.docW=document.documentElement.scrollWidth; o.vw=vw; o.docH=document.documentElement.scrollHeight;
 o.overflow=[];document.querySelectorAll('body *').forEach(e=>{if(e.children.length==0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!='visible')o.overflow.push(e.textContent.slice(0,40))});
 o.offscreen=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>vw+1||r.left<-1)&&!e.closest('.sr')}).map(e=>e.className||e.tagName).slice(0,8);
 const box=document.querySelector('.rd');if(box){const r=box.getBoundingClientRect();o.spill=[...box.querySelectorAll('*')].filter(e=>{const q=e.getBoundingClientRect();return q.width>0&&!e.closest('.tagx')&&(q.right>r.right+1||q.left<r.left-1)}).map(e=>e.className||e.tagName)}
 o.small=[];document.querySelectorAll('body *').forEach(e=>{if([...e.childNodes].some(n=>n.nodeType==3&&n.textContent.trim())){const fs=parseFloat(getComputedStyle(e).fontSize);if(fs<14.5)o.small.push(e.textContent.trim().slice(0,24)+':'+fs)}});
 o.fontOk=document.fonts.check('16px Inter'); return o}"""
async def main(only):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--font-render-hinting=none"])
        for name, w, h, sel in SHOTS:
            if only and not any(name.startswith(o) for o in only): continue
            pg = await br.new_page(viewport={"width": w, "height": h}, device_scale_factor=2)
            await pg.goto("file://" + os.path.join(H, name + ".html")); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(250)
            info = await pg.evaluate(CHECK)
            out = os.path.join(M, name + ".png")
            if sel: await pg.locator(sel).screenshot(path=out)
            else: await pg.screenshot(path=out)
            print(name, info); await pg.close()
        await br.close()
asyncio.run(main(sys.argv[1:]))
