# Renders ONLY the fix-3 screens (70-74). Same settings as render.py/render_tools.py (Chrome headless, 2x, Inter).
# Usage: python3 render_fix3.py [prefix...]
import sys, os, asyncio
from playwright.async_api import async_playwright
B = os.path.dirname(os.path.abspath(__file__))
H, M = os.path.join(B,"html"), os.path.join(B,"mockups")
SCREENS = [("70-mi-plan-gratis",1440,900,False),("71-mi-plan-pro",1440,900,False),("72-creditos",1440,900,False),
 ("72b-creditos-comprar",1440,900,False),("73-perfil",1440,900,False),("74-estados-fix3",1440,900,True)]
async def main(only):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--font-render-hinting=none"])
        for name,w,h,full in SCREENS:
            if only and not any(name.startswith(o) for o in only): continue
            f = os.path.join(H, name+".html")
            pg = await br.new_page(viewport={"width":w,"height":h}, device_scale_factor=2)
            await pg.goto("file://"+f); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(250)
            ov = await pg.evaluate("""()=>{const o=[];document.querySelectorAll('h1,h2,h3,b,p,small,span,button,a,li,div').forEach(e=>{if(e.children.length==0&&e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!='visible')o.push(e.textContent.slice(0,40))});
              const wrap=document.querySelector('.wrap'); let bottom=0; if(wrap){wrap.querySelectorAll('*').forEach(e=>{const r=e.getBoundingClientRect(); if(r.height>0) bottom=Math.max(bottom,r.bottom)})}
              const small=[];document.querySelectorAll('body *').forEach(e=>{if(e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType==3&&n.textContent.trim())){const fs=parseFloat(getComputedStyle(e).fontSize); if(fs<15) small.push(e.textContent.trim().slice(0,30)+':'+fs)}});
              const mono=[];document.querySelectorAll('body *').forEach(e=>{if(/mono/i.test(getComputedStyle(e).fontFamily))mono.push(e.tagName)});
              return [o, document.documentElement.scrollHeight, Math.round(bottom), small.slice(0,12), mono.length]}""")
            await pg.screenshot(path=os.path.join(M,name+".png"), full_page=full)
            print(name, "docH=%s contentBottom=%s"%(ov[1],ov[2]), "overflow:",ov[0], "text<15px:",ov[3], "mono:",ov[4])
            await pg.close()
        await br.close()
asyncio.run(main(sys.argv[1:]))
