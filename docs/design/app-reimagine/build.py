# Generates the static HTML mock screens for the Chalyb app reimagine.
import os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), "html")

P = {
 "home":'<path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H4.5A1.5 1.5 0 0 1 3 20z"/>',
 "results":'<rect x="7" y="3" width="14" height="14" rx="2.5"/><path d="M3 7.5V18a3 3 0 0 0 3 3h10.5"/><path d="m12.5 7.6 4 2.4-4 2.4z" fill="currentColor"/>',
 "user":'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 "scissors":'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
 "trend":'<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
 "live":'<circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/>',
 "grid":'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 "arrow":'<path d="M5 12h14M13 5l7 7-7 7"/>',
 "chev":'<path d="m9 18 6-6-6-6"/>', "chevl":'<path d="m15 18-6-6 6-6"/>', "chevd":'<path d="m6 9 6 6 6-6"/>',
 "check":'<path d="M20 6 9 17l-5-5"/>',
 "x":'<path d="M18 6 6 18M6 6l12 12"/>',
 "link":'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
 "upload":'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
 "download":'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
 "share":'<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
 "mail":'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
 "card":'<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
 "doc":'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8M8 17h5"/>',
 "globe":'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
 "bell":'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
 "chat":'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
 "coins":'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
 "files":'<path d="M20 7h-3a2 2 0 0 1-2-2V2"/><path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h7l4 4v10a2 2 0 0 1-2 2Z"/><path d="M3 7.6v12.8A1.6 1.6 0 0 0 4.6 22h9.8"/>',
 "captions":'<rect width="18" height="14" x="3" y="5" rx="2"/><path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>',
 "crop":'<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
 "send":'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
 "stamp":'<path d="M5 22h14"/><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77Z"/><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-3-3c-1.69 0-3 1-3 3s1 2 1 3.5V13"/>',
 "code":'<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
 "sparkle":'<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
 "star":'<path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
 "plus":'<path d="M12 5v14M5 12h14"/>',
 "clock":'<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
 "shield":'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
 "bolt":'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
 "lock":'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 "sliders":'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
 "folder":'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
}
def ic(name, cls="i", style=""):
    s = f' style="{style}"' if style else ""
    return f'<svg class="{cls}" viewBox="0 0 24 24"{s}>{P[name]}</svg>'

PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" fill="#fff"/></svg>'
YT = '<svg viewBox="0 0 28 20" width="34" height="24"><rect width="28" height="20" rx="6" fill="#FF0033"/><path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff"/></svg>'
TW = '<svg viewBox="0 0 24 26" width="26" height="28"><path d="M3.5 1 1.8 5.4v16h5.4v3h3l3-3h4.4l5.6-5.6V1z" fill="#9146FF"/><path d="M5.5 3h15v11.8l-3.4 3.4h-5.4l-3 3v-3H5.5z" fill="#fff"/><path d="M11 6.6h2v5.6h-2zM16.2 6.6h2v5.6h-2z" fill="#9146FF"/></svg>'
TT = '<svg viewBox="0 0 24 24" width="26" height="26"><rect width="24" height="24" rx="6" fill="#111"/><path d="M13.2 5h2.4c.2 1.7 1.3 2.9 3 3.1v2.4a5.6 5.6 0 0 1-3-1v4.9a4.4 4.4 0 1 1-4.4-4.4c.25 0 .5 0 .74.06v2.5a2 2 0 1 0 1.26 1.86z" fill="#25F4EE" transform="translate(-.5 -.4)"/><path d="M13.2 5h2.4c.2 1.7 1.3 2.9 3 3.1v2.4a5.6 5.6 0 0 1-3-1v4.9a4.4 4.4 0 1 1-4.4-4.4c.25 0 .5 0 .74.06v2.5a2 2 0 1 0 1.26 1.86z" fill="#FE2C55" transform="translate(.5 .4)"/><path d="M13.2 5h2.4c.2 1.7 1.3 2.9 3 3.1v2.4a5.6 5.6 0 0 1-3-1v4.9a4.4 4.4 0 1 1-4.4-4.4c.25 0 .5 0 .74.06v2.5a2 2 0 1 0 1.26 1.86z" fill="#fff"/></svg>'
LOGO_MARK = '<svg viewBox="0 0 24 24"><path d="M17.5 7.2A7 7 0 1 0 17.5 16.8" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><circle cx="17.6" cy="12" r="2" fill="#fff"/></svg>'

def page(title, body, extra_css=""):
    return f'''<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>{title}</title>
<link rel="stylesheet" href="style.css"><style>{extra_css}</style></head><body>{body}</body></html>'''

def sidebar(active):
    items = [("inicio","home","Inicio"),("resultados","results","Mis resultados"),("cuenta","user","Mi cuenta")]
    nav = "".join(f'<a class="{"on" if k==active else ""}">{ic(i)}<span>{t}</span></a>' for k,i,t in items)
    return f'''<aside class="side"><div class="logo"><div class="mark">{LOGO_MARK}</div><div class="word">Chalyb</div></div>
<nav class="nav">{nav}</nav>
<div class="me"><div class="avatar">ML</div><div><div class="n">María López</div><div class="p">Plan Pro</div></div></div></aside>'''

