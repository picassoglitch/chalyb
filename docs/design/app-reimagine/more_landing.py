# ===================== 40-43 LANDING v2 (sitio público "/") =====================
# Reusa el sistema visual del app (style.css + SH). Hero = composite real de pantallas del app.
import json as _json
MK = "../mockups/"
CK = ic("check","i","width:16px;height:16px;stroke-width:3")

# ---- fuentes del hero: pantallas reales del app, sin nombres de personas ----
_src_movil = b08.replace("Hola, María 👋","Hola 👋").replace('<div class="avatar">ML</div>', f'<div class="avatar" style="background:#E9E7FF;color:var(--accent)">{ic("user","i","width:20px;height:20px")}</div>')
write("_src-inicio-movil.html", page("Inicio móvil (landing)", _src_movil, css08))

def shot(src, x, y, w, h, outw, base=1440, radius=14, extra=""):
    s = outw / w
    return (f'<div class="shot" style="width:{outw}px;height:{h*s:.0f}px;background-image:url({MK}{src});'
            f'background-size:{base*s:.1f}px auto;background-position:{-x*s:.1f}px {-y*s:.1f}px;border-radius:{radius}px;{extra}"></div>')

def laptop(w=640, img="05-clips-listos.png"):
    sw = w - 24; sh = round(sw * 900 / 1440)
    return f'''<div class="laptop" style="width:{w}px"><div class="lid"><div class="cam"></div>
<div class="scr" style="width:{sw}px;height:{sh}px;background-image:url({MK}{img})"></div></div><div class="base"><i></i></div></div>'''

def phone(w=210, img="landing-src/inicio-movil.png"):
    sw = w - 16; sh = round(sw * 844 / 390)
    return f'''<div class="phonef" style="width:{w}px"><div class="scr" style="width:{sw}px;height:{sh}px;background-image:url({MK}{img})"></div><div class="isl"></div></div>'''

def notif(cls="notif"):
    return f'''<div class="{cls}"><div class="na">{LOGO_MARK}</div><div class="nt"><div class="nh"><b>Chalyb</b><span>ahora</span></div>
<div class="nb"><b>Tus clips están listos</b><br>Ya tienen subtítulos. Descárgalos cuando quieras.</div></div></div>'''

LTOOLS = {  # nombre: (icono, color, frase)
 "Clips":("scissors","#5B4BFF","Pega el enlace de tu stream y recibe clips cortos con subtítulos para TikTok, Reels y Shorts."),
 "Señales":("trend","#FF9F0A","Te avisamos cuándo es buen momento para comprar o vender cripto."),
 "En vivo":("live","#FF375F","Maneja tu transmisión y tus escenas de OBS con botones grandes."),
 "Asistente":("bot","#30B0C7","Un bot que contesta a tus clientes y seguidores, de día y de noche."),
 "Pronósticos":("target","#34A853","Los pronósticos deportivos del día, explicados en simple."),
 "Inmuebles":("house","#0A84FF","Publica tus propiedades y atiende a interesados sin perder tiempo."),
 "Inversiones":("chart","#AF52DE","Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero."),
}
INC = f'<span class="inc">{CK}Incluido en Pro</span>'
def disc(t): return f'<div class="dsc">{ic("info","i","width:17px;height:17px")}{t}</div>'
DISC_FIN = "Informativo, no es asesoría financiera."
DISC_BET = "Informativo, no es asesoría de apuestas."

NAV_LINKS = ["Herramientas","Precios","Ayuda"]
STEPS = [
 ("Pega el enlace","Copia la dirección de tu stream o video y pégala. Funciona con YouTube, Twitch, Kick y Facebook.", ("02-clips-paso1.png",318,190,804,574)),
 ("Elige dónde lo vas a publicar","TikTok, Reels, Shorts, YouTube o Instagram. Nosotros te recomendamos la mejor forma.", ("03-clips-paso2.png",225,150,990,707)),
 ("Descarga tus clips","Te avisamos cuando estén listos, ya con subtítulos. Descárgalos o compártelos.", ("05-clips-listos.png",60,112,980,700)),
]
AUD = [
 ("live","Streamers","Clips de cada transmisión y tus escenas de OBS con un toque."),
 ("scissors","Creadores","Publica todos los días sin pasar horas editando."),
 ("bot","Negocios","Un Asistente que contesta a tus clientes, de día y de noche."),
 ("heart","Tu mamá también","Botones grandes y palabras simples. Si sabe mandar un WhatsApp, sabe usar Chalyb."),
]
P["heart"] = '<path d="M19.5 12.6 12 20l-7.5-7.4A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 7.5 6.3z"/>'
LFAQ = [
 ("¿De verdad los primeros 7 días son gratis?","Sí, en Pro mensual y Pro anual. Hoy pagas $0 y hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Si no quieres seguir, cancelas en 1 clic antes de esa fecha y no se te cobra nada."),
 ("¿Cuánto pago después de los 7 días?",f"Lo que tú elijas: {P_PRO_M} MXN al mes o {P_PRO_Y} MXN al año, IVA incluido. Antes de cada renovación te avisamos por correo: 7 días antes en el plan mensual, y 30 y 7 días antes en el anual."),
 ("¿Cómo cancelo?","Entra a Mi cuenta → Mi plan → Cancelar. Es 1 clic y 1 confirmación, sin llamadas. Sigues con tu plan hasta el final del periodo que pagaste."),
 ("¿Necesito saber de tecnología?","No. Cada herramienta te guía en 3 pasos, con botones grandes y palabras simples."),
 ("¿Qué incluye el plan Pro?","Todas las herramientas: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones, con créditos nuevos cada mes. Sin pagos extra."),
 ("¿Las Señales me dicen en qué invertir?","No. Son avisos informativos, iguales para todos, y no usan tus saldos ni tus inversiones. No son asesoría financiera: tú decides."),
 ("¿Cómo pago?","Con tarjeta de crédito o débito, de forma segura con Mercado Pago. Chalyb no guarda el número de tu tarjeta."),
 ("¿Puedo cambiar de plan?","Sí. Desde Mi cuenta → Mi plan puedes pasar de mensual a anual, subir a VIP o volver a Gratis cuando quieras."),
]
GRATIS_LI = ["Clips para probar","Tus resultados guardados","Ayuda por correo","-Señales, En vivo y las demás herramientas"]
PRO_LI = ["Las 7 herramientas: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones","Créditos nuevos cada mes","Clips sin marca de agua","Opciones avanzadas para profesionales","Cancela en 1 clic, sin llamadas"]
VIP_LI = ["Todo lo de Pro","Muchos más créditos cada mes","Atención prioritaria"]
def lis2(items):
    o = ""
    for t in items:
        no = t.startswith("-")
        o += f'<li class="{"no" if no else ""}"><span class="ck">{ic("x" if no else "check")}</span><span>{t.lstrip("-")}</span></li>'
    return f"<ul>{o}</ul>"

