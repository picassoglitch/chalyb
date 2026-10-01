# ===================== 09 CONTACT SHEET (all screens) =====================
SHEET = [
 ("La app (rediseño base)", [("01","Inicio","4 tareas grandes"),("02","Clips · Paso 1","Pega tu enlace"),("03","Clips · Paso 2","Formato y cantidad"),
   ("04","Clips · Paso 3","Creando tus clips"),("05","Clips listos","Descargar o compartir"),("06","Opciones avanzadas","Para pros, escondidas"),("07","Mi cuenta","Plan, pagos, redes, ayuda")]),
 ("Sitio público", [("10","Landing","Página completa (recortada aquí)"),("12","Planes","Gratis · Pro · VIP, anual activado")]),
 ("Registro y prueba gratis", [("13","Crear cuenta","Google o correo, 1 paso"),("14","Tu prueba","Elige plan + aviso de cobro"),("15","Pago","Tarjeta con Mercado Pago + casilla"),
   ("16","Listo","Fechas y monto, sin sorpresas"),("17","Avisos","4 estados de la prueba"),("18","Cancelar","1 confirmación y listo")]),
 ("Herramientas y cuenta", [("19","Mis resultados","Todo lo hecho, con filtros"),("20","Señales · Paso 1","Elige tus monedas"),("21","Señales activas","Avisos en palabras simples"),
   ("22","En vivo","Un botón grande para transmitir"),("23","Más herramientas","Incluido en tu plan / Pruébalo"),("24","Vacío y errores","Siempre un siguiente paso"),
   ("25","Ayuda","Hablar con una persona"),("30","Mi plan","Pro anual pagado")]),
 ("Panel del dueño (/dashboard)", [("27","Centro de mando","KPIs y lo urgente"),("28","Personas","Tabla + acción con confirmación"),("29","Dinero","Una sola fuente de verdad")]),
]
PHONES = [("08","Inicio en el celular"),("11","Landing en el celular"),("26","Avisos en el celular")]
import glob as _g
def _png(n):
    m = sorted(_g.glob(os.path.join(os.path.dirname(H), "mockups", n+"-*.png")))
    return "../mockups/" + os.path.basename(m[0]) if m else ""
css09 = '''
body{background:#ECECF1}
.sheet{width:1600px;padding:52px 56px 64px}
.hd{display:flex;align-items:center;gap:16px;margin-bottom:10px}
.hd .mark{width:48px;height:48px;border-radius:14px;background:linear-gradient(140deg,#7B6CFF 0%,#5B4BFF 55%,#3F2FE0 100%);display:grid;place-items:center;box-shadow:0 4px 12px rgba(91,75,255,.35)}
.hd .mark svg{width:26px;height:26px}
.hd h1{font-size:34px}.hd p{font-size:18px;color:var(--ink2);margin-top:2px}
.hd .tag{margin-left:auto;font-size:16px;font-weight:600;color:var(--accent);background:#fff;padding:9px 16px;border-radius:999px;box-shadow:var(--shadow)}
.grp{margin-top:38px}
.grp h2{font-size:22px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:10px}
.grp h2 span{font-size:15px;font-weight:600;color:var(--ink3)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:26px 22px}
.tile img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.06),0 10px 26px rgba(20,20,50,.12);background:#fff}
.cap{margin-top:10px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.cap .n{font-size:13px;font-weight:700;color:#fff;background:var(--accent);border-radius:7px;padding:2px 7px}
.cap b{font-size:16.5px;font-weight:650}
.cap span{font-size:14.5px;color:var(--ink2)}
.phones{display:flex;gap:40px}
.ph{width:300px}
.bezel{padding:10px;border-radius:50px;background:#1C1C1E;box-shadow:0 20px 50px rgba(20,20,50,.25)}
.bezel img{display:block;width:100%;aspect-ratio:390/844;object-fit:cover;object-position:top;border-radius:41px}
'''
g = ""
for title, items in SHEET:
    tiles = "".join(f'<div class="tile"><img src="{_png(n)}"><div class="cap"><span class="n">{n}</span><b>{t}</b><span>{d}</span></div></div>' for n,t,d in items)
    g += f'<section class="grp"><h2>{title}<span>{len(items)} pantallas</span></h2><div class="grid">{tiles}</div></section>'
ph = "".join(f'<div class="ph"><div class="bezel"><img src="{_png(n)}"></div><div class="cap" style="justify-content:center"><span class="n">{n}</span><b>{t}</b></div></div>' for n,t in PHONES)
g += f'<section class="grp"><h2>En el celular<span>390 × 844</span></h2><div class="phones">{ph}</div></section>'
b09 = f'''<div class="sheet"><div class="hd"><div class="mark">{LOGO_MARK}</div><div><h1>Chalyb · rediseño completo</h1><p>Sitio, registro y prueba, app, herramientas y panel del dueño. Una cosa por pantalla, un botón grande, palabras simples.</p></div><div class="tag">01 – 30</div></div>{g}</div>'''
write("09-overview-completo.html", page2("Vista general completa", b09, css09))
