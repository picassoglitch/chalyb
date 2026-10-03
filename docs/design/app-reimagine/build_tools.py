# Tool interiors (screens 50-62): Clips, Señales, En vivo + shared states.
# Safe add-on: loads build.py helpers in a sandbox (its writes go to a temp dir),
# then writes ONLY html/50-*.html … html/62-*.html. Uses the same html/style.css.
# Run: python3 build_tools.py && python3 render_tools.py
import os, tempfile, glob
B = os.path.dirname(os.path.abspath(__file__))
_T = tempfile.mkdtemp(prefix="chalyb_base_")
os.makedirs(os.path.join(_T, "html")); os.makedirs(os.path.join(_T, "mockups"))
for _m in glob.glob(os.path.join(B, "more_*.py")):
    os.symlink(_m, os.path.join(_T, os.path.basename(_m)))
_G = {"__file__": os.path.join(_T, "build.py"), "__name__": "chalyb_base"}
_src = open(os.path.join(B, "build.py"), encoding="utf-8").read()
import contextlib, io
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(_src, "build.py", "exec"), _G)
globals().update({k: v for k, v in _G.items() if not k.startswith("__")})
H = os.path.join(B, "html")
def write(name, html):
    with open(os.path.join(H, name), "w", encoding="utf-8") as f: f.write(html)

P.update({
 "edit":'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 "monitor":'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
 "laptop":'<rect x="4" y="4" width="16" height="11" rx="2"/><path d="M2 19h20"/>',
 "plug":'<path d="M9 2v6M15 2v6"/><path d="M6 8h12v3a6 6 0 0 1-12 0z"/><path d="M12 17v5"/>',
 "wifi":'<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/>',
 "key":'<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
 "play":'<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>',
 "vol":'<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
 "full":'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
 "square":'<rect x="5" y="5" width="14" height="14" rx="2"/>',
 "vert":'<rect x="7" y="2.5" width="10" height="19" rx="2"/>',
 "horiz":'<rect x="2.5" y="6" width="19" height="12" rx="2"/>',
 "headset":'<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="2.5" y="14" width="5" height="7" rx="2"/><rect x="16.5" y="14" width="5" height="7" rx="2"/>',
 "coffee":'<path d="M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M7 2.5v2.5M11 2.5v2.5"/>',
})
TOOL = {
 "clips":  ("Clips","scissors","#5B4BFF",["Hacer clips","Mis clips","Ajustes"]),
 "senales":("Señales","trend","#FF9F0A",["Señales","Historial","Ajustes"]),
 "envivo": ("En vivo","live","#FF375F",["Transmitir","Mis transmisiones","Ajustes"]),
}
def thead(key, tab, crumb="Inicio ›"):
    name, icon, col, tabs = TOOL[key]
    t = "".join(f'<a class="{"on" if k==tab else ""}">{x}</a>' for k, x in enumerate(tabs))
    return f'''<div class="crumb">{crumb}</div><div class="th">{toolicon(icon,col,64,18,32)}
<div class="tt"><h1>{name}</h1><span class="pill ok">{ic("check")}Incluido en tu plan</span></div>
<nav class="ttabs">{t}</nav></div>'''
def shell(key, tab, inner, crumb="Inicio ›"):
    return f'<div class="app">{sidebar("inicio")}<main class="main"><div class="wrap">{thead(key,tab,crumb)}<div class="tb">{inner}</div></div></main></div>'
def advbar(sub, label="Para creadores profesionales"):
    return f'<div class="advbar">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><span class="pro">{label}</span><small>{sub}</small>{ic("chevd","i chev")}</div>'
def disc_footer():
    return f'<div class="dfoot">{ic("info")}<span><b>Esto es informativo, no es asesoría financiera.</b> Las señales son iguales para todos y no usan tus saldos ni tus inversiones. Tú decides.</span><a class="lnk">Leer aviso completo</a></div>'

TS = '''
.main{padding:34px 64px 30px}
.crumb{font-size:17px;color:var(--ink2);font-weight:500;margin-bottom:8px}
.th{display:flex;align-items:center;gap:18px}
.th .tt{display:flex;flex-direction:column;align-items:flex-start;gap:7px}
.th h1{font-size:36px;line-height:1.02}
.ttabs{margin-left:auto;display:flex;background:#EBEBF0;border-radius:16px;padding:4px;gap:4px}
.ttabs a{height:50px;padding:0 22px;display:flex;align-items:center;border-radius:13px;font-size:18px;font-weight:600;color:var(--ink2);white-space:nowrap}
.ttabs a.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10),0 0 0 .5px rgba(0,0,0,.04)}
.tb{margin-top:24px}
.sec{display:flex;align-items:baseline;justify-content:space-between;margin:24px 0 12px}
.sec h3{font-size:22px;font-weight:650;letter-spacing:-.02em}
.sec a{font-size:17px;color:var(--accent);font-weight:600}
.sec small{font-size:16px;color:var(--ink3)}
.advbar{display:flex;align-items:center;gap:14px;padding:0 22px 0 24px;height:66px;border-radius:20px;box-shadow:inset 0 0 0 1.5px #DEDEE4}
.advbar .ic2{color:var(--ink2)} .advbar b{font-size:19px;font-weight:600;white-space:nowrap}
.advbar .pro{background:var(--tint);color:var(--accent);font-size:14px;font-weight:700;padding:5px 12px;border-radius:999px;white-space:nowrap}
.advbar small{font-size:16px;color:var(--ink3);margin-left:auto;margin-right:4px;white-space:nowrap}
.advbar .chev{color:var(--ink3)}
.gh2{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 4px;font-size:17px;font-weight:650}
.gh2 a{font-size:16px;color:var(--accent);font-weight:600}
.ok2{color:var(--ok);font-weight:600;font-size:17px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.ok2 svg{width:18px;height:18px;stroke-width:3}
.conn2{font-size:17px;color:var(--accent);font-weight:600;white-space:nowrap}
.row .brand{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none;background:#F2F2F6}
.dfoot{display:flex;align-items:center;gap:14px;padding:14px 20px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 2px #E4E0FF;font-size:17px;line-height:1.4}
.dfoot svg.i{color:var(--accent);width:24px;height:24px}
.dfoot a{margin-left:auto;white-space:nowrap;font-size:16.5px}
.note2{font-size:16px;color:var(--ink3);display:flex;align-items:center;gap:8px}
.note2 svg.i{width:18px;height:18px}
.vpill{display:inline-flex;align-items:center;gap:8px;font-size:20px;font-weight:700;letter-spacing:-.02em;padding:6px 14px 6px 10px;border-radius:12px;white-space:nowrap}
.vpill svg.i{width:21px;height:21px;stroke-width:2.6}
.v-buy{background:var(--tint);color:var(--accent)} .v-sell{background:var(--warn-tint);color:var(--warn)} .v-wait{background:#EEEEF2;color:var(--ink2)}
.btn-okl{background:#fff;color:var(--ok);box-shadow:inset 0 0 0 1.5px #BFE6CD}
'''
def tpage(title, body, css=""): return page2(title, body, TS + css)
def brand(svg): return f'<div class="brand">{svg}</div>'
def okc(t="Conectado"): return f'<span class="ok2">{ic("check")}{t}</span>'
def row(left, title, right="", sub="", chev=False, cls=""):
    s = f"<small>{sub}</small>" if sub else ""
    c = ic("chev","i chev") if chev else ""
    return f'<div class="row {cls}">{left}<div class="tx"><b>{title}</b>{s}</div>{right}{c}</div>'