# =================== CSS compartido landing (escritorio) ===================
css40 = '''
body{background:var(--bg)}
.pg{width:1440px;overflow:hidden}
.sec{max-width:1240px;margin:0 auto;padding:0 40px}
/* nav */
.ln{height:80px;display:flex;align-items:center;gap:44px;padding:0 48px;background:rgba(255,255,255,.82);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line);position:relative;z-index:5}
.ln .logo{padding:0}
.ln .links{display:flex;gap:6px}
.ln .links a{font-size:18px;font-weight:550;color:var(--ink2);padding:10px 16px;border-radius:12px}
.ln .r{margin-left:auto;display:flex;align-items:center;gap:10px}
.ln .si{font-size:18px;font-weight:600;color:var(--ink);padding:0 16px;height:50px;display:flex;align-items:center}
.ln .btn{height:50px;font-size:18px;padding:0 24px;border-radius:14px}
/* hero */
.hsec{max-width:1360px}
.hero{display:grid;grid-template-columns:600px 1fr;gap:36px;align-items:center;padding:48px 0 64px;min-height:740px}
.kick{display:inline-flex;align-items:center;gap:10px;background:#fff;border-radius:999px;padding:7px 16px 7px 7px;font-size:16px;font-weight:600;color:var(--ink2);box-shadow:var(--shadow)}
.kick span{background:var(--tint);color:var(--accent);border-radius:999px;padding:4px 12px;font-size:14px;font-weight:700}
.hero h1{font-size:66px;line-height:1.04;letter-spacing:-.045em;margin-top:26px;font-weight:750}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,#5B4BFF 0%,#8B5BFF 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:4px}
.hero .sub{font-size:22px;line-height:1.45;margin-top:22px;max-width:500px}
.hero .cta{margin-top:34px}
.hero .cta .btn{height:72px;font-size:22px;padding:0 40px;border-radius:18px}
.hero .cta .btn svg.i{width:24px;height:24px}
.hero .note{font-size:18px;color:var(--ink2);margin-top:14px}
.hero .note b{color:var(--ink);font-weight:650}
.trust{display:flex;gap:22px;margin-top:28px;font-size:16px;color:var(--ink2);font-weight:550}
.trust span{display:flex;align-items:center;gap:7px}
.trust svg.i{width:18px;height:18px;color:var(--accent);stroke-width:2.8}
.comp{position:relative;height:560px}
.comp .glow{position:absolute;left:40px;top:60px;width:600px;height:460px;border-radius:50%;background:radial-gradient(closest-side,rgba(123,108,255,.28),rgba(123,108,255,0));filter:blur(10px)}
.laptop{position:relative}
.laptop .lid{background:linear-gradient(180deg,#2A2A2E,#1A1A1D);border-radius:22px 22px 8px 8px;padding:14px 12px 16px;box-shadow:0 30px 60px rgba(20,20,50,.22),0 8px 18px rgba(20,20,50,.12);position:relative}
.laptop .cam{position:absolute;top:5px;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#3A3A40}
.laptop .scr{background-size:cover;background-position:top center;border-radius:6px}
.laptop .base{height:18px;margin:0 -46px;background:linear-gradient(180deg,#EDEDF1 0%,#D2D2D9 60%,#B9B9C2 100%);border-radius:2px 2px 20px 20px;position:relative;box-shadow:0 14px 28px rgba(20,20,50,.16)}
.laptop .base i{position:absolute;top:0;left:50%;width:120px;height:7px;margin-left:-60px;background:#C3C3CB;border-radius:0 0 9px 9px}
.phonef{position:relative;background:#111114;border-radius:42px;padding:8px;box-shadow:0 30px 60px rgba(20,20,50,.30),0 0 0 1.5px #3A3A40 inset}
.phonef .scr{background-size:cover;background-position:top center;border-radius:34px}
.phonef .isl{position:absolute;top:17px;left:50%;width:62px;height:19px;margin-left:-31px;border-radius:12px;background:#000}
.notif{position:absolute;display:flex;gap:12px;align-items:flex-start;width:330px;padding:14px 16px;border-radius:22px;background:rgba(255,255,255,.94);backdrop-filter:blur(16px);box-shadow:0 18px 44px rgba(20,20,50,.16),0 0 0 1px rgba(20,20,50,.04)}
.notif .na{width:40px;height:40px;border-radius:11px;background:linear-gradient(140deg,#7B6CFF 0%,#5B4BFF 55%,#3F2FE0 100%);display:grid;place-items:center;flex:none}
.notif .na svg{width:22px;height:22px}
.notif .nt{flex:1;min-width:0}
.notif .nh{display:flex;justify-content:space-between;font-size:14px;color:var(--ink3)}
.notif .nh b{color:var(--ink2);font-weight:650;text-transform:uppercase;letter-spacing:.04em;font-size:13px}
.notif .nb{font-size:16px;line-height:1.35;color:var(--ink2);margin-top:2px}
.notif .nb b{color:var(--ink);font-weight:650}
/* section heads */
.band{padding:104px 0}
.band.white{background:#fff}
.shd{text-align:center;max-width:860px;margin:0 auto}
.shd .label{margin-bottom:14px}
.shd h2{font-size:48px;letter-spacing:-.04em;line-height:1.08;font-weight:750}
.shd p{font-size:21px;color:var(--ink2);margin-top:16px;line-height:1.45}
/* tools bento */
.bento{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:56px}
.tb{background:var(--bg);border-radius:28px;padding:30px 30px 28px;display:flex;flex-direction:column;min-height:300px;position:relative;overflow:hidden}
.tb h3{font-size:26px;font-weight:700;letter-spacing:-.025em;margin-top:22px}
.tb p{font-size:18px;color:var(--ink2);margin-top:8px;line-height:1.45}
.tb .tf{margin-top:auto;padding-top:20px;display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.inc{display:inline-flex;align-items:center;gap:6px;font-size:15px;font-weight:700;color:var(--accent);background:var(--tint);padding:6px 12px 6px 10px;border-radius:999px}
.dsc{display:flex;align-items:center;gap:7px;font-size:15px;color:var(--ink2);font-weight:550}
.dsc svg.i{color:var(--ink3)}
.icons2{display:flex}
.icons2 .tico + .tico{margin-left:-10px;box-shadow:0 0 0 4px var(--bg)}
.tb.clips{grid-column:span 2;flex-direction:row;gap:28px;padding-right:0}
.tb.clips .tx{display:flex;flex-direction:column;width:310px;flex:none}
.tb.clips .vis{flex:1;position:relative}
.tb.clips .vis .thumb{position:absolute;box-shadow:0 18px 40px rgba(20,20,50,.22)}
.tb.beat{grid-column:span 2;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;justify-content:center}
.tb.beat::after{content:"";position:absolute;right:-80px;top:-110px;width:340px;height:340px;border-radius:50%;background:rgba(255,255,255,.09)}
.tb.beat h3{font-size:36px;letter-spacing:-.035em;line-height:1.1;margin-top:0;color:#fff;max-width:720px;position:relative;z-index:1}
.tb.beat p{color:rgba(255,255,255,.9);font-size:19px;max-width:620px;margin-top:12px;position:relative;z-index:1}
.tb.beat .row7{display:flex;gap:10px;margin-top:24px;position:relative;z-index:1;align-items:center}
.tb.beat .row7 .tico{box-shadow:0 0 0 3px rgba(255,255,255,.22)}
.tb.beat .btn{margin-left:auto;background:#fff;color:var(--accent);height:56px;font-size:18px;border-radius:15px;box-shadow:none}
/* steps */
.steps3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:56px}
.st3{background:#fff;border-radius:28px;box-shadow:var(--shadow);padding:16px 16px 30px;display:flex;flex-direction:column}
.st3 .scrw{background:var(--bg);border-radius:18px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--line)}
.st3 .shot{display:block}
.st3 .meta{display:flex;align-items:center;gap:12px;margin:24px 14px 0}
.st3 .n{width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;font-size:21px;font-weight:700;display:grid;place-items:center;flex:none}
.st3 .bar{display:flex;gap:6px}
.st3 .bar i{display:block;width:34px;height:6px;border-radius:3px;background:#DCDCE3}
.st3 .bar i.on{background:var(--accent)}
.st3 .pt{font-size:15px;font-weight:650;color:var(--ink3);margin-left:auto}
.st3 h3{font-size:25px;font-weight:700;letter-spacing:-.025em;margin:16px 14px 0}
.st3 p{font-size:18px;color:var(--ink2);margin:8px 14px 0;line-height:1.45}
.allsteps{display:flex;justify-content:center;margin-top:32px}
.allsteps span{display:inline-flex;align-items:center;gap:10px;font-size:18px;color:var(--ink2);background:#fff;padding:12px 20px;border-radius:999px;box-shadow:var(--shadow)}
.allsteps svg.i{color:var(--accent)}
/* gallery */
.gal{display:grid;grid-template-columns:repeat(6,1fr);gap:18px;margin-top:56px}
.gc{background:var(--bg);border-radius:24px;padding:10px 10px 16px}
.gc b{display:block;font-size:17px;font-weight:650;margin:14px 6px 0;letter-spacing:-.01em;line-height:1.25}
.gc small{display:block;font-size:15px;color:var(--ink3);margin:4px 6px 0}
.gnote{text-align:center;font-size:16px;color:var(--ink3);margin-top:22px}
.plat{display:flex;justify-content:center;gap:10px;margin-top:26px}
.plat span{display:inline-flex;align-items:center;gap:8px;font-size:16px;font-weight:600;color:var(--ink2);background:var(--bg);padding:8px 16px 8px 10px;border-radius:999px}
/* audience */
.aud{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:56px}
.au{background:#fff;border-radius:26px;box-shadow:var(--shadow);padding:30px 28px 32px}
.au .ai{width:60px;height:60px;border-radius:18px;background:var(--tint);color:var(--accent);display:grid;place-items:center}
.au .ai svg.i{width:30px;height:30px}
.au h3{font-size:23px;font-weight:700;margin-top:20px;letter-spacing:-.02em}
.au p{font-size:18px;color:var(--ink2);margin-top:8px;line-height:1.45}
.au.mom{background:linear-gradient(160deg,#FFFFFF 0%,#F6F5FF 100%);box-shadow:0 0 0 1.5px #E4E0FF,var(--shadow)}
.au.mom .ai{background:#FFE9EE;color:#FF375F}
.tstrip{display:flex;justify-content:center;gap:36px;margin-top:40px;font-size:18px;font-weight:600;color:var(--ink2)}
.tstrip span{display:flex;align-items:center;gap:10px}
.tstrip svg.i{color:var(--accent)}
/* pricing */
.tog{display:inline-flex;background:#EBEBF0;border-radius:18px;padding:5px;margin-top:32px;gap:4px}
.tog span{height:54px;padding:0 26px;display:flex;align-items:center;gap:10px;border-radius:14px;font-size:19px;font-weight:600;color:var(--ink2)}
.tog span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.tog .pill{font-size:13px;font-style:normal}
.pc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.12fr) minmax(0,1fr);gap:22px;margin-top:48px;align-items:stretch}
.pk{background:var(--bg);border-radius:28px;padding:34px 30px 30px;display:flex;flex-direction:column;position:relative}
.pk.hi{background:#fff;box-shadow:0 0 0 3px var(--accent),var(--shadow-lg);margin-top:-14px;margin-bottom:-14px;padding-top:48px}
.pk .tagx{position:absolute;top:-17px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:7px 16px;border-radius:999px;white-space:nowrap}
.pk h3{font-size:26px;font-weight:700;letter-spacing:-.02em}
.pk .d{font-size:18px;color:var(--ink2);margin-top:4px}
.pk .pb{min-height:226px;margin-top:22px}
.pk .pr{font-size:52px;font-weight:750;letter-spacing:-.045em;line-height:1;white-space:nowrap}
.pk .pr span{font-size:21px;font-weight:600;color:var(--ink2);letter-spacing:-.01em}
.pk .pe{font-size:17px;color:var(--ink2);margin-top:10px}
.pk .pn{font-size:18px;color:var(--ink);font-weight:650;margin-top:6px}
.pk .pill{margin-top:12px}
.pk .alt{font-size:16px;color:var(--ink2);margin-top:10px}
.pk .btn{width:100%}
.pk .bn{font-size:15.5px;color:var(--ink2);text-align:center;margin-top:12px;min-height:22px}
.pk ul{list-style:none;margin-top:24px;padding-top:22px;border-top:1px solid #E1E1E8;display:flex;flex-direction:column;gap:13px}
.pk.hi ul{border-top-color:var(--line)}
.pk li{display:flex;gap:12px;font-size:17.5px;line-height:1.38}
.pk li .ck{width:26px;height:26px;border-radius:50%;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.pk li .ck svg{width:15px;height:15px;stroke-width:3}
.pk li.no{color:var(--ink3)} .pk li.no .ck{background:#E9E9EE;color:#A8A8B0}
.pk .m{display:none}
body.mensual .pk .y{display:none} body.mensual .pk .m{display:block}
.pk .btn.m{display:none} body.mensual .pk .btn.m{display:flex} body.mensual .pk .btn.y{display:none}
body.mensual .pk .bn span.m{display:inline}
.pk .bn{min-height:96px;line-height:1.45} .pk .pb .pill{display:inline-flex;margin-top:12px}
.pnote{text-align:center;font-size:17px;color:var(--ink2);margin-top:40px}
.pnote a{display:inline-block;margin-top:12px}
/* faq */
.faq{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;margin-top:52px;align-items:start}
.fcol{display:flex;flex-direction:column;gap:14px}
.fq{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:22px 26px}
.fq .q{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:650;letter-spacing:-.015em}
.fq .q .cv{margin-left:auto;width:36px;height:36px;border-radius:50%;background:var(--bg);display:grid;place-items:center;color:var(--ink2);flex:none}
.fq .q .cv svg{width:20px;height:20px}
.fq.open .q .cv{background:var(--tint);color:var(--accent)} .fq.open .q .cv svg{transform:rotate(180deg)}
.fq .a{font-size:18px;color:var(--ink2);margin-top:12px;line-height:1.5;padding-right:40px}
/* partner */
.idea{display:flex;align-items:center;gap:24px;padding:28px 32px;border-radius:26px;background:#fff;box-shadow:inset 0 0 0 1.5px #E4E0FF}
.idea .bi{width:60px;height:60px;border-radius:18px;background:#FFF4D6;color:#B07800;display:grid;place-items:center;flex:none}
.idea .bi svg.i{width:30px;height:30px}
.idea .label{color:#B07800}
.idea h3{font-size:24px;font-weight:700;letter-spacing:-.02em;margin-top:4px}
.idea p{font-size:18px;color:var(--ink2);margin-top:4px}
.idea .btn{margin-left:auto;height:56px;font-size:18px}
/* final */
.final{border-radius:36px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;text-align:center;padding:76px 40px 70px;position:relative;overflow:hidden;box-shadow:0 24px 60px rgba(91,75,255,.30)}
.final::before{content:"";position:absolute;left:-120px;bottom:-160px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.08)}
.final::after{content:"";position:absolute;right:-90px;top:-130px;width:400px;height:400px;border-radius:50%;background:rgba(255,255,255,.10)}
.final h2{font-size:54px;font-weight:750;letter-spacing:-.045em;line-height:1.05;color:#fff;position:relative;z-index:1}
.final p{font-size:21px;opacity:.92;margin-top:16px;position:relative;z-index:1}
.final .btn{margin-top:34px;height:72px;font-size:22px;padding:0 44px;background:#fff;color:var(--accent);border-radius:18px;position:relative;z-index:1;box-shadow:0 10px 30px rgba(20,10,80,.25)}
.final small{display:block;font-size:17px;opacity:.88;margin-top:16px;position:relative;z-index:1}
/* footer */
.foot{background:#fff;border-top:1px solid var(--line);margin-top:104px;padding:56px 0 36px}
.foot .fr{display:flex;align-items:flex-start;gap:56px}
.foot .fc h5{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:16px}
.foot .fc a{display:block;font-size:17px;color:var(--ink);margin-bottom:12px}
.foot .logo{padding:0}
.foot .lead{max-width:320px;font-size:17px;color:var(--ink2);margin-top:16px;line-height:1.5}
.foot .disc2{margin-top:40px;padding:18px 22px;border-radius:18px;background:var(--bg);font-size:15.5px;color:var(--ink2);line-height:1.5;display:flex;gap:12px}
.foot .disc2 svg.i{color:var(--ink3);width:20px;height:20px;margin-top:1px}
.foot .fb{display:flex;justify-content:space-between;align-items:center;margin-top:28px;padding-top:24px;border-top:1px solid var(--line);font-size:15.5px;color:var(--ink3)}
.foot .fb .r{display:flex;gap:24px;align-items:center}
.foot .fb a{color:var(--ink2);font-weight:550}
'''