# Video-frame-like thumbnails (abstract scenes, no people)
SCENES = [
 ("linear-gradient(160deg,#2B1B6B 0%,#6A2CC9 45%,#FF6B9A 100%)","#FFD36B"),
 ("linear-gradient(170deg,#0C2D48 0%,#1478A8 50%,#38E1C4 100%)","#B9FFF1"),
 ("linear-gradient(165deg,#3A0D12 0%,#C2362C 50%,#FFB347 100%)","#FFE7A3"),
 ("linear-gradient(160deg,#101935 0%,#2E3DBA 50%,#8FA2FF 100%)","#E2E7FF"),
 ("linear-gradient(170deg,#0F2A1D 0%,#1F8A4C 50%,#C8F169 100%)","#F2FFC2"),
 ("linear-gradient(165deg,#2A1240 0%,#B23A8E 50%,#FFC371 100%)","#FFE2F2"),
]
def thumb(i, w, h, dur="", cap="", radius=16, play=True, playsize=None):
    bg, glow = SCENES[i % len(SCENES)]
    ps = f'width:{playsize}px;height:{playsize}px;' if playsize else ''
    layers = f'''<div style="position:absolute;inset:0;background:{bg}"></div>
<div style="position:absolute;width:{w*1.1}px;height:{w*1.1}px;left:{w*0.35}px;top:{-w*0.25}px;border-radius:50%;background:radial-gradient(circle,{glow}cc 0%,transparent 62%);opacity:.75"></div>
<div style="position:absolute;left:{w*0.12}px;right:{w*0.12}px;top:{h*0.18}px;height:{h*0.3}px;border-radius:{max(6,w*0.04)}px;background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.06));box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:{h*0.34}px;background:linear-gradient(180deg,transparent,rgba(0,0,0,.55))"></div>
<div style="position:absolute;left:-10%;right:-10%;bottom:{h*0.2}px;height:{h*0.16}px;border-radius:50% 50% 0 0;background:rgba(0,0,0,.22)"></div>'''
    p = f'<div class="play" style="{ps}">{PLAY}</div>' if play else ''
    d = f'<div class="dur">{dur}</div>' if dur else ''
    c = f'<div class="cap">{cap}</div>' if cap else ''
    return f'<div class="thumb" style="width:{w}px;height:{h}px;border-radius:{radius}px">{layers}{p}{d}{c}</div>'

def write(name, html):
    with open(os.path.join(H, name), "w", encoding="utf-8") as f: f.write(html)

# ====================== 01 INICIO ======================
TASKS = [
 ("Clips","scissors","Hacer clips de mi stream","Crea clips cortos listos para TikTok, Reels y Shorts."),
 ("Señales","trend","Recibir señales de cripto","Te avisamos cuándo comprar o vender, en tu celular."),
 ("En vivo","live","Manejar mi transmisión","Controla tus escenas de OBS desde un solo lugar."),
 ("Y mucho más","grid","Más herramientas","Asistente, Pronósticos, Inmuebles e Inversiones."),
]
css01 = '''
.tasks{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:36px}
.task{display:flex;align-items:flex-start;gap:22px;padding:28px 28px 28px 28px;min-height:178px;position:relative}
.task .big{width:72px;height:72px;border-radius:20px;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.task .big svg.i{width:36px;height:36px;stroke-width:1.9}
.task .t{flex:1;padding-top:2px;padding-right:48px}
.task .t h2{margin-top:6px}
.task .t p{font-size:18px;color:var(--ink2);margin-top:8px;line-height:1.4}
.task .go{position:absolute;right:26px;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:var(--bg);color:var(--accent);display:grid;place-items:center}
.task.first{box-shadow:0 0 0 2px var(--accent),var(--shadow-lg)}
.task.first .big{background:var(--accent);color:#fff}
.task.first .go{background:var(--accent);color:#fff}
.strip{margin-top:22px;display:flex;align-items:center;gap:14px;padding:16px 22px;border-radius:18px;background:var(--tint2);border:1px solid #E4E0FF;font-size:17px;color:var(--ink2)}
.strip .ok{width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}
.strip .ok svg{width:17px;height:17px;stroke-width:3}
.strip b{color:var(--ink);font-weight:650}
.strip .tools{display:flex;gap:8px;margin-left:auto}
.strip .tools span{white-space:nowrap;background:#fff;border-radius:999px;padding:5px 12px;font-size:15px;font-weight:550;color:var(--ink2);box-shadow:inset 0 0 0 1px #E4E0FF}
.latest{margin-top:34px}
.latest .lh{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px}
.latest .lh h3{font-size:22px;font-weight:650;letter-spacing:-.02em}
.latest .lh a{font-size:18px;color:var(--accent);font-weight:600}
.ready{display:flex;align-items:center;gap:22px;padding:18px 22px}
.stack{display:flex}
.stack .thumb{box-shadow:0 0 0 3px #fff}
.stack .thumb + .thumb{margin-left:-18px}
.ready .tx{flex:1}
.ready .tx b{font-size:20px;font-weight:650;display:flex;align-items:center;gap:10px}
.ready .tx small{display:block;font-size:17px;color:var(--ink2);margin-top:3px}
.pill-ok{display:inline-flex;align-items:center;gap:6px;background:var(--ok-tint);color:var(--ok);font-size:14px;font-weight:700;padding:4px 10px;border-radius:999px}
.pill-ok svg{width:14px;height:14px;stroke-width:3}
'''
cards = ""
for n,(lab,icn,title,desc) in enumerate(TASKS):
    cards += f'''<div class="card task{' first' if n==0 else ''}"><div class="big">{ic(icn)}</div>
<div class="t"><div class="label">{lab}</div><h2>{title}</h2><p>{desc}</p></div><div class="go">{ic("arrow")}</div></div>'''
stack = "".join(thumb(i, 46, 78, radius=10, play=False) for i in range(4))
body01 = f'''<div class="app">{sidebar("inicio")}<main class="main"><div class="wrap">
<div class="eyebrow">Hola, María 👋</div><h1>¿Qué quieres hacer hoy?</h1>
<div class="tasks">{cards}</div>
<div class="strip"><div class="ok">{ic("check")}</div><div><b>Todo incluido en tu plan Pro.</b> Sin pagos extra.</div>
<div class="tools"><span>Clips</span><span>Señales</span><span>En vivo</span><span>Asistente</span><span>y 3 más</span></div></div>
<div class="latest"><div class="lh"><h3>Lo último</h3><a>Ver todo</a></div>
<div class="card ready"><div class="stack">{stack}</div>
<div class="tx"><b>Tus 6 clips están listos <span class="pill-ok">{ic("check")}Listos</span></b><small>De tu stream “Noche de preguntas” · hace 10 minutos</small></div>
<button class="btn btn-primary" style="height:54px">Ver mis clips</button></div></div>
</div></main></div>'''
write("01-inicio.html", page("Inicio", body01, css01))