# ============================== 50 CLIPS HOME ==============================
css50 = '''
.sec{margin:20px 0 10px}
.g50{display:grid;grid-template-columns:1fr 340px;gap:20px}
.hero{position:relative;overflow:hidden;padding:24px 28px 22px;display:flex;gap:24px;box-shadow:0 0 0 2px var(--accent),var(--shadow-lg);border-radius:24px;background:#fff}
.hero .tx{flex:1;min-width:0}
.hero h2{font-size:30px;font-weight:700;letter-spacing:-.025em;margin-top:2px}
.hero p{font-size:18.5px;color:var(--ink2);margin-top:6px;line-height:1.4;max-width:470px}
.hero .btn-xl{width:auto;padding:0 34px;margin-top:18px;height:64px}
.hero .hint{font-size:16px;color:var(--ink3);margin-top:10px}
.fan{position:relative;width:196px;flex:none;margin-right:-6px}
.fan .thumb{position:absolute;box-shadow:0 10px 24px rgba(20,20,60,.22),0 0 0 3px #fff}
.acc .row{min-height:62px}
.acc .row + .row::before{left:74px}
.proc{display:flex;align-items:center;gap:20px;padding:12px 18px 12px 12px}
.proc .tx{flex:1;min-width:0}
.proc .tx b{font-size:19px;font-weight:650;display:block}
.proc .tx small{font-size:16.5px;color:var(--ink2)}
.bar2{width:300px;flex:none}
.bar2 .m{height:12px;border-radius:6px;background:#ECEBF3;overflow:hidden}
.bar2 .m i{display:block;height:100%;width:68%;border-radius:6px;background:linear-gradient(90deg,#8A7DFF,#5B4BFF)}
.bar2 .l{display:flex;justify-content:space-between;font-size:15px;color:var(--ink3);margin-top:6px}
.bar2 .l b{color:var(--accent);font-weight:700}
.proc .btn{height:50px;font-size:17px;padding:0 20px;border-radius:14px}
.g6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}
.mc6{background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:8px 8px 12px}
.mc6 b{display:block;font-size:16px;font-weight:650;margin:9px 4px 0;line-height:1.25;height:40px;overflow:hidden}
.mc6 small{display:block;font-size:14.5px;color:var(--ink3);margin:2px 4px 0}
.mc6 .thumb .cap{font-size:14px}
'''
fan = (thumb(2, 92, 164, radius=14, play=False).replace('class="thumb" style="', 'class="thumb" style="left:6px;top:26px;transform:rotate(-8deg);')
     + thumb(4, 92, 164, radius=14, play=False).replace('class="thumb" style="', 'class="thumb" style="left:104px;top:22px;transform:rotate(7deg);')
     + thumb(0, 100, 178, radius=14, playsize=40, cap="¡QUÉ <em>JUGADA</em>!").replace('class="thumb" style="', 'class="thumb" style="left:52px;top:4px;z-index:2;'))
accounts = f'''<div class="group acc"><div class="gh2">Cuentas conectadas<a>Ajustes</a></div>
{row(brand(YT),"YouTube",okc(),"@MariaEnVivo")}
{row(brand(TW),"Twitch",'<span class="conn2">Conectar</span>')}
{row(brand(TT),"TikTok",'<span class="conn2">Conectar</span>')}</div>'''
MINI = [("El mejor momento del stream","0:42","¡NO LO PUEDO <em>CREER</em>!"),("Reacción épica","0:28","ESTO FUE <em>ÉPICO</em>"),
        ("La jugada final","0:35","ÚLTIMO <em>SEGUNDO</em>"),("Respondiendo al chat","0:51","¿QUÉ ME <em>DICEN</em>?"),
        ("Risa con los amigos","0:19","NO PUEDO <em>MÁS</em>"),("El consejo del día","0:47","EL <em>TRUCO</em>")]
g6 = "".join(f'<div class="mc6">{thumb(k,144,128,dur=d,radius=12,playsize=36).replace("width:144px","width:100%")}<b>{t}</b><small>Ayer · Vertical</small></div>' for k,(t,d,c) in enumerate(MINI))
in50 = f'''<div class="g50"><div class="hero"><div class="tx"><h2>Hacer clips nuevos</h2>
<p>Pega el enlace de tu stream o video. Te damos clips con subtítulos, listos para publicar.</p>
<button class="btn btn-primary btn-xl">{ic("scissors")}Hacer clips nuevos</button>
<div class="hint">Toma 1 minuto. Funciona con YouTube, Twitch, Kick y Facebook.</div></div><div class="fan">{fan}</div></div>{accounts}</div>
<div class="sec"><h3>En proceso</h3><small>Te avisamos cuando estén listos</small></div>
<div class="card proc">{thumb(3,38,64,radius=9,play=False)}<div class="tx"><b>Clips de “Torneo del sábado”</b><small>Agregando subtítulos… Faltan unos 3 minutos.</small></div>
<div class="bar2"><div class="m"><i></i></div><div class="l"><span>Paso 3 de 4</span><b>68%</b></div></div><button class="btn btn-gray">Ver avance</button></div>
<div class="sec"><h3>Tus últimos clips</h3><a>Ver todos (12)</a></div><div class="g6">{g6}</div>'''
write("50-clips-home.html", tpage("Clips", shell("clips", 0, in50), css50))

# ============================== 51 CLIP DETALLE ==============================
css51 = '''
.tb{margin-top:18px}
.bk{display:flex;align-items:center;justify-content:space-between}
.bk .nav2{display:flex;align-items:center;gap:10px;font-size:17px;color:var(--ink2);font-weight:500}
.bk .nav2 button{width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:var(--shadow);display:grid;place-items:center;color:var(--ink2)}
.bk .nav2 button svg{width:22px;height:22px}
.d51{display:grid;grid-template-columns:352px 1fr;gap:40px;margin-top:16px;align-items:start}
.player{position:relative;border-radius:22px;overflow:hidden;box-shadow:var(--shadow-lg)}
.player .ctl{position:absolute;left:0;right:0;bottom:0;padding:14px 16px 16px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.55));display:flex;align-items:center;gap:12px;color:#fff;z-index:3}
.player .ctl .pp{width:46px;height:46px;border-radius:50%;background:#fff;color:var(--ink);display:grid;place-items:center;flex:none}
.player .ctl .pp svg{width:20px;height:20px;margin-left:2px}
.player .ctl .sc{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.35);position:relative}
.player .ctl .sc i{position:absolute;left:0;top:0;bottom:0;width:31%;border-radius:3px;background:#fff}
.player .ctl .sc i::after{content:"";position:absolute;right:-7px;top:-4px;width:14px;height:14px;border-radius:50%;background:#fff}
.player .ctl span{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.player .ctl svg.i{width:22px;height:22px}
.player .thumb .cap{bottom:21%;font-size:24px}
.ed > * + *{margin-top:14px}
.ed .field{margin-top:0}
.ed .field label{display:flex;justify-content:space-between}
.ed .field label small{font-size:15px;color:var(--ink3);font-weight:500}
.ed .in{color:var(--ink);font-weight:600}
.ed .in svg.i{margin-left:auto;color:var(--accent)}
.trim{padding:14px 18px 14px}
.trim .h{display:flex;align-items:baseline;justify-content:space-between}
.trim .h b{font-size:19px;font-weight:600}.trim .h small{font-size:15.5px;color:var(--ink3)}
.strip2{position:relative;height:66px;margin-top:12px;border-radius:12px;overflow:hidden;display:flex}
.strip2 .fr{flex:1;position:relative;overflow:hidden}
.strip2 .shade{position:absolute;top:0;bottom:0;background:rgba(245,245,247,.72)}
.strip2 .selx{position:absolute;top:0;bottom:0;left:7%;right:16%;box-shadow:inset 0 0 0 3px var(--accent);border-radius:10px}
.strip2 .hd{position:absolute;top:0;bottom:0;width:22px;background:var(--accent);display:grid;place-items:center}
.strip2 .hd::after{content:"";width:4px;height:24px;border-radius:2px;background:#fff}
.tl{display:flex;justify-content:space-between;margin-top:10px;font-size:16.5px;color:var(--ink2)}
.tl b{color:var(--ink);font-variant-numeric:tabular-nums}
.ed .row{min-height:64px}
.fmtl{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 12px 18px}
.fmtl b{font-size:19px;font-weight:600}
.seg3{display:flex;background:#EBEBF0;border-radius:14px;padding:4px;gap:4px}
.seg3 span{height:48px;padding:0 16px;display:flex;align-items:center;gap:8px;border-radius:11px;font-size:17px;font-weight:600;color:var(--ink2)}
.seg3 span svg.i{width:20px;height:20px}
.seg3 span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.acts2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.acts2 .btn{width:100%;height:58px;font-size:18px}
.acts2 .btn-primary{grid-column:1/3;height:68px;font-size:21px;border-radius:18px}
.ed .note2{justify-content:center}
'''
frames = "".join(f'<div class="fr">{thumb(k%6,60,66,radius=0,play=False).replace("width:60px","width:100%")}</div>' for k in range(9))
player = thumb(0, 352, 626, cap="¡NO LO PUEDO <em>CREER</em>!", radius=0, play=False)
in51 = f'''<div class="bk"><button class="back">{ic("chevl")}Mis clips</button><div class="nav2"><button>{ic("chevl")}</button>Clip 1 de 6<button>{ic("chev")}</button></div></div>
<div class="d51"><div class="player">{player}<div class="ctl"><div class="pp">{ic("play")}</div><span>0:12</span><div class="sc"><i></i></div><span>0:39</span>{ic("vol")}{ic("full")}</div></div>
<div class="ed">
<div class="field"><label>Título del clip <small>Así se llamará al publicarlo</small></label><div class="in">El mejor momento del stream{ic("edit")}</div></div>
<div class="group">{row(icb("captions","#FF9F0A"),"Subtítulos",'<div class="sw on"></div>',"Español · Negrita amarilla")}</div>
<div class="card trim"><div class="h"><b>Recortar</b><small>Arrastra los bordes morados</small></div>
<div class="strip2">{frames}<div class="shade" style="left:0;width:7%"></div><div class="shade" style="right:0;width:16%"></div><div class="selx"></div>
<div class="hd" style="left:7%;border-radius:10px 0 0 10px"></div><div class="hd" style="right:16%;border-radius:0 10px 10px 0"></div></div>
<div class="tl"><span>Empieza en <b>0:03</b></span><span>Dura <b>0:39</b></span><span>Termina en <b>0:42</b></span></div></div>
<div class="card fmtl"><b>Formato</b><div class="seg3"><span class="on">{ic("vert")}Vertical</span><span>{ic("horiz")}Horizontal</span><span>{ic("square")}Cuadrado</span></div></div>
<div class="acts2"><button class="btn btn-primary">{ic("download")}Descargar</button><button class="btn btn-secondary">{ic("share")}Compartir</button><button class="btn btn-gray">{TT.replace('width="26" height="26"','width="24" height="24"')}Publicar en TikTok</button></div>
<div class="note2">{ic("check")}Los cambios se guardan solos. Tu clip original no se borra.</div>
</div></div>'''
write("51-clips-detalle.html", tpage("Clip", shell("clips", 1, in51), css51))