def pricing_cards(mobile=False):
    # Precios: ver PRICING-CARDS-SPEC.md (fuente única). Diseño final de tarjetas: mockups 80-85; esto es la versión del landing.
    gratis = f'''<div class="pk g"><h3>Gratis</h3><div class="d">Para conocer Chalyb</div>
<div class="pb"><div class="pr">$0</div><div class="pn">Sin tarjeta · Para siempre</div></div>
<button class="btn btn-secondary">Crear cuenta gratis</button><div class="bn">&nbsp;</div>{lis2(GRATIS_LI)}</div>'''
    pro = f'''<div class="pk hi"><div class="tagx">{BADGE_PRO}</div><h3>Pro</h3><div class="d">Todas las herramientas</div>
<div class="pb"><div class="y"><div class="pr">{P_PRO_Y}<span> MXN al año</span></div><div class="pn">Se renueva cada año</div>
<div class="alt">o paga mes a mes: {P_PRO_M} MXN al mes (plan mensual)</div><span class="pill acc">Ahorras {P_SAVE_PRO} al año · {P_PCT_PRO}%</span></div>
<div class="m"><div class="pr">{P_PRO_M}<span> MXN al mes</span></div><div class="pn">Se renueva cada mes</div><div class="alt">Precio de lanzamiento: {P_PRO_M} MXN al mes</div></div></div>
<button class="btn btn-primary btn-xl">{TRIAL_CTA}</button><div class="bn"><span class="y"><b>Hoy pagas $0.</b> El {FIN_CORTO} se cobran {P_PRO_Y} MXN por el año completo y se renueva cada año, automáticamente. Cancela cuando quieras.</span><span class="m"><b>Hoy pagas $0.</b> El {FIN_CORTO} se cobran {P_PRO_M} MXN y después cada mes, automáticamente. Cancela cuando quieras.</span></div>{lis2(PRO_LI)}</div>'''
    vip = f'''<div class="pk v"><h3>VIP</h3><div class="d">Para quien lo usa todos los días</div>
<div class="pb"><div class="y"><div class="pr">{P_VIP_Y}<span> MXN al año</span></div><div class="pn">Se renueva cada año</div>
<div class="alt">o paga mes a mes: {P_VIP_M} MXN al mes (plan mensual)</div><div class="alt"><b>Ahorras {P_SAVE_VIP} al año · {P_PCT_VIP}%</b></div></div>
<div class="m"><div class="pr">{P_VIP_M}<span> MXN al mes</span></div><div class="pn">Se renueva cada mes</div><div class="alt"><a class="lnk" style="color:var(--ink2)">Cambia a Anual y ahorra {P_SAVE_VIP} al año</a></div></div></div>
<button class="btn btn-secondary y">Elegir VIP anual</button><button class="btn btn-secondary m">Elegir VIP mensual</button><div class="bn">Se cobra hoy. Sin prueba gratis. Cancela en 1 clic.</div>{lis2(VIP_LI)}</div>'''
    return (pro + gratis + vip) if mobile else (gratis + pro + vip)