# ====================== shared flow top ======================
def topbar(back="Atrás", step=None, total=3, done=0):
    st = ""
    if step:
        bars = "".join(f'<i class="{"on" if k<step or k<done else ""}"></i>' for k in range(total))
        st = f'<div class="steps"><div class="bar">{bars}</div><div class="t">Paso {step} de {total}</div></div>'
    return f'''<header class="topbar" style="position:relative"><button class="back">{ic("chevl")}{back}</button>
<div class="toptitle"><span class="tmark">{ic("scissors")}</span>Hacer clips</div>
<button class="close">{ic("x")}</button></header>{st}'''

# ====================== 02 PASO 1 ======================
css02 = '''
.col{max-width:820px}
.title{margin-top:72px;text-align:center}
.inp{margin-top:48px;display:flex;align-items:center;gap:16px;height:84px;padding:0 12px 0 26px;background:#fff;border-radius:22px;box-shadow:0 0 0 2px var(--accent),0 0 0 7px rgba(91,75,255,.12),var(--shadow)}
.inp svg.i{width:28px;height:28px;color:var(--ink3)}
.inp .ph{flex:1;font-size:23px;color:#A8A8B0}
.inp .caret{display:inline-block;width:2px;height:30px;background:var(--accent);vertical-align:middle;margin-right:2px}
.inp .paste{height:60px;padding:0 22px;border-radius:15px;background:var(--tint);color:var(--accent);font-weight:650;font-size:18px}
.help{display:flex;gap:10px;justify-content:center;align-items:center;margin-top:16px;color:var(--ink2);font-size:17px}
.or{display:flex;align-items:center;gap:18px;margin:40px 0 24px;color:var(--ink3);font-size:17px;font-weight:500}
.or::before,.or::after{content:"";flex:1;height:1px;background:#DEDEE4}
.alts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.alt{height:84px;border-radius:20px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:center;gap:14px;font-size:19px;font-weight:600}
.alt .u{width:40px;height:40px;border-radius:12px;background:var(--tint);color:var(--accent);display:grid;place-items:center}
.alt .u svg{width:22px;height:22px}
.foot{margin-top:52px}
.note{margin-top:16px;text-align:center;font-size:16px;color:var(--ink3);display:flex;gap:8px;justify-content:center;align-items:center}
.note svg.i{width:18px;height:18px}
'''
body02 = f'''<div class="flow">{topbar("Inicio", step=1)}
<div class="col"><div class="title"><h1>Pega el enlace de tu stream o video</h1>
<p class="sub">Copia la dirección de tu video y pégala aquí. Nosotros hacemos el resto.</p></div>
<div class="inp">{ic("link")}<div class="ph"><span class="caret"></span>https://youtube.com/...</div><button class="paste">Pegar</button></div>
<div class="help">Funciona con YouTube, Twitch, Kick y Facebook.</div>
<div class="or">o también puedes</div>
<div class="alts"><button class="alt">{YT}Conectar YouTube</button><button class="alt">{TW}Conectar Twitch</button>
<button class="alt"><span class="u">{ic("upload")}</span>Subir un video</button></div>
<div class="foot"><button class="btn btn-primary btn-xl">Continuar</button>
<div class="note">{ic("lock")}Tu video es privado. Solo tú puedes verlo.</div></div></div></div>'''
write("02-clips-paso1.html", page("Paso 1", body02, css02))