# ============================== 52 CLIPS AJUSTES ==============================
css52 = '''
.c2{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
.c2 > div > * + *{margin-top:20px}
.ghead{padding-left:6px}
.c2 .row{min-height:64px}
.c2 .row + .row::before{left:74px}
.presets{padding:16px 16px 16px}
.presets .h{font-size:17px;color:var(--ink2);padding:0 4px 12px}
.pg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.pr{border-radius:16px;padding:6px;position:relative}
.pr .thumb .cap{bottom:18%;font-size:15px}
.pr b{display:block;text-align:center;font-size:16.5px;font-weight:650;margin-top:8px}
.pr.on{box-shadow:0 0 0 3px var(--accent)}
.pr .chk{position:absolute;top:12px;right:12px;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;z-index:3;box-shadow:0 0 0 3px #fff}
.pr .chk svg{width:16px;height:16px;stroke-width:3}
.cap.c-white em{color:#fff}
.cap.c-box{text-shadow:none!important}
.cap.c-box span{background:#111;padding:2px 6px;border-radius:5px;box-decoration-break:clone;-webkit-box-decoration-break:clone;line-height:1.5}
.cap.c-box em{color:#fff}
.foot52{margin-top:18px;display:flex;flex-direction:column;gap:12px}
'''
def preset(i, label, capcls, txt, on=False):
    t = thumb(i, 140, 150, radius=12, play=False).replace("width:140px", "width:100%")
    t = t.replace("</div></div>", "</div></div>", 1)
    cap = f'<div class="cap {capcls}">{txt}</div>'
    t = t[:-6] + cap + "</div>"
    chk = f'<div class="chk">{ic("check")}</div>' if on else ""
    return f'<div class="pr{" on" if on else ""}">{chk}{t}<b>{label}</b></div>'
presets = (preset(3, "Clásico", "c-white", "ESTO FUE <em>ÉPICO</em>")
         + preset(0, "Amarillo", "", "ESTO FUE <em>ÉPICO</em>", True)
         + preset(1, "Con fondo", "c-box", "<span>ESTO FUE <em>ÉPICO</em></span>"))
left52 = f'''<div><div class="ghead">Cuentas conectadas</div><div class="group">
{row(brand(YT),"YouTube",okc(),"@MariaEnVivo",True)}
{row(brand(TW),"Twitch",'<span class="conn2">Conectar</span>',"",True)}
{row(brand(TT),"TikTok",'<span class="conn2">Conectar</span>',"Para publicar con un toque",True)}</div></div>
<div><div class="ghead">Subtítulos</div><div class="group">
{row(icb("captions","#FF9F0A"),"Poner subtítulos en mis clips",'<div class="sw on"></div>')}
{row(icb("globe","#0A84FF"),"Idioma de los subtítulos",'<span class="val">Español (México)</span>',"",True)}</div></div>'''
right52 = f'''<div><div class="ghead">Estilo de subtítulos</div><div class="card presets"><div class="h">Toca uno. Lo usamos en tus próximos clips.</div><div class="pg">{presets}</div></div></div>
<div><div class="ghead">Tu marca</div><div class="group">
{row(icb("stamp","#FF375F"),"Marca de agua / logo",'<div class="sw"></div>',"Tu logo en una esquina de cada clip")}
{row(icb("upload","#8E8E93"),"Subir mi logo",'<span class="val">PNG o JPG</span>',"",True)}</div></div>'''
in52 = f'''<div class="c2"><div>{left52}</div><div>{right52}</div></div>
<div class="foot52">{advbar("Publicar automáticamente, duración y Acceso API")}<div class="note2">{ic("check")}Los cambios se guardan solos y se usan en tus próximos clips.</div></div>'''
write("52-clips-ajustes.html", tpage("Clips · Ajustes", shell("clips", 2, in52), css52))