TOGGLE = f'<div class="tog"><span class="tm">Mensual</span><span class="ty on">Anual <i class="pill acc">Ahorra hasta {P_PCT_MAX}%</i></span></div>'

def bento():
    def ti(n, size=60, r=18, isz=30):
        i,c,_ = LTOOLS[n]; return toolicon(i,c,size,r,isz)
    clips_vis = (thumb(0,140,249,dur="0:42",cap="¡NO LO PUEDO <em>CREER</em>!",radius=20,playsize=44).replace('class="thumb" style="','class="thumb" style="left:6px;top:30px;transform:rotate(-7deg);')
               + thumb(3,140,249,dur="0:51",cap="¿QUÉ ME <em>RECOMIENDAN</em>?",radius=20,playsize=44).replace('class="thumb" style="','class="thumb" style="left:124px;top:14px;z-index:2;')
               + thumb(1,140,249,dur="0:28",cap="ESTO FUE <em>ÉPICO</em>",radius=20,playsize=44).replace('class="thumb" style="','class="thumb" style="left:240px;top:32px;transform:rotate(7deg);'))
    o = f'''<div class="tb clips"><div class="tx">{ti("Clips")}<h3>Clips</h3><p>{LTOOLS["Clips"][2]}</p><div class="tf">{INC}</div></div><div class="vis">{clips_vis}</div></div>
<div class="tb">{ti("Señales")}<h3>Señales</h3><p>{LTOOLS["Señales"][2]}</p><div class="tf">{disc(DISC_FIN)}{INC}</div></div>
<div class="tb"><div class="icons2">{ti("En vivo")}{ti("Asistente")}</div><h3>En vivo + Asistente</h3><p>Maneja tu transmisión con botones grandes. Y un Asistente que contesta a tus clientes y seguidores, de día y de noche.</p><div class="tf">{INC}</div></div>
<div class="tb">{ti("Pronósticos")}<h3>Pronósticos</h3><p>{LTOOLS["Pronósticos"][2]}</p><div class="tf">{disc(DISC_BET)}{INC}</div></div>
<div class="tb">{ti("Inmuebles")}<h3>Inmuebles</h3><p>{LTOOLS["Inmuebles"][2]}</p><div class="tf">{INC}</div></div>
<div class="tb">{ti("Inversiones")}<h3>Inversiones</h3><p>{LTOOLS["Inversiones"][2]}</p><div class="tf">{disc(DISC_FIN)}{INC}</div></div>
<div class="tb beat"><h3>Fuiste por una cosa y te llevaste todo.</h3><p>Entras por los clips y te quedas con las señales, tu transmisión, tu Asistente y más. Todo en el mismo plan, sin pagar extra.</p>
<div class="row7">{"".join(toolicon(i,c,46,14,23) for n,(i,c,_) in LTOOLS.items())}<button class="btn">{TRIAL_CTA}</button></div></div>'''
    return o