# ====================== 03 / 06 PASO 2 ======================
css03 = '''
.col{max-width:1000px}
.title{margin-top:36px;text-align:center}
.fmts{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:34px}
.fmt{position:relative;background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:18px 18px 22px;text-align:center}
.fmt .stage{height:158px;border-radius:16px;background:var(--bg);display:grid;place-items:center}
.fmt .shape{border-radius:10px;background:linear-gradient(160deg,#C9C3FF,#8C80FF);position:relative;box-shadow:0 6px 16px rgba(91,75,255,.25)}
.fmt .shape::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-35%,-50%);border-left:14px solid #fff;border-top:9px solid transparent;border-bottom:9px solid transparent}
.fmt h3{font-size:21px;font-weight:650;margin-top:18px;letter-spacing:-.015em}
.fmt p{font-size:17px;color:var(--ink2);margin-top:4px}
.fmt.sel{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.fmt.sel .stage{background:var(--tint)}
.fmt .chk{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;box-shadow:0 0 0 4px #fff}
.fmt .chk svg{width:19px;height:19px;stroke-width:3}
.fmt .rad{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;box-shadow:inset 0 0 0 2px #D2D2DA;background:#fff}
.badge{position:absolute;top:14px;left:14px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;padding:6px 12px;border-radius:999px;letter-spacing:.01em}
.count{margin-top:22px;display:flex;align-items:center;justify-content:space-between;padding:20px 22px 20px 26px}
.count b{font-size:21px;font-weight:650;display:block}
.count small{font-size:17px;color:var(--ink2)}
.seg{display:flex;background:#EBEBF0;border-radius:16px;padding:4px;gap:4px}
.seg span{width:96px;height:52px;display:grid;place-items:center;border-radius:13px;font-size:21px;font-weight:600;color:var(--ink2)}
.seg span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10),0 0 0 .5px rgba(0,0,0,.04)}
.adv{margin-top:14px;display:flex;align-items:center;gap:16px;padding:0 22px 0 26px;height:68px;border-radius:20px;background:transparent;box-shadow:inset 0 0 0 1.5px #DEDEE4}
.adv .ic2{color:var(--ink2)}
.adv b{font-size:19px;font-weight:600}
.adv small{font-size:16px;color:var(--ink3);margin-left:auto;margin-right:6px}
.adv .chev{color:var(--ink3)}
.foot{margin-top:24px;display:flex;justify-content:center}
.foot .btn-xl{max-width:520px}
'''
FMTS = [("TikTok / Reels / Shorts","Vertical",(64,112),True),("YouTube","Horizontal",(168,94),False),("Cuadrado","Instagram",(104,104),False)]
def fmts():
    out = ""
    for t,s,(w,h),sel in FMTS:
        mark = f'<div class="chk">{ic("check")}</div><div class="badge">Recomendado</div>' if sel else '<div class="rad"></div>'
        out += f'<div class="fmt{" sel" if sel else ""}">{mark}<div class="stage"><div class="shape" style="width:{w}px;height:{h}px"></div></div><h3>{t}</h3><p>{s}</p></div>'
    return out
count = '''<div class="card count"><div><b>¿Cuántos clips?</b><small>Te recomendamos 6 para empezar.</small></div>
<div class="seg"><span>3</span><span class="on">6</span><span>10</span></div></div>'''
def step2(expanded):
    if not expanded:
        adv = f'''<div class="adv">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><small>Para creadores profesionales</small>{ic("chevd","i chev")}</div>'''
    else:
        rows = [
          ("files","Subir varios videos a la vez","Haz clips de toda una semana de streams","sw"),
          ("captions","Subtítulos: estilo y idioma","Negrita amarilla · Español","val"),
          ("crop","Formato y duración personalizada","De 15 a 60 segundos","val2"),
          ("send","Publicar automáticamente en mis redes","TikTok y YouTube Shorts","swon"),
          ("stamp","Marca de agua / logo","Agrega tu logo en cada clip","sw"),
          ("code","Acceso API","Para conectar con tus propias apps","chev"),
        ]
        colors = ["#5B4BFF","#FF9F0A","#30B0C7","#34C759","#FF375F","#636366"]
        rh = ""
        for k,(icn,t,s,kind) in enumerate(rows):
            right = {"sw":'<div class="sw"></div>',"swon":'<div class="sw on"></div>',
                     "val":f'<span class="val">Editar</span>{ic("chev","i chev")}',
                     "val2":f'<span class="val">Automática</span>{ic("chev","i chev")}',
                     "chev":f'{ic("chev","i chev")}'}[kind]
            rh += f'<div class="row"><div class="ic" style="background:{colors[k]}">{ic(icn)}</div><div class="tx"><b>{t}</b><small>{s}</small></div>{right}</div>'
        adv = f'''<div class="advopen"><div class="advh">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><span class="pro">Para creadores profesionales</span>{ic("chevd","i chev up")}</div>
<div class="group">{rh}</div><p class="advnote">Si no tocas nada, usamos la mejor configuración por ti.</p></div>'''
    return adv