# ============================== SEÑALES helpers ==============================
COIN = {"BTC":("Bitcoin","#F7931A","₿"),"ETH":("Ethereum","#627EEA","Ξ"),"SOL":("Solana","linear-gradient(135deg,#14F195,#9945FF)","S")}
VERD = {"buy":("up","Momento de compra"),"sell":("down","Momento de venta"),"wait":("pause","Sin señal clara")}
def vpill(kind): i,t = VERD[kind]; return f'<span class="vpill v-{kind}">{ic(i)}{t}</span>'
css54 = '''
.chips{display:flex;gap:10px;align-items:center}
.chips .chip{height:46px;padding:0 18px 0 8px;font-size:17px}
.chips .chip.all{padding:0 20px}
.chips .chip i{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:#fff;font-style:normal;font-size:14px;font-weight:800}
.chips .tag-ej{margin-left:auto}
.l54{display:grid;grid-template-columns:1fr 340px;gap:22px;margin-top:16px;align-items:start}
.feed{display:flex;flex-direction:column;gap:12px}
.sg{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:16px 22px 16px 18px;display:flex;gap:16px;align-items:flex-start}
.sg.new{box-shadow:0 0 0 2px var(--accent),var(--shadow-lg)}
.sg .tx{flex:1;min-width:0}
.sg .top{display:flex;align-items:center;gap:10px}
.sg .top b{font-size:19px}.sg .top .sy{font-size:15px;color:var(--ink3);font-weight:600}
.sg .top small{font-size:16px;color:var(--ink3);margin-left:auto;white-space:nowrap}
.sg .mid{display:flex;align-items:center;gap:18px;margin-top:8px}
.sg .ref{font-size:15.5px;color:var(--ink3);line-height:1.2}.sg .ref b{display:block;font-size:19px;color:var(--ink);font-weight:650;font-variant-numeric:tabular-nums}
.sg p{font-size:17.5px;color:var(--ink2);margin-top:8px}
.sg p b{color:var(--ink);font-weight:650}
.sg .bt{display:flex;align-items:center;justify-content:space-between;margin-top:6px}
.sg .bt{gap:18px}.sg .bt p{flex:1}
.sg .bt a{font-size:17px;color:var(--accent);font-weight:600;white-space:nowrap}
.sg .bt .btn{height:48px;font-size:17px;padding:0 20px;border-radius:14px}
.sg .newp{margin-left:4px}
.r54 > * + *{margin-top:14px}
.r54 .row{min-height:58px}
.r54 .row .tx b{font-size:18px}
.leg{padding:14px 18px 16px}
.leg h4{font-size:17px;font-weight:650;margin-bottom:10px}
.leg .li{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.leg .li .vpill{font-size:16px;padding:4px 10px 4px 8px;align-self:flex-start}
.leg .li .vpill svg.i{width:17px;height:17px}
.leg .li small{font-size:15.5px;color:var(--ink2);padding-left:2px}
.dfoot{margin-top:14px}
'''
def sgcard(sym, when, kind, price, why, new=False):
    n, c, s = COIN[sym]
    btn = f'<button class="btn btn-primary">Ver detalle</button>' if new else '<a>Ver detalle ›</a>'
    np = '<span class="pill acc newp">Nueva</span>' if new else ""
    return f'''<div class="sg{" new" if new else ""}"><div class="coin" style="background:{c}">{s}</div><div class="tx">
<div class="top"><b>{n}</b><span class="sy">{sym}</span>{np}<small>{when}</small></div>
<div class="mid">{vpill(kind)}<div class="ref">Precio de referencia<b>{price}</b></div></div>
<div class="bt"><p><b>Por qué:</b> {why}</p>{btn}</div></div></div>'''
def chip_coin(sym):
    n,c,s = COIN[sym]; return f'<span class="chip"><i style="background:{c}">{s}</i>{n}</span>'
def senales_home_inner():
    feed = (sgcard("BTC","Hoy, 7:15 a.m.","buy","$1,186,400 MXN","Lleva varios días subiendo poco a poco, sin saltos bruscos.",True)
          + sgcard("SOL","Ayer, 6:02 p.m.","sell","$3,412 MXN","Subió muy rápido esta semana. A veces, después de eso, baja.")
          + sgcard("ETH","Ayer, 9:30 a.m.","wait","$46,980 MXN","Se mueve mucho para los dos lados. Te avisamos cuando se calme."))
    side = f'''<div class="r54"><div class="group"><div class="gh2">Mis avisos<a>Cambiar</a></div>
{row(f'<div class="ic" style="background:#25D366">{ic("chat")}</div>',"WhatsApp",okc("Sí"))}
{row(f'<div class="ic" style="background:#0A84FF">{ic("mail")}</div>',"Correo",'<span class="val">No</span>')}
{row(f'<div class="ic" style="background:#5B4BFF">{ic("bell")}</div>',"En la app",okc("Sí"))}
{row(f'<div class="ic" style="background:#8E8E93">{ic("clock")}</div>',"Horario",'<span class="val">8 a.m. a 10 p.m.</span>')}</div>
<div class="card leg"><h4>¿Qué significa cada una?</h4>
<div class="li">{vpill("buy")}<small>El precio va subiendo de forma estable.</small></div>
<div class="li">{vpill("sell")}<small>Subió rápido y podría bajar.</small></div>
<div class="li">{vpill("wait")}<small>No hay nada claro por ahora.</small></div></div></div>'''
    chips = f'<div class="chips"><span class="chip on all">Todas</span>{chip_coin("BTC")}{chip_coin("ETH")}{chip_coin("SOL")}<span class="tag-ej">Datos de ejemplo</span></div>'
    return f'{chips}<div class="l54"><div class="feed">{feed}</div>{side}</div>{disc_footer()}'
write("54-senales-home.html", tpage("Señales", shell("senales", 0, senales_home_inner()), css54))

# ============================== 53 SEÑALES AVISO ==============================
css53 = css54 + '''
.app{position:relative}
.app .main{filter:blur(1.5px)}
.dim{z-index:5}
.modal{position:absolute;z-index:6;left:50%;top:50%;transform:translate(-50%,-50%);width:700px;padding:30px 34px 26px}
.modal .mh{display:flex;align-items:center;gap:16px}
.modal h2{font-size:30px;font-weight:700;letter-spacing:-.025em}
.modal .mh p{font-size:17.5px;color:var(--ink2);margin-top:2px}
.bul{margin-top:20px;display:flex;flex-direction:column;gap:14px}
.bu{display:flex;gap:16px;align-items:flex-start}
.bu .n{width:44px;height:44px;border-radius:14px;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.bu .n svg.i{width:23px;height:23px}
.bu b{display:block;font-size:20px;font-weight:650;letter-spacing:-.015em;line-height:1.25}
.bu small{display:block;font-size:16.5px;color:var(--ink2);margin-top:2px}
.legal{margin-top:18px;padding:13px 16px;border-radius:14px;background:var(--bg);font-size:15px;line-height:1.45;color:var(--ink2)}
.legal b{color:var(--ink)}
.legal .k{display:flex;justify-content:space-between;align-items:baseline;font-size:14px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
.legal .k a{text-transform:none;letter-spacing:0;font-size:15.5px}
.modal .cbx{margin-top:16px;font-size:18px;color:var(--ink);font-weight:550;padding:14px 16px;border-radius:16px;box-shadow:inset 0 0 0 1.5px #DAD6FF}
.modal .btn-xl{margin-top:14px;opacity:.42;box-shadow:none}
.modal .hint{text-align:center;font-size:15.5px;color:var(--ink3);margin-top:10px}
'''
LEGAL6 = ("<b>Señales</b> da <b>información general</b> generada con IA, igual para todos los usuarios de tu plan. <b>No es asesoría financiera, de inversión ni de apuestas</b>, "
          "no es una recomendación personal para ti y no toma en cuenta tus saldos, posiciones ni objetivos. No garantizamos resultados y <b>puedes perder todo tu dinero</b>. "
          "Chalyb no es asesor en inversiones registrado ante la CNBV, ni casa de bolsa, exchange o casa de apuestas.")
modal = f'''<div class="dim"></div><div class="sheetc modal"><div class="mh">{toolicon("trend","#FF9F0A",60,18,30)}<div><h2>Antes de empezar</h2><p>Léelo una vez. Son 3 cosas.</p></div></div>
<div class="bul">
<div class="bu"><div class="n">{ic("info")}</div><div><b>Son ideas informativas, no consejos personales.</b><small>No es asesoría financiera ni una recomendación para ti.</small></div></div>
<div class="bu"><div class="n">{ic("users")}</div><div><b>Las señales son iguales para todos en tu plan.</b><small>No usamos tus saldos, tus inversiones ni tus metas.</small></div></div>
<div class="bu"><div class="n">{ic("user")}</div><div><b>Tú decides y el riesgo es tuyo.</b><small>No garantizamos resultados. Puedes perder dinero.</small></div></div></div>
<div class="legal"><div class="k">El aviso, palabra por palabra<a class="lnk">Leer aviso completo</a></div>{LEGAL6}</div>
<label class="cbx"><span class="b"></span><span>Entiendo y acepto que las decisiones y los riesgos son míos.</span></label>
<button class="btn btn-primary btn-xl">Entendido, continuar</button><div class="hint">Marca la casilla para continuar. Solo te lo pedimos esta vez.</div></div>'''
b53 = shell("senales", 0, senales_home_inner()).replace("</main></div>", "</main>" + modal + "</div>")
write("53-senales-aviso.html", tpage("Señales · aviso", b53, css53))