def steps_html():
    o = ""
    for k,(t,d,(img,x,y,w,h)) in enumerate(STEPS):
        bars = "".join(f'<i class="{"on" if j<=k else ""}"></i>' for j in range(3))
        o += f'''<div class="st3"><div class="scrw">{shot(img,x,y,w,h,340,radius=0)}</div>
<div class="meta"><div class="n">{k+1}</div><div class="bar">{bars}</div><span class="pt">Paso {k+1} de 3</span></div><h3>{t}</h3><p>{d}</p></div>'''
    return o

def faq_html(items, opens=(0,5)):
    cols = [items[:4], items[4:]]
    out = ""
    for ci,col in enumerate(cols):
        c = ""
        for k,(q,a) in enumerate(col):
            idx = ci*4+k; op = idx in opens
            c += f'<div class="fq{" open" if op else ""}"><div class="q">{q}<span class="cv">{ic("chevd")}</span></div>{f"<div class=a>{a}</div>" if op else ""}</div>'
        out += f'<div class="fcol">{c}</div>'
    return out

def footer40():
    return f'''<footer class="foot"><div class="sec"><div class="fr">
<div style="flex:1">{logo()}<p class="lead">Herramientas que trabajan por ti, en español y sin saber de tecnología.</p></div>
<div class="fc"><h5>Herramientas</h5><a>Clips</a><a>Señales</a><a>En vivo</a><a>Ver todas</a></div>
<div class="fc"><h5>Chalyb</h5><a>Precios</a><a>Ayuda</a><a>Proponer una idea</a><a>Iniciar sesión</a></div>
<div class="fc"><h5>Legal</h5><a>Términos y Condiciones</a><a>Términos de Suscripción</a><a>Aviso de Privacidad</a><a>Uso aceptable</a><a>Quién vende</a></div>
<div class="fc"><h5>Contacto</h5><a>Escríbenos</a></div></div>
<div class="disc2">{ic("info")}<span>Señales, Pronósticos e Inversiones son informativos: no son asesoría financiera ni de apuestas, y no garantizan resultados. Las decisiones y los riesgos son tuyos.</span></div>
<div class="fb"><span>© 2026 Chalyb. Precios en pesos mexicanos (MXN), IVA incluido.</span><span class="r"><span>Pago seguro con Mercado Pago</span><a>Cookies</a><a>Español · English</a></span></div></div></footer>'''

YT_SM = YT.replace('width="34" height="24"','width="28" height="20"')
gal_html = "".join(f'<div class="gc">{thumb(k,156,277,dur=d,cap=c,radius=16,playsize=44)}<b>{t}</b><small>Vertical · con subtítulos</small></div>' for k,(t,d,c) in enumerate(CLIPS))
PLAT = f'<div class="plat"><span>{TT}TikTok</span><span><svg viewBox="0 0 24 24" width="26" height="26"><defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FEDA75"/><stop offset=".4" stop-color="#FA7E1E"/><stop offset=".7" stop-color="#D62976"/><stop offset="1" stop-color="#962FBF"/></linearGradient></defs><rect width="24" height="24" rx="7" fill="url(#ig)"/><rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.1" cy="7.9" r=".9" fill="#fff"/></svg>Reels</span><span>{YT_SM}Shorts</span></div>'

b40 = f'''<div class="pg"><header class="ln">{logo()}<nav class="links">{"".join(f"<a>{t}</a>" for t in NAV_LINKS)}</nav>
<div class="r"><a class="si">Iniciar sesión</a><button class="btn btn-primary">Prueba gratis</button></div></header>
<section class="sec hsec"><div class="hero"><div>
<div class="kick"><span>Todo incluido</span>Un plan, todas las herramientas</div>
<h1>Tú duermes.<br><em>Tus bots trabajan.</em></h1>
<p class="sub">Clips para tus redes, señales de cripto, tu transmisión y mucho más, en un solo plan.</p>
<div class="cta"><button class="btn btn-primary">{TRIAL_CTA}{ic("arrow")}</button><div class="note"><b>Cancela cuando quieras.</b> Hoy pagas $0.</div></div>
<div class="trust"><span>{ic("check")}En español</span><span>{ic("check")}Sin saber de tecnología</span><span>{ic("check")}Cancela en 1 clic</span></div></div>
<div class="comp"><div class="glow"></div>
<div style="position:absolute;left:8px;top:96px">{laptop(560)}</div>
<div style="position:absolute;right:6px;top:120px">{phone(200)}</div>
{notif().replace('class="notif"','class="notif" style="left:-36px;top:24px"')}</div></div></section>
<section class="band white" id="herramientas"><div class="sec"><div class="shd"><div class="label">Herramientas</div><h2>Todo en un solo plan</h2><p>Cada herramienta hace una cosa y la hace por ti. Todas vienen incluidas en Pro.</p></div>
<div class="bento">{bento()}</div></div></section>
<section class="band" id="como"><div class="sec"><div class="shd"><div class="label">Cómo funciona</div><h2>Así de fácil: 3 pasos</h2><p>Tal como lo ves en el app. Así se hacen tus clips:</p></div>
<div class="steps3">{steps_html()}</div>
<div class="allsteps"><span>{ic("grid")}Todas las herramientas funcionan igual: 3 pasos, botones grandes y palabras simples.</span></div></div></section>
<section class="band white"><div class="sec"><div class="shd"><div class="label">Clips</div><h2>Así se ven tus clips</h2><p>Verticales, con subtítulos y listos para publicar. Tú solo pegas el enlace.</p></div>
<div class="gal">{gal_html}</div>{PLAT}<div class="gnote">Imágenes de ejemplo.</div></div></section>
<section class="band"><div class="sec"><div class="shd"><div class="label">Para quién</div><h2>Para ti, y para tu mamá también</h2><p>Si no tienes tiempo de editar, contestar o estar pendiente, Chalyb lo hace por ti.</p></div>
<div class="aud">{"".join(f'<div class="au{" mom" if k==3 else ""}"><div class="ai">{ic(i)}</div><h3>{t}</h3><p>{d}</p></div>' for k,(i,t,d) in enumerate(AUD))}</div>
<div class="tstrip"><span>{ic("globe")}En español, para México y Latinoamérica</span><span>{ic("shield")}Pago seguro con Mercado Pago</span><span>{ic("check")}Cancela en 1 clic, sin llamadas</span></div></div></section>
<section class="band white" id="precios"><div class="sec"><div class="shd"><div class="label">Precios</div><h2>Empieza gratis, crece con Pro</h2><p>Prueba Pro gratis 7 días. Cancela en 1 clic, sin llamadas.</p>{TOGGLE}</div>
<div class="pc">{pricing_cards()}</div>
<div class="pnote">Precios en MXN, IVA incluido. Pago seguro con Mercado Pago.<br><span style="font-size:15px">{TRIAL_FOOT}</span><br><a class="lnk">Ver todos los planes y qué incluyen</a></div></div></section>
<section class="band" id="preguntas" style="padding-bottom:64px"><div class="sec"><div class="shd"><div class="label">Preguntas</div><h2>Preguntas frecuentes</h2></div><div class="faq">{faq_html(LFAQ)}</div></div></section>
<section class="sec" id="idea"><div class="idea"><div class="bi">{ic("bulb")}</div><div><div class="label">Socios</div><h3>Tienes la idea, nosotros la construimos</h3><p>Cuéntanos qué herramienta te haría la vida más fácil. La revisamos y te respondemos.</p></div><button class="btn btn-secondary">Proponer mi idea</button></div></section>
<section class="sec" style="margin-top:88px"><div class="final"><h2>Empieza hoy.<br>Mañana ya trabajan por ti.</h2><p>Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones. Todo en un solo plan.</p>
<button class="btn">{TRIAL_CTA}</button><small>Hoy pagas $0. Cancela cuando quieras.</small></div></section>
{footer40()}</div>'''
write("40-landing.html", page2("Chalyb: bots que trabajan por ti mientras duermes", b40, css40))