css06 = css03 + '''
.advopen{margin-top:14px}
.advh{display:flex;align-items:center;gap:16px;padding:0 22px 0 26px;height:64px}
.advh b{font-size:19px;font-weight:650}
.advh .ic2{color:var(--accent)}
.advh .pro{background:var(--tint);color:var(--accent);font-size:14px;font-weight:700;padding:5px 12px;border-radius:999px}
.advh .chev{margin-left:auto;color:var(--ink3);transform:rotate(180deg)}
.advnote{font-size:16px;color:var(--ink3);padding:12px 26px 0}
.group .row{padding-left:22px;padding-right:22px}
.row + .row::before{left:78px}
'''
b03 = f'''<div class="flow">{topbar("Atrás", step=2)}<div class="col"><div class="title"><h1>¿Dónde los vas a publicar?</h1>
<p class="sub">Elige la forma de tus clips. Puedes cambiarla después.</p></div>
<div class="fmts">{fmts()}</div>{count}{step2(False)}
<div class="foot"><button class="btn btn-primary btn-xl">Crear mis clips</button></div></div></div>'''
write("03-clips-paso2.html", page("Paso 2", b03, css03))
b06 = f'''<div class="flow" style="padding-bottom:48px">{topbar("Atrás", step=2)}<div class="col"><div class="title"><h1>¿Dónde los vas a publicar?</h1>
<p class="sub">Elige la forma de tus clips. Puedes cambiarla después.</p></div>
<div class="fmts">{fmts()}</div>{count}{step2(True)}
<div class="foot"><button class="btn btn-primary btn-xl">Crear mis clips</button></div></div></div>'''
write("06-avanzado.html", page("Avanzado", b06, css06))

# ====================== 04 CREANDO ======================
R = 78; C = 2*3.14159265*R
css04 = f'''
.col{{max-width:760px}}
.hero{{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:22px}}
.ring{{position:relative;width:184px;height:184px}}
.ring svg{{width:184px;height:184px;transform:rotate(-90deg)}}
.ring .pct{{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:46px;font-weight:700;letter-spacing:-.03em;font-variant-numeric:tabular-nums}}
.ring .pct span{{font-size:24px;font-weight:600;color:var(--ink2);margin-left:2px}}
.hero h1{{margin-top:26px}}
.hero .sub{{max-width:600px;margin-top:10px}}
.list{{margin-top:26px}}
.list .row{{min-height:66px}}
.list .row + .row::before{{left:76px}}
.dot{{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none}}
.dot.ok{{background:var(--ok);color:#fff}} .dot.ok svg{{width:20px;height:20px;stroke-width:3}}
.dot.run{{box-shadow:inset 0 0 0 3px var(--tint);position:relative}}
.dot.run::after{{content:"";position:absolute;inset:0;border-radius:50%;border:3px solid transparent;border-top-color:var(--accent);border-right-color:var(--accent);transform:rotate(20deg)}}
.dot.wait{{box-shadow:inset 0 0 0 2px #D6D6DD}}
.list .tx b{{font-size:19px}}
.list .row.done .tx b{{color:var(--ink)}}
.list .row.pending .tx b{{color:var(--ink3);font-weight:500}}
.list .row.active .tx b{{color:var(--accent);font-weight:650}}
.list .st{{font-size:16px;color:var(--ink3)}}
.list .st.ok{{color:var(--ok);font-weight:600}}
.foot{{margin-top:22px;display:flex;justify-content:center;gap:14px}}
'''
ring = f'''<div class="ring"><svg viewBox="0 0 184 184"><circle cx="92" cy="92" r="{R}" fill="none" stroke="#E7E5FF" stroke-width="16"/>
<circle cx="92" cy="92" r="{R}" fill="none" stroke="url(#g)" stroke-width="16" stroke-linecap="round" stroke-dasharray="{C*0.68:.1f} {C:.1f}"/>
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A7DFF"/><stop offset="1" stop-color="#5B4BFF"/></linearGradient></defs></svg>
<div class="pct">68<span>%</span></div></div>'''
items = [("ok","Video recibido","Listo","done"),("ok","Buscando los mejores momentos","Encontramos 9","done"),
         ("run","Agregando subtítulos…","En eso estamos","active"),("wait","Listo para descargar","","pending")]
lr = ""
for d,t,s,c in items:
    dot = f'<div class="dot ok">{ic("check")}</div>' if d=="ok" else f'<div class="dot {d}"></div>'
    stc = "st ok" if d=="ok" else "st"
    lr += f'<div class="row {c}">{dot}<div class="tx"><b>{t}</b></div><span class="{stc}">{s}</span></div>'
