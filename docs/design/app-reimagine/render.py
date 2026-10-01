import sys, os, asyncio
from playwright.async_api import async_playwright
B = os.path.dirname(os.path.abspath(__file__))
H, M = os.path.join(B,"html"), os.path.join(B,"mockups")
SCREENS = [("01-inicio",1440,900,False),("02-clips-paso1",1440,900,False),("03-clips-paso2",1440,900,False),
 ("04-clips-creando",1440,900,False),("05-clips-listos",1440,900,False),("06-avanzado",1440,900,True),
 ("07-mi-cuenta",1440,900,False),("08-inicio-movil",390,844,False),("00-overview",1600,900,True),
 # ---- extended screens 10-30 (09 contact sheet last, it embeds the others) ----
 ("10-landing",1440,900,True),("11-landing-movil",390,844,True),("12-planes",1440,900,True),
 ("13-crear-cuenta",1440,900,False),("14-tu-prueba",1440,900,True),("15-pago",1440,900,True),("16-listo",1440,900,False),
 ("17-banners",1440,900,True),("18-cancelar",1440,900,False),
 ("19-mis-resultados",1440,900,False),("20-senales-paso1",1440,900,False),("21-senales-listo",1440,900,False),
 ("22-en-vivo",1440,900,False),("23-mas-herramientas",1440,900,True),("24-vacio-y-error",1440,900,False),
 ("25-ayuda",1440,900,False),("26-notificaciones",390,844,False),
 ("27-admin-centro",1440,900,False),("28-admin-personas",1440,900,False),("29-admin-dinero",1440,900,False),
 ("30-mi-plan",1440,900,False),
 ("09-overview-completo",1600,900,True)]
async def main(only):
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--font-render-hinting=none"])
        for name,w,h,full in SCREENS:
            if only and not any(name.startswith(o) for o in only): continue
            f = os.path.join(H, name+".html")
            if not os.path.exists(f): continue
            pg = await br.new_page(viewport={"width":w,"height":h}, device_scale_factor=2)
            await pg.goto("file://"+f); await pg.evaluate("document.fonts.ready"); await pg.wait_for_timeout(250)
            # overflow check
            ov = await pg.evaluate("""()=>{const o=[];document.querySelectorAll('h1,h2,h3,h4,b,p,small,span,button,.ph').forEach(e=>{if(e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!='visible')o.push(e.textContent.slice(0,40))});return [o, document.documentElement.scrollHeight, document.documentElement.scrollWidth]}""")
            await pg.screenshot(path=os.path.join(M,name+".png"), full_page=full)
            print(name, "docH=%s docW=%s"%(ov[1],ov[2]), "overflow:",ov[0])
            await pg.close()
        await br.close()
asyncio.run(main(sys.argv[1:]))