# ===================== 41 LANDING MÓVIL =====================
css41 = css40 + '''
.pg{width:390px}
.status{height:50px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 34px;font-size:17px;font-weight:600}
.status .r{display:flex;gap:6px;align-items:center}
.mn{display:flex;align-items:center;justify-content:space-between;padding:4px 16px 10px 20px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.82)}
.mn .logo{padding:0;gap:9px}.mn .logo .mark{width:34px;height:34px;border-radius:10px}.mn .logo .mark svg{width:19px;height:19px}.mn .logo .word{font-size:21px}
.mn .r{display:flex;gap:6px;align-items:center}
.mn .si{font-size:17px;font-weight:600;padding:0 10px;height:48px;display:flex;align-items:center}
.mn .bur{width:48px;height:48px;border-radius:50%;background:var(--bg);display:grid;place-items:center}
.mh{padding:26px 20px 0}
.mkick{display:inline-block;background:var(--tint);color:var(--accent);border-radius:999px;padding:7px 14px;font-size:14.5px;font-weight:700}
.mh h1{font-size:46px;line-height:1.02;letter-spacing:-.048em;margin-top:18px;font-weight:750}
.mh h1 em{font-style:normal;background:linear-gradient(90deg,#5B4BFF 0%,#8B5BFF 100%);-webkit-background-clip:text;background-clip:text;color:transparent;padding-right:3px}
.mh .sub{font-size:19px;margin-top:14px}
.mh .btn{margin-top:24px;height:66px;font-size:20px;width:100%;border-radius:18px}
.mh .note{text-align:center;font-size:16.5px;color:var(--ink2);margin-top:12px}
.mh .note b{color:var(--ink);font-weight:650}
.mtrust{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;margin-top:16px;font-size:14px;color:var(--ink2);font-weight:600}
.mtrust span{display:flex;align-items:center;gap:5px;white-space:nowrap}
.mtrust svg.i{width:15px;height:15px;color:var(--accent);stroke-width:3}
.mcomp{position:relative;height:362px;margin:30px 0 0}
.mcomp .glow{position:absolute;left:20px;top:30px;width:350px;height:280px;border-radius:50%;background:radial-gradient(closest-side,rgba(123,108,255,.26),rgba(123,108,255,0))}
.mcomp .laptop .lid{border-radius:14px 14px 6px 6px;padding:8px 7px 9px}
.mcomp .laptop .base{height:11px;margin:0 -26px;border-radius:2px 2px 12px 12px}
.mcomp .laptop .base i{width:70px;margin-left:-35px;height:5px}
.mcomp .phonef{border-radius:28px;padding:5px}
.mcomp .phonef .scr{border-radius:23px}
.mcomp .phonef .isl{top:11px;width:40px;height:12px;margin-left:-20px}
.mcomp .notif{width:262px;padding:10px 12px;border-radius:18px;gap:10px}
.mcomp .notif .na{width:32px;height:32px;border-radius:9px}.mcomp .notif .na svg{width:18px;height:18px}
.mcomp .notif .nb{font-size:14px}.mcomp .notif .nh{font-size:12.5px}.mcomp .notif .nh b{font-size:11.5px}
.ms{padding:72px 16px 0}
.ms.white{background:#fff;padding-bottom:56px;margin-top:56px;padding-top:56px}
.ms .hd{padding:0 6px;text-align:left}
.ms .label{margin-bottom:10px}
.ms h2{font-size:34px;font-weight:750;letter-spacing:-.04em;line-height:1.08}
.ms .p{font-size:18px;color:var(--ink2);margin-top:10px;line-height:1.45}
.mlist{display:flex;flex-direction:column;gap:12px;margin-top:26px}
.mtc{background:var(--bg);border-radius:24px;padding:20px}
.mtc .top{display:flex;align-items:center;gap:14px}
.mtc .top b{font-size:21px;font-weight:700;letter-spacing:-.02em}
.mtc p{font-size:17px;color:var(--ink2);margin-top:10px;line-height:1.42}
.mtc .tf{margin-top:14px;display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.mtc .icons2 .tico + .tico{box-shadow:0 0 0 3px var(--bg)}
.mtc.clips .tv{display:flex;gap:10px;margin-top:16px}
.mbeat{border-radius:24px;padding:26px 22px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;position:relative;overflow:hidden}
.mbeat::after{content:"";position:absolute;right:-70px;top:-90px;width:230px;height:230px;border-radius:50%;background:rgba(255,255,255,.10)}
.mbeat h3{font-size:27px;line-height:1.12;letter-spacing:-.03em;color:#fff}
.mbeat p{font-size:17px;opacity:.92;margin-top:10px}
.mbeat .r7{display:flex;gap:7px;margin-top:18px;flex-wrap:wrap}
.mbeat .btn{width:100%;margin-top:20px;background:#fff;color:var(--accent);height:60px;font-size:19px;box-shadow:none;position:relative;z-index:1}
.mst{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:12px 12px 20px}
.mst .scrw{background:var(--bg);border-radius:16px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--line)}
.mst .meta{display:flex;align-items:center;gap:10px;margin:18px 8px 0}
.mst .n{width:38px;height:38px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:18px;display:grid;place-items:center;flex:none}
.mst .bar{display:flex;gap:5px}.mst .bar i{display:block;width:26px;height:6px;border-radius:3px;background:#DCDCE3}.mst .bar i.on{background:var(--accent)}
.mst .pt{font-size:14px;font-weight:650;color:var(--ink3);margin-left:auto}
.mst h3{font-size:21px;font-weight:700;letter-spacing:-.02em;margin:12px 8px 0}
.mst p{font-size:16.5px;color:var(--ink2);margin:6px 8px 0;line-height:1.42}
.mgal{display:flex;gap:12px;margin-top:24px;padding:0 6px 4px}
.mgal .gc{flex:none;width:156px;background:var(--bg);border-radius:20px;padding:8px 8px 14px}
.mgal .gc b{font-size:15.5px;margin:12px 4px 0}.mgal .gc small{font-size:13.5px;margin:3px 4px 0}
.maud{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:24px}
.maud .au{padding:20px 18px 22px;border-radius:22px}
.maud .au .ai{width:48px;height:48px;border-radius:14px}.maud .au .ai svg.i{width:25px;height:25px}
.maud .au h3{font-size:19px;margin-top:14px}.maud .au p{font-size:15.5px;margin-top:6px;line-height:1.4}
.mts{margin-top:20px;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:6px 18px}
.mts div{display:flex;align-items:center;gap:12px;padding:13px 0;font-size:16.5px;font-weight:600;color:var(--ink2)}
.mts div + div{border-top:1px solid var(--line)}
.mts svg.i{color:var(--accent);width:22px;height:22px}
.mtog{display:flex;background:#EBEBF0;border-radius:16px;padding:4px;margin-top:22px;gap:4px}
.mtog span{flex:1;height:52px;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:13px;font-size:18px;font-weight:600;color:var(--ink2)}
.mtog span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.mtog .pill{font-size:12px;font-style:normal;padding:3px 8px;white-space:nowrap}
.mtog span:last-child{flex:1.8}
.mpc{display:flex;flex-direction:column;gap:16px;margin-top:30px}
.mpc .pk{padding:28px 22px 24px;border-radius:26px}
.mpc .pk.hi{margin:0;padding-top:34px}
.mpc .pk .tagx{left:22px;transform:none}
.mpc .pk .pb{min-height:0;margin-top:16px}
.mpc .pk .pr{font-size:46px}
.mpc .pk .pr span{font-size:19px}
.mpc .pk .btn{margin-top:20px}
.mpc .pk .bn{min-height:0}
.mpc .pk .bn:empty,.mpc .pk .bn.e{display:none}
.mpc .pk ul{margin-top:18px;padding-top:18px;gap:11px}
.mpc .pk li{font-size:16.5px}
.mpnote{text-align:center;font-size:15.5px;color:var(--ink2);margin-top:24px;line-height:1.5}
.mpnote a{display:inline-block;margin-top:10px;font-size:17px}
.mfq{margin-top:24px;background:#fff;border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.mfq .q{display:flex;align-items:center;gap:12px;padding:18px 18px;font-size:18px;font-weight:650;border-top:1px solid var(--line);min-height:64px;letter-spacing:-.01em}
.mfq .q:first-child{border-top:0}
.mfq .q .cv{margin-left:auto;width:32px;height:32px;border-radius:50%;background:var(--bg);display:grid;place-items:center;color:var(--ink2);flex:none}
.mfq .q .cv svg{width:18px;height:18px}
.mfq .q.open .cv{background:var(--tint);color:var(--accent)} .mfq .q.open .cv svg{transform:rotate(180deg)}
.mfq .a{padding:0 18px 20px;font-size:16.5px;color:var(--ink2);margin-top:-6px;line-height:1.5}
.midea{margin:40px 16px 0;padding:22px 20px;border-radius:24px;background:#fff;box-shadow:inset 0 0 0 1.5px #E4E0FF}
.midea .top{display:flex;gap:14px;align-items:center}
.midea .bi{width:50px;height:50px;border-radius:15px;background:#FFF4D6;color:#B07800;display:grid;place-items:center;flex:none}
.midea .label{color:#B07800;font-size:13px}
.midea h3{font-size:20px;line-height:1.2;letter-spacing:-.02em;margin-top:2px}
.midea p{font-size:16.5px;color:var(--ink2);margin-top:12px;line-height:1.45}
.midea .btn{width:100%;margin-top:16px;height:56px;font-size:18px}
.mfin{margin:56px 16px 0;border-radius:30px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;padding:40px 22px 34px;text-align:center;position:relative;overflow:hidden}
.mfin::after{content:"";position:absolute;right:-70px;top:-90px;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,.10)}
.mfin h2{font-size:34px;letter-spacing:-.04em;line-height:1.08;color:#fff;position:relative;z-index:1}
.mfin p{font-size:17px;opacity:.92;margin-top:12px;position:relative;z-index:1}
.mfin .btn{width:100%;margin-top:24px;height:64px;background:#fff;color:var(--accent);font-size:19px;border-radius:17px;position:relative;z-index:1}
.mfin small{display:block;font-size:15px;opacity:.88;margin-top:12px}
.mfoot{margin-top:56px;background:#fff;border-top:1px solid var(--line);padding:34px 22px 44px}
.mfoot .logo{padding:0}
.mfoot .lead{font-size:16.5px;color:var(--ink2);margin-top:12px;line-height:1.5}
.mfoot .cols{display:grid;grid-template-columns:1fr 1fr;gap:26px 14px;margin-top:28px}
.mfoot h5{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:10px}
.mfoot .cols a{display:block;font-size:16.5px;color:var(--ink);padding:6px 0}
.mfoot .disc2{margin-top:26px;padding:16px;border-radius:16px;background:var(--bg);font-size:14.5px;color:var(--ink2);line-height:1.5}
.mfoot .cp{font-size:14.5px;color:var(--ink3);margin-top:22px;line-height:1.6}
.mfoot .cp a{color:var(--ink2);font-weight:600}
.sticky{display:none}
body.sticky-demo .sticky{display:block;position:fixed;left:0;right:0;bottom:0;z-index:20;padding:12px 16px 26px;background:rgba(255,255,255,.97);backdrop-filter:saturate(180%) blur(20px);border-top:1px solid var(--line);box-shadow:0 -8px 24px rgba(16,16,40,.06)}
.sticky .btn{width:100%;height:60px;font-size:19px;border-radius:16px}
.sticky small{display:block;text-align:center;font-size:14px;color:var(--ink2);margin-top:7px}
'''
def mtool(n, extra_foot="", icons=None, title=None, text=None):
    i,c,d = LTOOLS[n]
    icn = icons or toolicon(i,c,48,14,24)
    return f'<div class="mtc"><div class="top">{icn}<b>{title or n}</b></div><p>{text or d}</p><div class="tf">{extra_foot}{INC}</div></div>'
