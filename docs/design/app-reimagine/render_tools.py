# Renders tool screens 50-62 only (same settings as render.py). Usage: python3 render_tools.py [prefix...]
import sys, os, asyncio
from playwright.async_api import async_playwright
B = os.path.dirname(os.path.abspath(__file__))
H, M = os.path.join(B,"html"), os.path.join(B,"mockups")
SCREENS = [("50-clips-home",1440,900,False),("51-clips-detalle",1440,900,False),("52-clips-ajustes",1440,900,False),
 ("53-senales-aviso",1440,900,False),("54-senales-home",1440,900,False),("55-senales-detalle",1440,900,False),("56-senales-avisos",1440,900,False),
 ("57-envivo-conectar",1440,900,False),("58-envivo-control",1440,900,False),("59-envivo-ajustes",1440,900,False),
 ("60-tool-no-abre",1440,900,False),("61-herramientas",1440,900,False),
 ("62-overview-herramientas",1600,900,True)]  # contact sheet last (embeds the others)
async def main(only):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--font-render-hinting=none"])
        for name,w,h,full in SCREENS:
            if only and not any(name.startswith(o) for o in only): continue
            f = os.path.join(H, name+".html")
            if not os.path.exists(f): continue
            pg = await br.new_page(viewport={"width":w,"height":h}, device_scale_factor=2)
            await pg.goto("file://"+f); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(250)
            await pg.wait_for_function("Array.from(document.images).every(i=>i.complete && i.naturalWidth>0)", timeout=20000)
            ov = await pg.evaluate("""()=>{const o=[];document.querySelectorAll('h1,h2,h3,h4,b,p,small,span,button,a,.ph').forEach(e=>{if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!='visible')o.push(e.textContent.slice(0,40))});
              const m=document.querySelector('.main'); const wrap=document.querySelector('.wrap');
              let bottom=0; if(wrap){wrap.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.height>0) bottom=Math.max(bottom,r.bottom)})}
              const wide=[]; if(wrap){const wr=wrap.getBoundingClientRect(); wrap.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.width>0 && r.right>wr.right+2) wide.push((e.className||e.tagName)+':'+Math.round(r.right))})}
              return [o, document.documentElement.scrollHeight, document.documentElement.scrollWidth, Math.round(bottom), m?m.scrollHeight:0, wide.slice(0,6)]}""")
            await pg.screenshot(path=os.path.join(M,name+".png"), full_page=full)
            print(name, "docH=%s docW=%s contentBottom=%s mainScrollH=%s"%(ov[1],ov[2],ov[3],ov[4]), "overflow:",ov[0], "wide:",ov[5])
            await pg.close()
        await br.close()
asyncio.run(main(sys.argv[1:]))