# ============================== 55 SEÑAL DETALLE ==============================
css55 = '''
.tb{margin-top:18px}
.bk{display:flex;align-items:center;justify-content:space-between}
.l55{display:grid;grid-template-columns:1fr 360px;gap:22px;margin-top:14px;align-items:start}
.cc{padding:20px 24px 16px}
.cc .top{display:flex;align-items:center;gap:14px}
.cc .top h2{font-size:28px}.cc .top .sy{font-size:16px;color:var(--ink3);font-weight:600;margin-left:6px}
.cc .top small{display:block;font-size:16px;color:var(--ink3)}
.cc .top .ref{margin-left:auto;text-align:right;font-size:15.5px;color:var(--ink3)}
.cc .top .ref b{display:block;font-size:26px;color:var(--ink);font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.cc .vrow{display:flex;align-items:center;justify-content:space-between;margin-top:14px}
.seg3{display:flex;background:#EBEBF0;border-radius:14px;padding:4px;gap:4px}
.seg3 span{height:42px;padding:0 16px;display:flex;align-items:center;border-radius:11px;font-size:16.5px;font-weight:600;color:var(--ink2)}
.seg3 span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.chart{margin-top:12px}
.chart svg{display:block;width:100%;height:auto}
.r55 > * + *{margin-top:14px}
.why{padding:18px 20px}
.why h3{font-size:20px;font-weight:650}
.why ul{list-style:none;margin-top:10px}
.why li{display:flex;gap:12px;font-size:17.5px;line-height:1.4;color:var(--ink);padding:7px 0}
.why li i{width:26px;height:26px;border-radius:50%;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none;font-style:normal;font-size:14px;font-weight:700;margin-top:1px}
.same{display:flex;gap:12px;padding:14px 16px;border-radius:16px;background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF;font-size:16px;color:var(--ink2);line-height:1.4}
.same svg.i{color:var(--accent);flex:none}
.r55 .row{min-height:72px}
.dfoot{margin-top:14px}
'''
import math
pts = []
vals = [61.2,61.0,61.5,60.8,61.1,61.6,61.4,62.0,61.8,62.3,62.1,62.6,62.4,62.9,63.1,62.8,63.4,63.2,63.7,63.9,63.6,64.1,64.0,64.4,64.2,64.6,64.9,64.8]
W_, H_, PL, PR, PT, PB = 640, 250, 64, 14, 14, 30
lo, hi = 60.0, 65.5
def X(i): return PL + i*(W_-PL-PR)/(len(vals)-1)
def Y(v): return PT + (hi-v)/(hi-lo)*(H_-PT-PB)
line = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i,v in enumerate(vals))
area = f"{PL},{H_-PB} " + line + f" {X(len(vals)-1):.1f},{H_-PB}"
si = 24; sx, sy = X(si), Y(vals[si])
grid = "".join(f'<line x1="{PL}" x2="{W_-PR}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="#ECECF1"/><text x="{PL-10}" y="{Y(v)+5:.1f}" text-anchor="end" font-size="14" fill="#8E8E96">${v*18.5/1000:.2f} M</text>' for v in [61,63,65])
days = ["vie","sáb","dom","lun","mar","mié","jue"]
xl = "".join(f'<text x="{X(i*4+1):.1f}" y="{H_-8}" text-anchor="middle" font-size="14" fill="#8E8E96">{d}</text>' for i,d in enumerate(days))
chart = f'''<svg viewBox="0 0 {W_} {H_}"><defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5B4BFF" stop-opacity=".18"/><stop offset="1" stop-color="#5B4BFF" stop-opacity="0"/></linearGradient></defs>
{grid}<polygon points="{area}" fill="url(#ga)"/><polyline points="{line}" fill="none" stroke="#5B4BFF" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
<line x1="{sx:.1f}" x2="{sx:.1f}" y1="{PT}" y2="{H_-PB}" stroke="#5B4BFF" stroke-dasharray="4 4" opacity=".5"/>
<circle cx="{sx:.1f}" cy="{sy:.1f}" r="9" fill="#fff" stroke="#5B4BFF" stroke-width="3"/>
<rect x="{sx-236:.1f}" y="{sy-52:.1f}" width="224" height="36" rx="10" fill="#1D1D1F"/><text x="{sx-124:.1f}" y="{sy-28.5:.1f}" text-anchor="middle" font-size="15" font-weight="600" fill="#fff">Aquí te avisamos · 7:15 a.m.</text>
{xl}</svg>'''
n_, c_, s_ = COIN["BTC"]
in55 = f'''<div class="bk"><button class="back">{ic("chevl")}Señales</button><span class="tag-ej">Datos de ejemplo</span></div>
<div class="l55"><div class="card cc"><div class="top"><div class="coin" style="background:{c_}">{s_}</div><div><h2>Bitcoin<span class="sy">BTC</span></h2><small>Hoy, 7:15 a.m.</small></div>
<div class="ref">Precio de referencia<b>$1,186,400 MXN</b></div></div>
<div class="vrow">{vpill("buy")}<div class="seg3"><span>1 día</span><span class="on">7 días</span><span>1 mes</span></div></div>
<div class="chart">{chart}</div></div>
<div class="r55"><div class="card why"><h3>Por qué, en palabras simples</h3><ul>
<li><i>1</i>Lleva 5 días subiendo poco a poco.</li><li><i>2</i>No ha tenido subidas ni bajadas bruscas.</li><li><i>3</i>Se ha comprado más de lo que se ha vendido.</li></ul></div>
<div class="group">{row(f'<div class="ic" style="background:#F7931A">{ic("bell")}</div>',"Recibir avisos de esta moneda",'<div class="sw on"></div>',"Por WhatsApp y en la app")}</div>
<div class="same">{ic("users")}<span>Esta misma señal la ven todas las personas de tu plan. No usa tus saldos ni tus inversiones.</span></div></div></div>
{disc_footer()}'''
write("55-senales-detalle.html", tpage("Señal", shell("senales", 0, in55), css55))

# ============================== 56 SEÑALES AJUSTES ==============================
css56 = '''
.c2{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
.c2 > div > * + *{margin-top:20px}
.ghead{padding-left:6px}
.c2 .row{min-height:64px}
.c2 .row + .row::before{left:74px}
.cl{display:flex;flex-wrap:wrap;gap:10px;padding:16px 18px 6px}
.cl span{display:flex;align-items:center;gap:8px;height:46px;padding:0 12px 0 6px;border-radius:999px;background:var(--tint);color:var(--ink);font-size:17px;font-weight:600;box-shadow:inset 0 0 0 1.5px #DAD6FF}
.cl span i{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;font-style:normal;font-size:14px;font-weight:800}
.cl span svg.i{width:18px;height:18px;color:var(--ink3)}
.cl .add{background:#fff;color:var(--accent);box-shadow:inset 0 0 0 1.5px #DAD6FF;padding:0 16px}
.cl .add svg.i{color:var(--accent)}
.cnote{font-size:15.5px;color:var(--ink3);padding:8px 20px 16px}
.c2 .val b{color:var(--ink);font-weight:600}
.foot52{margin-top:20px;display:flex;flex-direction:column;gap:12px}
.lk{font-size:17px;color:var(--accent);font-weight:600;white-space:nowrap}
'''
def ccoin(sym):
    n,c,s = COIN[sym]; return f'<span><i style="background:{c}">{s}</i>{n}{ic("x")}</span>'
left56 = f'''<div><div class="ghead">Tus monedas</div><div class="group"><div class="cl">{ccoin("BTC")}{ccoin("ETH")}{ccoin("SOL")}<span class="add">{ic("plus")}Agregar moneda</span></div>
<div class="cnote">Solo eliges de qué monedas te avisamos. La señal es la misma para todos.</div></div></div>
<div><div class="ghead">Cómo te avisamos</div><div class="group">
{row(f'<div class="ic" style="background:#25D366">{ic("chat")}</div>',"WhatsApp",'<div class="sw on"></div>',"+52 55 •••• 4821")}
{row(f'<div class="ic" style="background:#0A84FF">{ic("mail")}</div>',"Correo",'<div class="sw"></div>',"maria.lopez@correo.mx")}
{row(f'<div class="ic" style="background:#5B4BFF">{ic("bell")}</div>',"En la app",'<div class="sw on"></div>',"Una notificación en tu celular")}</div></div>'''
right56 = f'''<div><div class="ghead">Horario</div><div class="group">
{row(icb("clock","#FF9F0A"),"Avisarme desde",'<span class="val"><b>8:00 a.m.</b></span>',"",True)}
{row(icb("clock","#5856D6"),"Hasta",'<span class="val"><b>10:00 p.m.</b></span>',"En la noche no te molestamos",True)}
{row(icb("cal","#30B0C7"),"Días",'<span class="val">Todos los días</span>',"",True)}</div></div>
<div><div class="ghead">Información importante</div><div class="group">
{row(icb("shield","#8E8E93"),"Aviso de riesgo",'<span class="lk">Leer otra vez</span>',"Lo aceptaste el 2 de octubre de 2026")}</div></div>'''
in56 = f'''<div class="c2"><div>{left56}</div><div>{right56}</div></div>
<div class="foot52">{advbar("Temporalidad, resumen diario y formato del aviso")}<div class="note2">{ic("check")}Los cambios se guardan solos.</div></div>'''
write("56-senales-avisos.html", tpage("Señales · Ajustes", shell("senales", 2, in56), css56))