m_clips = f'''<div class="mtc clips"><div class="top">{toolicon("scissors","#5B4BFF",48,14,24)}<b>Clips</b></div><p>{LTOOLS["Clips"][2]}</p>
<div class="tv">{"".join(thumb(k,98,174,cap="",radius=14,playsize=34) for k in (0,3,1))}</div><div class="tf">{INC}</div></div>'''
m_tools = (m_clips + mtool("Señales", disc(DISC_FIN))
  + mtool("En vivo", icons=f'<div class="icons2">{toolicon("live","#FF375F",48,14,24)}{toolicon("bot","#30B0C7",48,14,24)}</div>', title="En vivo + Asistente",
          text="Maneja tu transmisión con botones grandes. Y un Asistente que contesta a tus clientes y seguidores, de día y de noche.")
  + mtool("Pronósticos", disc(DISC_BET)) + mtool("Inmuebles") + mtool("Inversiones", disc(DISC_FIN))
  + f'''<div class="mbeat"><h3>Fuiste por una cosa y te llevaste todo.</h3><p>Entras por los clips y te quedas con todo lo demás. Mismo plan, sin pagar extra.</p>
<div class="r7">{"".join(toolicon(i,c,38,12,19) for n,(i,c,_) in LTOOLS.items())}</div><button class="btn">{TRIAL_CTA}</button></div>''')
m_steps = ""
for k,(t,d,(img,x,y,w,h)) in enumerate(STEPS):
    bars = "".join(f'<i class="{"on" if j<=k else ""}"></i>' for j in range(3))
    m_steps += f'''<div class="mst"><div class="scrw">{shot(img,x,y,w,h,334,radius=0)}</div><div class="meta"><div class="n">{k+1}</div><div class="bar">{bars}</div><span class="pt">Paso {k+1} de 3</span></div><h3>{t}</h3><p>{d}</p></div>'''