b04 = f'''<div class="flow">{topbar("Inicio", step=3)}<div class="col"><div class="hero">{ring}
<h1>Estamos creando tus clips</h1><p class="sub">Tarda unos minutos. Puedes cerrar esta página, te avisamos cuando estén listos.</p></div>
<div class="group list">{lr}</div>
<div class="foot"><button class="btn btn-secondary" style="height:62px;padding:0 30px">{ic("mail")}Avísame por correo</button></div></div></div>'''
write("04-clips-creando.html", page("Creando", b04, css04))

# ====================== 05 LISTOS ======================
css05 = '''
.col{max-width:1380px;padding:0 50px}
.hd{display:flex;align-items:flex-end;justify-content:space-between;margin-top:40px}
.hd .sub{margin-top:8px}
.hd .acts{display:flex;gap:12px}
.gal{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px;margin-top:36px}
.clip{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:10px 10px 12px}
.clip h4{font-size:17px;font-weight:650;line-height:1.25;margin:12px 6px 0;letter-spacing:-.01em;height:43px}
.clip .meta{font-size:15px;color:var(--ink3);margin:4px 6px 12px}
.clip .b{display:flex;flex-direction:column;gap:8px}
.clip .btn{height:48px;font-size:17px;border-radius:13px;padding:0 10px;width:100%}
.clip .btn svg.i{width:19px;height:19px}
.clip .btn-primary{box-shadow:none}
.clip .btn-gray{background:var(--bg)}
.keep{margin-top:30px;display:flex;align-items:center;justify-content:center;gap:10px;font-size:17px;color:var(--ink2)}
.keep svg.i{width:20px;height:20px;color:var(--ink3)}
.keep b{color:var(--ink);font-weight:600}
.star{position:absolute;left:10px;top:10px;background:#FFD60A;color:#1D1D1F;font-size:13px;font-weight:800;padding:4px 9px;border-radius:8px;display:flex;align-items:center;gap:4px;z-index:2}
'''
CLIPS = [("El mejor momento del stream","0:42","¡NO LO PUEDO <em>CREER</em>!"),
         ("Reacción épica","0:28","ESTO FUE <em>ÉPICO</em>"),
         ("La jugada final","0:35","ÚLTIMO <em>SEGUNDO</em>"),
         ("Respondiendo al chat","0:51","¿QUÉ ME <em>RECOMIENDAN</em>?"),
         ("Risa con los amigos","0:19","NO PUEDO <em>MÁS</em> JAJAJA"),
         ("El consejo del día","0:47","EL <em>TRUCO</em> ES ESTE")]
gal = ""
W = 180
for k,(t,d,c) in enumerate(CLIPS):
    star = f'<div class="star">{ic("star","i","width:12px;height:12px;fill:currentColor;stroke-width:0")}Top</div>' if k==0 else ""
    gal += f'''<div class="clip"><div style="position:relative">{star}{thumb(k, W, int(W*16/9), dur=d, cap=c, radius=14, playsize=50)}</div>
<h4>{t}</h4><div class="meta">Vertical · con subtítulos</div>
<div class="b"><button class="btn btn-primary">{ic("download")}Descargar</button><button class="btn btn-gray">{ic("share")}Compartir</button></div></div>'''
b05 = f'''<div class="flow"><header class="topbar" style="position:relative"><button class="back">{ic("chevl")}Inicio</button>
<div class="toptitle"><span class="tmark">{ic("scissors")}</span>Hacer clips</div><button class="close">{ic("x")}</button></header>
<div class="col"><div class="hd"><div><h1>Tus clips están listos 🎉</h1><p class="sub">Hicimos 6 clips de “Noche de preguntas”. Ya tienen subtítulos.</p></div>
<div class="acts"><button class="btn btn-secondary">{ic("plus")}Hacer más clips</button><button class="btn btn-primary">{ic("download")}Descargar todos</button></div></div>
<div class="gal">{gal}</div><div class="keep">{ic("folder")}<span>Tus clips se guardan en <b>Mis resultados</b>. Puedes volver por ellos cuando quieras.</span></div></div></div>'''
write("05-clips-listos.html", page("Listos", b05, css05))