# ============================== 57 EN VIVO CONECTAR ==============================
css57 = '''
.intro{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.intro h2{font-size:30px;font-weight:700;letter-spacing:-.025em}
.intro p{font-size:19px;color:var(--ink2);margin-top:4px}
.what{margin-top:16px;display:flex;align-items:center;gap:14px;padding:14px 20px;border-radius:18px;background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF;font-size:18px}
.what svg.i{color:var(--accent);width:24px;height:24px}
.st3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}
.sc3{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:22px 22px 24px;display:flex;flex-direction:column;min-height:372px}
.sc3.on{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.sc3 .nb{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:20px;font-weight:700;flex:none;background:#EEEEF2;color:var(--ink2)}
.sc3.on .nb{background:var(--accent);color:#fff}
.sc3 .k{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink3)}
.sc3.on .k{color:var(--accent)}
.sc3 h3{font-size:23px;font-weight:700;letter-spacing:-.02em;margin-top:16px;line-height:1.2}
.sc3 p{font-size:17.5px;color:var(--ink2);margin-top:8px;line-height:1.4}
.sc3 .btn-xl{margin-top:auto;font-size:20px}
.sc3 .alt{text-align:center;font-size:16px;margin-top:12px;color:var(--ink3)}
.code{margin-top:auto;display:flex;justify-content:center;gap:8px}
.code span{width:46px;height:70px;border-radius:14px;background:var(--bg);display:grid;place-items:center;font-size:38px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--ink);box-shadow:inset 0 0 0 1.5px #E1E1E8}
.code .gap{width:6px;background:none;box-shadow:none}
.sc3 .exp{text-align:center;font-size:16px;color:var(--ink3);margin-top:12px}
.okbig{margin:auto auto 0;width:112px;height:112px;border-radius:50%;background:#F0F0F4;display:grid;place-items:center;color:#C6C6CE}
.okbig svg.i{width:58px;height:58px;stroke-width:2.6}
.wait{margin-top:16px;display:flex;align-items:center;gap:14px;font-size:17.5px;color:var(--ink2)}
.spin{width:24px;height:24px;border-radius:50%;border:3px solid var(--tint);border-top-color:var(--accent);border-right-color:var(--accent);flex:none}
.wait .r{margin-left:auto;display:flex;gap:12px}
.wait .btn{height:50px;font-size:17px;padding:0 20px;border-radius:14px}
'''
in57 = f'''<div class="intro"><div><h2>Conecta tu computadora</h2><p>Solo se hace una vez. Toma unos 2 minutos.</p></div></div>
<div class="what">{ic("info")}<span><b>¿Qué es OBS?</b> Es el programa gratis que manda la imagen de tu computadora a YouTube o Twitch. Nosotros lo manejamos por ti.</span></div>
<div class="st3">
<div class="sc3 on"><div class="k"><span class="nb">1</span>Ahora</div><h3>Descarga el programa de En vivo</h3><p>Ábrelo en la computadora donde transmites. Si no tienes OBS, lo instala por ti.</p>
<button class="btn btn-primary btn-xl">{ic("download")}Descargar para Windows</button><div class="alt">¿Tienes Mac? <a class="lnk">Descargar para Mac</a></div></div>
<div class="sc3"><div class="k"><span class="nb">2</span>Después</div><h3>Escribe este código en el programa</h3><p>El programa te lo pide al abrirlo. Así sabemos que es tu computadora.</p>
<div class="code"><span>4</span><span>8</span><span>2</span><span class="gap"></span><span>9</span><span>1</span><span>3</span></div><div class="exp">Este código sirve por 10 minutos.</div></div>
<div class="sc3"><div class="k"><span class="nb">3</span>Al final</div><h3>¡Listo!</h3><p>Cuando se conecte, aquí verás una palomita verde y ya podrás transmitir.</p><div class="okbig">{ic("check")}</div></div>
</div>
<div class="wait"><span class="spin"></span>Esperando tu computadora… Esta página se actualiza sola.<div class="r"><button class="btn btn-okl">{ic("chat")}Hablar con una persona</button></div></div>'''
write("57-envivo-conectar.html", tpage("En vivo · Conectar", shell("envivo", 0, in57), css57))

# ============================== 58 EN VIVO CONTROL ==============================
css58 = '''
.tb{margin-top:20px}
.live{display:flex;align-items:center;gap:22px;padding:14px 22px;border-radius:20px;background:#fff;box-shadow:var(--shadow)}
.live .on{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:700;color:var(--bad);letter-spacing:-.01em}
.live .on i{width:14px;height:14px;border-radius:50%;background:var(--bad);box-shadow:0 0 0 5px rgba(215,0,21,.15)}
.live .on span{color:var(--ink);font-variant-numeric:tabular-nums}
.live .kv{display:flex;align-items:center;gap:10px;font-size:17.5px;color:var(--ink2);padding-left:22px;border-left:1px solid var(--line)}
.live .kv b{color:var(--ink);font-weight:650}
.live .kv svg.i{color:var(--ink3);width:22px;height:22px}
.live .kv .ok3{color:var(--ok);font-weight:650}
.l58{display:grid;grid-template-columns:1fr 352px;gap:22px;margin-top:16px;align-items:start}
.prev{position:relative;border-radius:22px;overflow:hidden;box-shadow:var(--shadow-lg)}
.prev .lb{position:absolute;left:16px;top:16px;z-index:3;background:var(--bad);color:#fff;font-size:14px;font-weight:800;letter-spacing:.05em;padding:5px 11px;border-radius:8px}
.prev .lb2{position:absolute;right:16px;top:16px;z-index:3;background:rgba(0,0,0,.5);color:#fff;font-size:15px;font-weight:600;padding:5px 12px;border-radius:8px}
.sh3{display:flex;align-items:baseline;justify-content:space-between;margin-top:16px}
.sh3 h3{font-size:21px;font-weight:650}.sh3 small{font-size:16px;color:var(--ink3)}
.scn{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:10px}
.sc{background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:8px 8px 12px;position:relative}
.sc .tn{position:relative}
.sc > div:last-child{padding:10px 6px 0}
.sc b{display:block;font-size:19px;font-weight:650}
.sc small{display:block;font-size:15px;color:var(--ink3)}
.sc.on{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.sc.on small{color:var(--accent);font-weight:650}
.stop{width:100%;height:100px;border-radius:24px;background:var(--bad);color:#fff;font-size:27px;font-weight:700;letter-spacing:-.02em;display:flex;align-items:center;justify-content:center;gap:16px;box-shadow:0 12px 30px rgba(215,0,21,.30)}
.stop .sq{width:26px;height:26px;border-radius:6px;background:#fff}
.stopn{text-align:center;font-size:16px;color:var(--ink2);margin-top:8px}
.tg2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.tgl{border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fff;box-shadow:var(--shadow)}
.tgl .ti{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:var(--tint);color:var(--accent)}
.tgl .ti svg.i{width:28px;height:28px}
.tgl b{font-size:19px;font-weight:650}
.tgl .st{font-size:16px;font-weight:650;color:var(--accent)}
.tgl.off{background:#F0F0F4;box-shadow:inset 0 0 0 1.5px #E1E1E8}
.tgl.off .ti{background:#fff;color:var(--ink3)}
.tgl.off .st{color:var(--ink3)}
.clipnow{margin-top:14px;width:100%;height:64px;border-radius:18px;background:#fff;color:var(--accent);box-shadow:inset 0 0 0 2px #DAD6FF;font-size:19px;font-weight:650;display:flex;align-items:center;justify-content:center;gap:12px}
.clipnow .tico{border-radius:10px}
.clipn{text-align:center;font-size:15.5px;color:var(--ink3);margin-top:8px}
.sci{position:absolute;left:10px;bottom:10px;z-index:3;width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.9);color:var(--ink);display:grid;place-items:center}
.sci svg.i{width:21px;height:21px}
.r58 .group{margin-top:14px}
.r58 .row{min-height:60px}
'''
prev = thumb(3, 666, 352, radius=0, play=False).replace("width:666px", "width:100%")
scn = ""
for t, d, k, on, icn in [("Cámara","Solo tú",5,False,"cam"),("Pantalla","En pantalla",3,True,"monitor"),("Pausa","Vuelvo enseguida",1,False,"coffee")]:
    scn += f'<div class="sc{" on" if on else ""}"><div class="tn">{thumb(k,200,104,radius=14,play=False).replace("width:200px","width:100%")}<span class="sci">{ic(icn)}</span></div><div><b>{t}</b><small>{d}</small></div></div>'