m_faq = ""
for k,(q,a) in enumerate(LFAQ):
    op = k==0
    m_faq += f'<div class="q{" open" if op else ""}">{q}<span class="cv">{ic("chevd")}</span></div>' + (f'<div class="a">{a}</div>' if op else "")
b41 = f'''<div class="pg">{statusbar()}<div class="mn">{logo()}<div class="r"><a class="si">Iniciar sesión</a><div class="bur">{ic("menu")}</div></div></div>
<div class="mh"><div class="mkick">Un plan, todas las herramientas</div>
<h1>Tú duermes.<br><em>Tus bots trabajan.</em></h1>
<p class="sub">Clips para tus redes, señales de cripto, tu transmisión y mucho más, en un solo plan.</p>
<button class="btn btn-primary">{TRIAL_CTA}{ic("arrow")}</button><div class="note"><b>Cancela cuando quieras.</b> Hoy pagas $0.</div>
<div class="mtrust"><span>{ic("check")}En español</span><span>{ic("check")}Sin saber de tecnología</span><span>{ic("check")}Cancela en 1 clic</span></div></div>
<div class="mcomp"><div class="glow"></div><div style="position:absolute;left:30px;top:96px">{laptop(272)}</div>
<div style="position:absolute;right:14px;top:116px">{phone(108)}</div>
{notif().replace('class="notif"','class="notif" style="left:16px;top:0"')}</div>
<section class="ms white" id="herramientas" style="margin-top:28px"><div class="hd"><div class="label">Herramientas</div><h2>Todo en un solo plan</h2><p class="p">Cada herramienta hace una cosa y la hace por ti. Todas vienen incluidas en Pro.</p></div><div class="mlist">{m_tools}</div></section>
<section class="ms" id="como" style="padding-top:16px"><div class="hd"><div class="label">Cómo funciona</div><h2>Así de fácil: 3 pasos</h2><p class="p">Tal como lo ves en el app. Así se hacen tus clips:</p></div><div class="mlist">{m_steps}</div></section>
<section class="ms white"><div class="hd"><div class="label">Clips</div><h2>Así se ven tus clips</h2><p class="p">Verticales, con subtítulos y listos para publicar.</p></div>
<div class="mgal">{"".join(f'<div class="gc">{thumb(k,140,249,dur=d,cap=c,radius=14,playsize=40)}<b>{t}</b><small>Vertical · con subtítulos</small></div>' for k,(t,d,c) in enumerate(CLIPS[:3]))}</div><div class="gnote" style="font-size:14.5px;margin-top:16px">Imágenes de ejemplo.</div></section>
<section class="ms" style="padding-top:16px"><div class="hd"><div class="label">Para quién</div><h2>Para ti, y para tu mamá también</h2><p class="p">Si no tienes tiempo de editar, contestar o estar pendiente, Chalyb lo hace por ti.</p></div>
<div class="maud">{"".join(f'<div class="au{" mom" if k==3 else ""}"><div class="ai">{ic(i)}</div><h3>{t}</h3><p>{d}</p></div>' for k,(i,t,d) in enumerate(AUD))}</div>
<div class="mts"><div>{ic("globe")}En español, para México y Latinoamérica</div><div>{ic("shield")}Pago seguro con Mercado Pago</div><div>{ic("check")}Cancela en 1 clic, sin llamadas</div></div></section>
<section class="ms white" id="precios"><div class="hd"><div class="label">Precios</div><h2>Empieza gratis, crece con Pro</h2><p class="p">Prueba Pro gratis 7 días. Cancela en 1 clic, sin llamadas.</p></div>
<div class="mtog"><span>Mensual</span><span class="on">Anual <i class="pill acc">Ahorra hasta {P_PCT_MAX}%</i></span></div>
<div class="mpc">{pricing_cards(mobile=True).replace('<div class="bn">&nbsp;</div>','')}</div>
<div class="mpnote">Precios en MXN, IVA incluido.<br>Pago seguro con Mercado Pago.<br>{TRIAL_FOOT}<br><a class="lnk">Ver todos los planes y qué incluyen</a></div></section>
<section class="ms" id="preguntas" style="padding-top:16px"><div class="hd"><div class="label">Preguntas</div><h2>Preguntas frecuentes</h2></div><div class="mfq">{m_faq}</div></section>
<div class="midea" id="idea"><div class="top"><div class="bi">{ic("bulb")}</div><div><div class="label">Socios</div><h3>Tienes la idea, nosotros la construimos</h3></div></div>
<p>Cuéntanos qué herramienta te haría la vida más fácil. La revisamos y te respondemos.</p><button class="btn btn-secondary">Proponer mi idea</button></div>
<div class="mfin"><h2>Empieza hoy.<br>Mañana ya trabajan por ti.</h2><p>Todas las herramientas en un solo plan.</p><button class="btn">{TRIAL_CTA}</button><small>Hoy pagas $0. Cancela cuando quieras.</small></div>
<footer class="mfoot">{logo()}<p class="lead">Herramientas que trabajan por ti, en español y sin saber de tecnología.</p>
<div class="cols"><div><h5>Chalyb</h5><a>Herramientas</a><a>Precios</a><a>Ayuda</a><a>Proponer una idea</a><a>Iniciar sesión</a></div>
<div><h5>Legal</h5><a>Términos y Condiciones</a><a>Términos de Suscripción</a><a>Aviso de Privacidad</a><a>Uso aceptable</a><a>Quién vende</a></div>
<div><h5>Contacto</h5><a>Escríbenos</a></div></div>
<div class="disc2">Señales, Pronósticos e Inversiones son informativos: no son asesoría financiera ni de apuestas, y no garantizan resultados.</div>
<div class="cp">© 2026 Chalyb. Precios en pesos mexicanos (MXN), IVA incluido. Pago seguro con Mercado Pago.<br><a>Cookies</a> · <a>Español · English</a></div></footer>
<div class="sticky"><button class="btn btn-primary">{TRIAL_CTA}</button><small>Hoy pagas $0. Cancela cuando quieras.</small></div></div>'''
write("41-landing-movil.html", page2("Chalyb móvil", b41, css41))