# ====================== 07 MI CUENTA ======================
css07 = '''
.main{padding-top:48px}
.wrap{max-width:1080px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:28px;align-items:start}
.colx > * + *{margin-top:24px}
.plan{padding:26px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;border-radius:24px;box-shadow:0 12px 32px rgba(91,75,255,.30);position:relative;overflow:hidden}
.plan::after{content:"";position:absolute;right:-60px;top:-80px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.10)}
.plan .k{font-size:15px;font-weight:600;opacity:.85;letter-spacing:.04em;text-transform:uppercase}
.plan h2{font-size:28px;margin-top:6px;color:#fff}
.plan p{font-size:17px;opacity:.9;margin-top:6px}
.plan .pb{display:flex;align-items:center;justify-content:space-between;margin-top:20px}
.plan .btn{height:52px;background:#fff;color:var(--accent);font-size:18px;box-shadow:none;position:relative;z-index:1}
.plan .inc{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:600;opacity:.95}
.plan .inc svg{width:18px;height:18px;stroke-width:3}
.cred{padding:14px 20px 18px}
.cred .top{display:flex;align-items:center;gap:16px}
.cred .num{font-size:24px;font-weight:700;letter-spacing:-.02em}
.meter{height:10px;border-radius:5px;background:#ECEBF3;margin:12px 0 0 54px;overflow:hidden}
.meter i{display:block;height:100%;width:60%;border-radius:5px;background:linear-gradient(90deg,#8A7DFF,#5B4BFF)}
.cred .mt{display:flex;justify-content:space-between;font-size:15px;color:var(--ink3);margin:8px 0 0 54px}
.ok2{color:var(--ok);font-weight:600;font-size:17px;display:flex;align-items:center;gap:6px}
.ok2 svg{width:18px;height:18px;stroke-width:3}
.conn{font-size:17px;color:var(--accent);font-weight:600}
.row .brand{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none;background:#F2F2F6}
.human{display:flex;align-items:center;gap:16px;padding:20px;border-radius:20px;background:#fff;box-shadow:0 0 0 2px var(--ok),var(--shadow)}
.human .hi{width:52px;height:52px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;flex:none}
.human .hi svg{width:26px;height:26px}
.human b{font-size:20px;display:block}
.human small{font-size:16px;color:var(--ink2)}
.human .btn{margin-left:auto;height:50px;background:var(--ok);color:#fff;font-size:17px;padding:0 20px}
.prof{display:flex;align-items:center;gap:16px}
.prof .avatar{width:64px;height:64px;font-size:24px}
.prof .em{font-size:18px;color:var(--ink2)}
'''
def grow(icon_html, title, right, sub=""):
    s = f"<small>{sub}</small>" if sub else ""
    return f'<div class="row">{icon_html}<div class="tx"><b>{title}</b>{s}</div>{right}{ic("chev","i chev")}</div>'
def icb(name,color): return f'<div class="ic" style="background:{color}">{ic(name)}</div>'
pay = f'''<div><div class="ghead">Mi plan y pagos</div><div class="group">
<div class="row cred" style="display:block"><div class="top">{icb("coins","#FF9F0A")}<div class="tx"><b>Créditos disponibles</b></div><span class="num">1,200</span></div>
<div class="meter"><i></i></div><div class="mt"><span>Usaste 800 de 2,000 este mes</span><span>Se renuevan el 15 oct.</span></div></div>
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Visa •• 4821</span>')}
{grow(icb("doc","#8E8E93"),"Facturas",'<span class="val">CFDI listo</span>')}</div></div>'''
redes = f'''<div><div class="ghead">Mis redes conectadas</div><div class="group">
{grow(f'<div class="brand">{YT}</div>',"YouTube",f'<span class="ok2">{ic("check")}Conectado</span>',"@MariaEnVivo")}
{grow(f'<div class="brand">{TW}</div>',"Twitch",'<span class="conn">Conectar</span>')}
{grow(f'<div class="brand">{TT}</div>',"TikTok",'<span class="conn">Conectar</span>')}</div></div>'''
prefs = f'''<div><div class="ghead">Preferencias</div><div class="group">
{grow(icb("globe","#0A84FF"),"Idioma",'<span class="val">Español</span>')}
{grow(icb("bell","#FF375F"),"Notificaciones",'<span class="val">Correo y celular</span>')}</div></div>'''
ayuda = f'''<div><div class="ghead">Ayuda</div>
<div class="human"><div class="hi">{ic("chat")}</div><div><b>Hablar con una persona</b><small>Te respondemos en minutos, en español.</small></div><button class="btn">Escribir</button></div></div>'''
b07 = f'''<div class="app">{sidebar("cuenta")}<main class="main"><div class="wrap">
<div class="prof"><div class="avatar">ML</div><div><h1>Mi cuenta</h1><div class="em">María López · maria.lopez@correo.mx</div></div></div>
<div class="cols"><div class="colx"><div class="plan"><div class="k">Tu plan</div><h2>Plan Pro — todo incluido</h2>
<p>Se renueva el 15 de octubre de 2026 · $997 MXN al mes</p><div class="pb"><span class="inc">{ic("check")}Todas las herramientas</span><button class="btn">Ver mi plan</button></div></div>{pay}</div>
<div class="colx">{redes}{prefs}{ayuda}</div></div></div></main></div>'''
write("07-mi-cuenta.html", page("Mi cuenta", b07, css07))