in58 = f'''<div class="live"><div class="on"><i></i>En vivo · <span>00:12:34</span></div>
<div class="kv">{ic("eye")}<b>128</b> personas viendo</div><div class="kv">{YT}{TW}YouTube y Twitch</div><div class="kv">{ic("wifi")}Internet <span class="ok3">Bueno</span></div></div>
<div class="l58"><div><div class="prev"><span class="lb">EN VIVO</span><span class="lb2">Lo que ve tu público</span>{prev}</div>
<div class="sh3"><h3>Escenas</h3><small>Toca una para cambiar lo que ve tu público</small></div><div class="scn">{scn}</div></div>
<div class="r58"><button class="stop"><span class="sq"></span>Terminar transmisión</button><div class="stopn">Te preguntamos antes de terminar.</div>
<div class="tg2"><div class="tgl"><div class="ti">{ic("mic")}</div><b>Micrófono</b><span class="st">Encendido</span></div>
<div class="tgl off"><div class="ti">{ic("cam")}</div><b>Cámara</b><span class="st">Apagada</span></div></div>
<button class="clipnow">{toolicon("scissors","#5B4BFF",36,10,20)}Hacer clip de este momento</button><div class="clipn">Guarda el último minuto en Clips.</div>
<div class="group"><div class="row">{ic("sliders","i","color:var(--ink2)")}<div class="tx"><b>Opciones avanzadas</b><small>Calidad, servidores y atajos</small></div>{ic("chev","i chev")}</div></div>
</div></div>'''
write("58-envivo-control.html", tpage("En vivo · Control", shell("envivo", 0, in58), css58))

# ============================== 59 EN VIVO AJUSTES ==============================
css59 = '''
.c2{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
.c2 > div > * + *{margin-top:20px}
.ghead{padding-left:6px}
.c2 .row{min-height:64px}
.c2 .row + .row::before{left:74px}
.q{display:flex;flex-direction:column;gap:10px}
.qo{display:flex;align-items:center;gap:16px;padding:14px 18px;border-radius:18px;background:#fff;box-shadow:var(--shadow);position:relative}
.qo .tx{flex:1}.qo b{font-size:19px;font-weight:600;display:flex;align-items:center;gap:10px}.qo small{font-size:16px;color:var(--ink3)}
.qo .rad{width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 2px #D2D2DA;flex:none}
.qo.on{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.qo.on .rad{background:var(--accent);box-shadow:none;display:grid;place-items:center;color:#fff}
.qo.on .rad svg{width:17px;height:17px;stroke-width:3}
.foot52{margin-top:20px;display:flex;flex-direction:column;gap:12px}
.cnote{font-size:15.5px;color:var(--ink3);padding:6px 6px 0}
'''
KICK = '<svg viewBox="0 0 24 24" width="26" height="26"><rect width="24" height="24" rx="6" fill="#53FC18"/><path d="M6 5h3.6v4.2h1.2L13.2 5H17l-3.4 7 3.4 7h-3.8l-2.4-4.2H9.6V19H6z" fill="#0B0B0B"/></svg>'
FB = '<svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M13.3 19.5v-6h2l.3-2.4h-2.3V9.6c0-.7.2-1.2 1.2-1.2h1.2V6.3c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.8h-2v2.4h2v6z" fill="#fff"/></svg>'
left59 = f'''<div><div class="ghead">Dónde transmites</div><div class="group">
{row(brand(YT),"YouTube",'<div class="sw on"></div>',"@MariaEnVivo · conectado")}
{row(brand(TW),"Twitch",'<div class="sw on"></div>',"mariaenvivo · conectado")}
{row(brand(KICK),"Kick",'<span class="conn2">Conectar</span>')}
{row(brand(FB),"Facebook",'<span class="conn2">Conectar</span>')}</div><div class="cnote">Puedes transmitir en varias a la vez.</div></div>
<div><div class="ghead">Tu computadora</div><div class="group">
{row(icb("laptop","#30B0C7"),"Laptop de María",okc(),"OBS listo · Windows")}</div></div>'''
right59 = f'''<div><div class="ghead">Calidad</div><div class="q">
<div class="qo on"><div class="tx"><b>Automática <span class="pill acc">Recomendada</span></b><small>Se ajusta sola a tu internet.</small></div><span class="rad">{ic("check")}</span></div>
<div class="qo"><div class="tx"><b>Alta</b><small>Para internet muy rápido.</small></div><span class="rad"></span></div>
<div class="qo"><div class="tx"><b>Ahorro</b><small>Si tu internet es lento o usas datos.</small></div><span class="rad"></span></div></div></div>
<div><div class="ghead">Al terminar</div><div class="group">
{row(icb("scissors","#5B4BFF"),"Hacer clips al terminar",'<div class="sw on"></div>',"Te llegan a Clips")}</div></div>'''
in59 = f'''<div class="c2"><div>{left59}</div><div>{right59}</div></div>
<div class="foot52">{advbar("Bitrate, servidores, atajos y clave de transmisión")}<div class="note2">{ic("lock")}Tu clave de transmisión está oculta por seguridad. Solo se ve en Opciones avanzadas.</div></div>'''
write("59-envivo-ajustes.html", tpage("En vivo · Ajustes", shell("envivo", 2, in59), css59))

# ============================== 60 TOOL NO ABRE ==============================
css60 = '''
.fail{margin:34px auto 0;max-width:640px;background:#fff;border-radius:28px;box-shadow:var(--shadow-lg);padding:40px 48px 32px;text-align:center;display:flex;flex-direction:column;align-items:center}
.fail .art{width:112px;height:112px;border-radius:34px;display:grid;place-items:center;background:var(--warn-tint);color:var(--warn)}
.fail .art svg.i{width:54px;height:54px;stroke-width:1.8}
.fail h2{font-size:32px;font-weight:700;letter-spacing:-.025em;margin-top:24px}
.fail p{font-size:19px;color:var(--ink2);margin-top:10px;line-height:1.45;max-width:480px}
.fail .btn{width:100%;max-width:440px;height:66px;font-size:20px;margin-top:24px}
.fail .btn + .btn{margin-top:12px}
.stat{margin-top:22px;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:999px;background:var(--warn-tint);color:var(--warn);font-size:16.5px;font-weight:600}
.stat i{width:10px;height:10px;border-radius:50%;background:#E08A00}
.fail .meta{margin-top:16px;font-size:15.5px;color:var(--ink3)}
.fail .meta b{color:var(--ink2);font-variant-numeric:tabular-nums}
.alt2{margin:18px auto 0;max-width:640px;display:flex;align-items:center;gap:12px;font-size:17px;color:var(--ink2);justify-content:center}
.alt2 svg.i{color:var(--ink3);width:20px;height:20px}
'''
in60 = f'''<div class="fail"><div class="art">{ic("plug")}</div><h2>Clips no abrió esta vez</h2>
<p>Algo falló de nuestro lado, no es tu culpa. Lo que ya hiciste está guardado.</p>
<button class="btn btn-primary">{ic("refresh")}Intentar otra vez</button><button class="btn btn-okl">{ic("chat")}Hablar con una persona</button>
<div class="stat"><i></i>Ya nos avisaron, lo estamos arreglando.</div>
<div class="meta">Si nos escribes, menciona este código: <b>CLP-2041</b></div></div>
<div class="alt2">{ic("folder")}<span>Mientras tanto, tus clips anteriores siguen en <a class="lnk">Mis resultados</a>.</span></div>'''
write("60-tool-no-abre.html", tpage("No abrió", shell("clips", 0, in60), css60))

# ============================== 61 HERRAMIENTAS ==============================
css61 = '''
.main{padding-top:40px}
.tg3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:24px}
.t3{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:24px 22px 22px;display:flex;flex-direction:column;min-height:372px}
.t3 .hd{display:flex;align-items:center;justify-content:space-between}
.t3 h2{font-size:28px;font-weight:700;margin-top:18px;letter-spacing:-.025em}
.t3 p{font-size:18px;color:var(--ink2);margin-top:6px;line-height:1.4}
.t3 .now{margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--bg);font-size:16.5px;color:var(--ink)}
.t3 .now i{width:10px;height:10px;border-radius:50%;flex:none}
.t3 .btn{margin-top:14px;width:100%;height:62px;font-size:20px}
.also{margin-top:30px}
.also .ah{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.also .ah h3{font-size:21px;font-weight:650}
.also .ah .tag-ej{background:#EEEEF2;color:var(--ink2);border-color:#C9C9D2}
.ag{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.a4{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;background:rgba(255,255,255,.55);box-shadow:inset 0 0 0 1.5px #E1E1E8}
.a4 b{display:block;font-size:18px;font-weight:650}
.a4 small{display:block;font-size:15.5px;color:var(--accent);font-weight:600}
'''
def t3(name, icon, col, desc, now, dot):
    return f'''<div class="t3"><div class="hd">{toolicon(icon,col,72,20,36)}<span class="pill ok">{ic("check")}Incluido en tu plan</span></div>
<h2>{name}</h2><p>{desc}</p><div class="now"><i style="background:{dot}"></i>{now}</div><button class="btn btn-primary">Abrir</button></div>'''
cards61 = (t3("Clips","scissors","#5B4BFF","Convierte tu stream en clips cortos para TikTok, Reels y Shorts.","1 en proceso · 6 listos ayer","#5B4BFF")
         + t3("Señales","trend","#FF9F0A","Te avisamos cuándo es buen momento para comprar o vender cripto.","1 señal nueva hoy","#FF9F0A")
         + t3("En vivo","live","#FF375F","Maneja tu transmisión y tus escenas de OBS con botones grandes.","Te falta un paso: conectar","#E08A00"))
also = "".join(f'<div class="a4">{toolicon(i,c,46,14,24)}<div><b>{n}</b><small>Abrir ›</small></div></div>' for n,i,_,c in TOOLS[3:])
in61 = f'''<div class="eyebrow" style="font-size:17px;margin-bottom:8px">Inicio ›</div><h1>Tus herramientas</h1>
<p class="sub" style="margin-top:6px">Todas están incluidas en tu plan Pro y se abren aquí mismo.</p>
<div class="tg3">{cards61}</div>
<div class="also"><div class="ah"><h3>También incluido</h3><span class="tag-ej">Ejemplo · solo si están activas</span></div><div class="ag">{also}</div></div>'''
b61 = f'<div class="app">{sidebar("inicio")}<main class="main"><div class="wrap">{in61}</div></main></div>'
write("61-herramientas.html", tpage("Herramientas", b61, css61))

# ============================== 62 OVERVIEW ==============================
SHEET2 = [
 ("Clips", [("50","Inicio de Clips","Un botón: Hacer clips nuevos"),("51","Detalle del clip","Ver, recortar, formato, descargar"),("52","Ajustes de Clips","Cuentas, subtítulos, logo")]),
 ("Señales", [("53","Aviso (una vez)","3 ideas + texto legal + casilla"),("54","Inicio de Señales","Señales en palabras simples"),("55","Detalle de la señal","Gráfica simple y por qué"),("56","Ajustes de Señales","Monedas, cómo y cuándo avisamos")]),
 ("En vivo", [("57","Conectar (primera vez)","Descargar + código de 6 números"),("58","Cuarto de control","Botón gigante, escenas, clip"),("59","Ajustes de En vivo","Dónde transmites y calidad")]),
 ("Compartido", [("60","Cuando no abre","Reintentar o hablar con alguien"),("61","Tus herramientas","Se abren dentro de la app")]),
]
def _png(n):
    m = sorted(glob.glob(os.path.join(B, "mockups", n + "-*.png")))
    return "../mockups/" + os.path.basename(m[0]) if m else ""
css62 = '''
body{background:#ECECF1}
.sheet{width:1600px;padding:48px 56px 60px}
.hd{display:flex;align-items:center;gap:16px;margin-bottom:6px}
.hd .mark{width:48px;height:48px;border-radius:14px;background:linear-gradient(140deg,#7B6CFF 0%,#5B4BFF 55%,#3F2FE0 100%);display:grid;place-items:center;box-shadow:0 4px 12px rgba(91,75,255,.35)}
.hd .mark svg{width:26px;height:26px}
.hd h1{font-size:34px}.hd p{font-size:18px;color:var(--ink2);margin-top:2px}
.hd .tag{margin-left:auto;font-size:16px;font-weight:600;color:var(--accent);background:#fff;padding:9px 16px;border-radius:999px;box-shadow:var(--shadow)}
.grp{margin-top:34px}
.grp h2{font-size:22px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.grp h2 span{font-size:15px;font-weight:600;color:var(--ink3)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px 22px}
.tile img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 26px rgba(20,20,50,.12);background:#fff}
.cap{margin-top:10px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.cap .n{font-size:13px;font-weight:700;color:#fff;background:var(--accent);border-radius:7px;padding:2px 7px}
.cap b{font-size:16.5px;font-weight:650}
.cap span{font-size:14.5px;color:var(--ink2)}
.cap span:not(.n){flex-basis:100%;margin-top:-4px}
.rule{margin-top:36px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.rule div{background:#fff;border-radius:18px;padding:16px 18px;box-shadow:var(--shadow);font-size:16px;color:var(--ink2);line-height:1.4}
.rule b{display:block;color:var(--ink);font-size:17px;margin-bottom:4px}
'''
g = ""
for title, items in SHEET2:
    tiles = "".join(f'<div class="tile"><img src="{_png(n)}"><div class="cap"><span class="n">{n}</span><b>{t}</b><span>{d}</span></div></div>' for n,t,d in items)
    g += f'<section class="grp"><h2>{title}<span>{len(items)} pantallas</span></h2><div class="grid">{tiles}</div></section>'
rules = '''<div class="rule"><div><b>Todo dentro de la app</b>Ninguna herramienta abre otra pestaña. La barra lateral nunca desaparece.</div>
<div><b>Un botón principal</b>Cada pantalla tiene una sola acción grande y una frase de qué pasa después.</div>
<div><b>3 pestañas como máximo</b>Lo principal · Historial · Ajustes. Lo avanzado, cerrado por defecto.</div>
<div><b>Nunca un callejón</b>Si algo falla: qué pasó, Intentar otra vez y Hablar con una persona.</div></div>'''
b62 = f'''<div class="sheet"><div class="hd"><div class="mark">{LOGO_MARK}</div><div><h1>Chalyb · el interior de cada herramienta</h1><p>Clips, Señales y En vivo se abren dentro de la app, con el mismo sistema de diseño.</p></div><div class="tag">50 – 61</div></div>{g}{rules}</div>'''
write("62-overview-herramientas.html", page2("Vista general herramientas", b62, css62))
print("built tools 50-62")