# ====================== 08 INICIO MÓVIL ======================
css08 = '''
body{background:var(--bg)}
.phone{width:390px;height:844px;position:relative;overflow:hidden;background:var(--bg)}
.status{height:50px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 34px;font-size:17px;font-weight:600}
.status .r{display:flex;gap:6px;align-items:center}
.mtop{padding:4px 20px 0;display:flex;align-items:center;justify-content:space-between}
.mtop .logo{padding:0;gap:9px}.mtop .logo .mark{width:32px;height:32px;border-radius:10px}.mtop .logo .mark svg{width:18px;height:18px}
.mtop .logo .word{font-size:20px}
.mtop .avatar{width:38px;height:38px;font-size:14px}
.mh{padding:18px 20px 0}
.mh .eyebrow{font-size:18px;margin-bottom:4px}
.mh h1{font-size:29px;line-height:1.12;letter-spacing:-.035em;white-space:nowrap}
.mcards{padding:18px 16px 0;display:flex;flex-direction:column;gap:10px}
.mc{display:flex;align-items:center;gap:14px;padding:14px 12px 14px 14px;border-radius:22px;background:#fff;box-shadow:var(--shadow);min-height:96px}
.mc .big{width:54px;height:54px;border-radius:16px;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.mc .big svg.i{width:28px;height:28px;stroke-width:1.9}
.mc .t{flex:1;min-width:0}
.mc .label{font-size:12.5px}
.mc h2{font-size:18px;margin-top:1px;letter-spacing:-.025em;white-space:nowrap}
.mc p{font-size:15px;color:var(--ink2);margin-top:2px;line-height:1.3}
.mc .chev{color:#C4C4CC;width:20px;height:20px}
.mc.first{box-shadow:0 0 0 2px var(--accent),var(--shadow-lg)}
.mc.first .big{background:var(--accent);color:#fff}
.mstrip{margin:14px 16px 0;display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:16px;background:var(--tint2);border:1px solid #E4E0FF;font-size:15px;color:var(--ink2)}
.mstrip .ok{width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;flex:none}
.mstrip .ok svg{width:14px;height:14px;stroke-width:3}
.mstrip b{color:var(--ink)}
.tabs{position:absolute;left:0;right:0;bottom:0;height:88px;background:rgba(250,250,252,.92);backdrop-filter:blur(20px);border-top:1px solid #E2E2E8;display:flex;justify-content:space-around;padding-top:9px}
.tab{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;font-weight:600;color:#8E8E96;width:110px}
.tab svg.i{width:28px;height:28px}
.tab.on{color:var(--accent)}
.homebar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#111}
'''
MDESC = ["Para TikTok, Reels y Shorts.","Te avisamos cuándo comprar o vender.","Controla OBS desde tu celular.","Asistente, Pronósticos y más."]
mc = ""
for n,(lab,icn,title,desc) in enumerate(TASKS):
    desc = MDESC[n]
    mc += f'<div class="mc{" first" if n==0 else ""}"><div class="big">{ic(icn)}</div><div class="t"><div class="label">{lab}</div><h2>{title}</h2><p>{desc}</p></div>{ic("chev","i chev")}</div>'
sig = '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#1D1D1F"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#1D1D1F"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#1D1D1F"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#1D1D1F"/></svg>'
wifi = '<svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.2A10.6 10.6 0 0 0 8.5.5 10.6 10.6 0 0 0 1 3.5l1.2 1.2a9 9 0 0 1 6.3-2.5zm0 3.4c1.5 0 2.9.6 3.9 1.5l1.2-1.2a7.3 7.3 0 0 0-10.2 0l1.2 1.2c1-1 2.4-1.5 3.9-1.5zm0 3.4c.6 0 1.2.2 1.6.6L8.5 11.2 6.9 9.6c.4-.4 1-.6 1.6-.6z" fill="#1D1D1F"/></svg>'
bat = '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="#1D1D1F" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="#1D1D1F"/><path d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2z" fill="#1D1D1F" opacity=".5"/></svg>'
b08 = f'''<div class="phone"><div class="status"><span>9:41</span><span class="r">{sig}{wifi}{bat}</span></div>
<div class="mtop"><div class="logo"><div class="mark">{LOGO_MARK}</div><div class="word">Chalyb</div></div><div class="avatar">ML</div></div>
<div class="mh"><div class="eyebrow">Hola, María 👋</div><h1>¿Qué quieres hacer hoy?</h1></div>
<div class="mcards">{mc}</div>
<div class="mstrip"><div class="ok">{ic("check")}</div><div><b>Todo incluido</b> en tu plan Pro</div></div>
<nav class="tabs"><div class="tab on">{ic("home")}Inicio</div><div class="tab">{ic("results")}Resultados</div><div class="tab">{ic("user")}Cuenta</div></nav>
<div class="homebar"></div></div>'''
write("08-inicio-movil.html", page("Inicio móvil", b08, css08))
# ====================== 09-30: extended screens ======================
_D = os.path.dirname(os.path.abspath(__file__))
for _m in ["more_shared.py","more_public.py","more_signup.py","more_app.py","more_admin.py","more_landing.py","more_overview.py"]:
    _f = os.path.join(_D, _m)
    if os.path.exists(_f): exec(open(_f, encoding="utf-8").read())
print("built")
