# ===================== 10 LANDING (desktop) =====================
CHECK_SM = ic("check","i","width:18px;height:18px;stroke-width:3")
css10 = '''
body{background:var(--bg)}
.pg{width:1440px}
.sec{max-width:1200px;margin:0 auto;padding:0 20px}
.hero{display:grid;grid-template-columns:1fr 1.08fr;gap:48px;align-items:center;padding:80px 0 88px}
.hero .kick{display:inline-flex;align-items:center;gap:10px;background:#fff;border-radius:999px;padding:8px 16px 8px 8px;font-size:17px;font-weight:600;color:var(--ink2);box-shadow:var(--shadow)}
.hero .kick span{background:var(--tint);color:var(--accent);border-radius:999px;padding:4px 12px;font-size:15px;font-weight:700}
.hero h1{font-size:66px;line-height:1.04;letter-spacing:-.045em;margin-top:24px}
.hero h1 em{font-style:normal;background:linear-gradient(90deg,#5B4BFF,#9B5BFF);-webkit-background-clip:text;color:transparent}
.hero .sub{font-size:22px;max-width:560px;margin-top:22px}
.hero .cta{margin-top:36px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.hero .cta .btn-xl{width:auto;padding:0 40px;height:72px;font-size:22px}
.hero .cta small{font-size:18px;color:var(--ink2)}
.trust{display:flex;gap:22px;margin-top:30px;font-size:16px;color:var(--ink2);font-weight:550;flex-wrap:wrap}
.trust span{display:flex;align-items:center;gap:7px}
.trust svg.i{width:18px;height:18px;color:var(--accent);stroke-width:2.6}
.vis{position:relative;height:540px}
.vis .panel{position:absolute;left:150px;top:24px;right:0;z-index:2;background:#fff;border-radius:28px;box-shadow:var(--shadow-lg);padding:26px}
.vis .panel h4{font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.vis .it{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
.vis .it:last-child{border-bottom:0;padding-bottom:4px}
.vis .it b{font-size:19px;font-weight:650;display:block}
.vis .it small{font-size:16px;color:var(--ink2)}
.vis .it .tx{flex:1}
.vis .float{position:absolute;left:-6px;top:190px;transform:rotate(-6deg);z-index:1;box-shadow:0 24px 50px rgba(20,20,50,.28);border-radius:20px}
.vis .float2{position:absolute;right:-18px;bottom:30px;background:#fff;border-radius:20px;box-shadow:var(--shadow-lg);padding:16px 18px;display:flex;gap:12px;align-items:center;width:300px}
.vis .float2 b{font-size:17px;display:block}.vis .float2 small{font-size:15px;color:var(--ink2)}
.shd{text-align:center;max-width:1000px;margin:0 auto}
.shd .label{margin-bottom:12px}
.shd h2{font-size:44px;letter-spacing:-.035em;line-height:1.1;font-weight:700}
.shd p{font-size:21px;color:var(--ink2);margin-top:14px}
.band{padding:88px 0}
.band.white{background:#fff}
.tg{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:48px}
.tc{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:26px 24px 28px;min-height:248px;display:flex;flex-direction:column}
.band.white .tc{background:var(--bg);box-shadow:none}
.tc h3{font-size:24px;font-weight:700;letter-spacing:-.02em;margin-top:20px}
.tc p{font-size:18px;color:var(--ink2);margin-top:8px;line-height:1.42}
.tc .inc{margin-top:auto;padding-top:16px;font-size:15px;font-weight:700;color:var(--accent);display:flex;align-items:center;gap:6px}
.tc.idea{background:var(--tint2)!important;box-shadow:inset 0 0 0 1.5px #E4E0FF!important}
.steps3{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:48px}
.st3{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:30px}
.st3 .n{width:56px;height:56px;border-radius:50%;background:var(--accent);color:#fff;font-size:26px;font-weight:700;display:grid;place-items:center}
.st3 h3{font-size:25px;font-weight:700;margin-top:22px;letter-spacing:-.02em}
.st3 p{font-size:19px;color:var(--ink2);margin-top:8px}
.gall{display:flex;gap:18px;justify-content:center;margin-top:48px}
.gall .g{text-align:center;width:176px}
.gall .g b{display:block;font-size:17px;font-weight:650;margin-top:12px}
.aud{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:44px}
.au{border-radius:22px;background:var(--bg);padding:26px}
.au .ai{width:52px;height:52px;border-radius:16px;background:#fff;color:var(--accent);display:grid;place-items:center;box-shadow:var(--shadow)}
.au h3{font-size:22px;font-weight:700;margin-top:18px}
.au p{font-size:17px;color:var(--ink2);margin-top:6px}
.tstrip{display:flex;justify-content:center;gap:34px;margin-top:40px;font-size:18px;font-weight:600;color:var(--ink2)}
.tstrip span{display:flex;align-items:center;gap:9px}
.tstrip svg.i{color:var(--accent)}
.plans{display:grid;grid-template-columns:1fr 1.12fr 1fr;gap:22px;margin-top:48px;align-items:center}
.pl{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:30px;min-height:262px;display:flex;flex-direction:column}
.pl .btn{margin-top:auto!important}
.plans .pl:not(.hi){min-height:292px}
.pl.hi .btn{margin-top:22px!important}
.pl h3{font-size:24px;font-weight:700}
.pl .pr{font-size:46px;font-weight:750;letter-spacing:-.04em;margin-top:10px}
.pl .pr span{font-size:20px;font-weight:600;color:var(--ink2);letter-spacing:-.01em}
.pl .pn{font-size:18px;color:var(--ink2);margin-top:2px}
.pl .pn b{color:var(--ink)}
.pl .btn{width:100%;margin-top:22px}
.pl.hi{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg);padding:38px 30px;position:relative}
.pl.hi .tagx{position:absolute;top:-16px;left:30px;background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:6px 14px;border-radius:999px}
.strike{text-decoration:line-through;color:var(--ink3)}
.idea2{display:flex;align-items:center;gap:24px;padding:30px 34px;border-radius:24px;background:#fff;box-shadow:inset 0 0 0 1.5px #E4E0FF}
.idea2 .bi{width:64px;height:64px;border-radius:20px;background:#FFF4D6;color:#B07800;display:grid;place-items:center;flex:none}
.idea2 .bi svg.i{width:32px;height:32px}
.idea2 h3{font-size:26px;font-weight:700;letter-spacing:-.02em}
.idea2 p{font-size:19px;color:var(--ink2);margin-top:4px}
.idea2 .btn{margin-left:auto}
.faq{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;margin-top:44px;align-items:start}
.fq{background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:22px 24px}
.fq .q{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:650}
.fq .q svg.i{margin-left:auto;color:var(--ink3)}
.fq .a{font-size:18px;color:var(--ink2);margin-top:10px;line-height:1.5}
.final{margin:0 auto;max-width:1160px;border-radius:32px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;text-align:center;padding:64px 40px;position:relative;overflow:hidden;box-shadow:0 20px 50px rgba(91,75,255,.30)}
.final::after{content:"";position:absolute;right:-90px;top:-120px;width:380px;height:380px;border-radius:50%;background:rgba(255,255,255,.10)}
.final h2{font-size:46px;font-weight:750;letter-spacing:-.035em;color:#fff}
.final p{font-size:21px;opacity:.9;margin-top:12px}
.final .btn{margin-top:30px;height:72px;font-size:22px;padding:0 42px;background:#fff;color:var(--accent);border-radius:18px;position:relative;z-index:1}
.final small{display:block;font-size:17px;opacity:.85;margin-top:14px}
.foot{background:#fff;border-top:1px solid var(--line);margin-top:88px;padding:48px 0 40px}
.foot .fr{display:flex;align-items:flex-start;gap:60px}
.foot .fc h5{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:12px}
.foot .fc a{display:block;font-size:17px;color:var(--ink);margin-bottom:9px}
.foot .fb{display:flex;justify-content:space-between;margin-top:36px;padding-top:22px;border-top:1px solid var(--line);font-size:16px;color:var(--ink3)}
.foot .logo{padding:0}
.foot .lead{max-width:330px;font-size:17px;color:var(--ink2);margin-top:14px}
'''
def toolcards(n=7, idea=True):
    o = ""
    for name,icn,desc,col in TOOLS[:n]:
        o += f'<div class="tc">{toolicon(icn,col)}<h3>{name}</h3><p>{desc}</p><div class="inc">{CHECK_SM}Incluido en Pro</div></div>'
    if idea:
        o += f'<div class="tc idea">{toolicon("bulb","#E8A600")}<h3>Tu idea</h3><p>¿Necesitas otra herramienta? Propónla y nosotros la construimos.</p><div class="inc">Proponer una idea {ic("arrow","i","width:16px;height:16px")}</div></div>'
    return o
FAQS = [
 ("¿De verdad el primer mes es gratis?","Sí. Hoy pagas $0. Te avisamos por correo 7 días antes de que termine y puedes cancelar en 1 clic desde Mi cuenta, sin llamadas."),
 ("¿Necesito saber de tecnología?","No. Cada herramienta te guía paso a paso, con botones grandes y palabras simples. Si te atoras, te ayuda una persona por WhatsApp."),
 ("¿Qué incluye el plan Pro?","Todas las herramientas: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones, con créditos cada mes."),
 ("¿Cómo cancelo?","Entra a Mi cuenta → Mi plan → Cancelar. Es 1 clic y 1 confirmación. Sigues con Pro hasta el final de tu periodo."),
 ("¿Cómo pago?","Con tarjeta de crédito o débito, de forma segura con Mercado Pago. Chalyb no guarda el número de tu tarjeta."),
 ("¿Me dan factura?","Sí. Pide tu factura (CFDI) desde Mi cuenta → Facturas cuando quieras."),
]
def faqs(items, open_first=True):
    o = ""
    for k,(q,a) in enumerate(items):
        if k==0 and open_first:
            o += f'<div class="fq"><div class="q">{q}{ic("chevd","i","transform:rotate(180deg)")}</div><div class="a">{a}</div></div>'
        else:
            o += f'<div class="fq"><div class="q">{q}{ic("chevd")}</div></div>'
    return o
def footer():
    return f'''<footer class="foot"><div class="sec"><div class="fr">
<div style="flex:1">{logo()}<p class="lead">Herramientas que trabajan por ti. Un solo plan, todo incluido. Hecho en México para Latinoamérica.</p></div>
<div class="fc"><h5>Herramientas</h5><a>Clips</a><a>Señales</a><a>En vivo</a><a>Ver todas</a></div>
<div class="fc"><h5>Chalyb</h5><a>Planes</a><a>Ayuda</a><a>Proponer una idea</a><a>Entrar</a></div>
<div class="fc"><h5>Legal</h5><a>Términos y Condiciones</a><a>Términos de Suscripción</a><a>Aviso de Privacidad</a><a>Uso aceptable</a></div></div>
<div class="fb"><span>© 2026 Chalyb. Precios en pesos mexicanos (MXN), IVA incluido.</span><span>Pago seguro con Mercado Pago</span></div></div></footer>'''

vis_items = f'''<div class="it">{toolicon("scissors","#5B4BFF",48,14,24)}<div class="tx"><b>6 clips listos</b><small>De tu stream de anoche</small></div><span class="pill ok">{ic("check")}Listo</span></div>
<div class="it">{toolicon("trend","#FF9F0A",48,14,24)}<div class="tx"><b>Señal: Bitcoin</b><small>Buen momento para comprar</small></div><span class="pill acc">Nuevo</span></div>
<div class="it">{toolicon("bot","#30B0C7",48,14,24)}<div class="tx"><b>Tu Asistente respondió</b><small>Contestó a 12 clientes</small></div><span class="pill ok">{ic("check")}Hecho</span></div>
<div class="it">{toolicon("target","#34A853",48,14,24)}<div class="tx"><b>Pronósticos del día</b><small>Listos para revisar</small></div><span class="pill acc">Nuevo</span></div>'''
b10 = f'''<div class="pg">{pubnav()}
<section class="sec"><div class="hero"><div>
<div class="kick"><span>Todo incluido</span>Un plan, todas las herramientas</div>
<h1>Bots que <em>trabajan por ti</em> mientras duermes</h1>
<p class="sub">Clips para tus redes, señales de cripto, tu transmisión y mucho más. Fuiste por una cosa y te llevaste todo.</p>
<div class="cta"><button class="btn btn-primary btn-xl">Prueba Pro gratis 1 mes</button><small>Todas las herramientas incluidas. Cancela cuando quieras.</small></div>
<div class="trust"><span>{ic("check")}En español</span><span>{ic("check")}Sin saber de tecnología</span><span>{ic("check")}Cancela en 1 clic</span></div></div>
<div class="vis"><div class="panel"><h4>Mientras dormías</h4>{vis_items}</div>
<div class="float">{thumb(0,150,266,dur="0:42",cap="¡NO LO PUEDO <em>CREER</em>!",radius=20,playsize=46)}</div></div></div></section>
<section class="band white"><div class="sec"><div class="shd"><div class="label">Herramientas</div><h2>Todo lo que necesitas, en un solo lugar</h2><p>Cada herramienta hace una cosa y la hace por ti. Todas vienen en tu plan.</p></div>
<div class="tg">{toolcards()}</div></div></section>
<section class="band"><div class="sec"><div class="shd"><div class="label">Cómo funciona</div><h2>Cómo funciona en 3 pasos</h2></div>
<div class="steps3"><div class="st3"><div class="n">1</div><h3>Crea tu cuenta</h3><p>Con Google o con tu correo. Toma 1 minuto.</p></div>
<div class="st3"><div class="n">2</div><h3>Elige qué quieres hacer</h3><p>Clips, señales, tu transmisión… todo está en Inicio con botones grandes.</p></div>
<div class="st3"><div class="n">3</div><h3>Listo, trabaja por ti</h3><p>Te avisamos cuando tus resultados estén listos. Tú solo los usas.</p></div></div></div></section>
<section class="band white"><div class="sec"><div class="shd"><div class="label">Clips</div><h2>Así se ven tus clips</h2><p>Pega el enlace de tu stream y recibe clips con subtítulos, listos para publicar.</p></div>
<div class="gall">{"".join(f'<div class="g">{thumb(k,176,313,dur=d,cap=c,radius=20,playsize=48)}<b>{t}</b></div>' for k,(t,d,c) in enumerate(CLIPS))}</div></div></section>
<section class="band"><div class="sec"><div class="shd"><h2>Hecho para streamers, creadores y negocios</h2><p>Si no tienes tiempo de editar, contestar o vigilar el mercado, Chalyb lo hace por ti.</p></div>
<div class="aud" style="grid-template-columns:repeat(4,1fr)">
<div class="au" style="background:#fff;box-shadow:var(--shadow)"><div class="ai">{ic("live")}</div><h3>Streamers</h3><p>Clips de cada transmisión y control de OBS en un toque.</p></div>
<div class="au" style="background:#fff;box-shadow:var(--shadow)"><div class="ai">{ic("scissors")}</div><h3>Creadores</h3><p>Publica todos los días sin pasar horas editando.</p></div>
<div class="au" style="background:#fff;box-shadow:var(--shadow)"><div class="ai">{ic("bot")}</div><h3>Negocios</h3><p>Un asistente que atiende a tus clientes por ti.</p></div>
<div class="au" style="background:#fff;box-shadow:var(--shadow)"><div class="ai">{ic("trend")}</div><h3>Quien invierte</h3><p>Avisos claros sobre cripto e inversiones, sin palabras raras.</p></div></div>
<div class="tstrip"><span>{ic("globe")}En español, para México y Latinoamérica</span><span>{ic("shield")}Pago seguro con Mercado Pago</span><span>{ic("chat")}Ayuda de una persona por WhatsApp</span></div></div></section>
<section class="band white"><div class="sec"><div class="shd"><div class="label">Planes</div><h2>Un plan, todo el kit</h2><p>Empieza gratis o prueba Pro un mes sin pagar nada hoy.</p></div>
<div class="plans">
<div class="pl" style="background:var(--bg);box-shadow:none"><h3>Gratis</h3><div class="pr">$0</div><div class="pn">Para conocer Chalyb</div><button class="btn btn-secondary">Crear cuenta gratis</button></div>
<div class="pl hi"><div class="tagx">Recomendado · Ahorras $1,498 al año</div><h3>Pro anual</h3><div class="pr">$7,490<span> MXN al año</span></div><div class="pn">(equivale a $624 al mes)</div><div class="pn"><b>Se renueva cada año</b></div><div class="pn" style="font-size:16px;margin-top:4px">o $749 MXN al mes · se renueva cada mes</div><button class="btn btn-primary btn-xl" style="margin-top:22px">Prueba Pro gratis 1 mes</button></div>
<div class="pl" style="background:var(--bg);box-shadow:none"><h3>VIP</h3><div class="pr">$2,499<span> MXN al mes</span></div><div class="pn">Todo Pro, más créditos y atención prioritaria</div><button class="btn btn-secondary">Ver VIP</button></div></div>
<div style="text-align:center;margin-top:26px"><a class="lnk" style="font-size:19px">Ver todos los planes y qué incluyen</a></div></div></section>
<section class="band" style="padding-bottom:0"><div class="sec"><div class="idea2"><div class="bi">{ic("bulb")}</div><div><h3>Tienes la idea, nosotros la construimos</h3><p>Propón una herramienta. Si la hacemos, compartimos las ganancias contigo.</p></div><button class="btn btn-secondary">Proponer mi idea</button></div></div></section>
<section class="band"><div class="sec"><div class="shd"><div class="label">Preguntas</div><h2>Preguntas frecuentes</h2></div><div class="faq">{faqs(FAQS)}</div></div></section>
<section style="padding:0 20px"><div class="final"><h2>Fuiste por una cosa y te llevaste todo.</h2><p>Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones.</p>
<button class="btn">Prueba Pro gratis 1 mes</button><small>Todas las herramientas incluidas. Cancela cuando quieras.</small></div></section>
{footer()}</div>'''
write("10-landing.html", page2("Chalyb", b10, css10))

# ===================== 11 LANDING MÓVIL =====================
css11 = '''
body{background:var(--bg)} .pg{width:390px;overflow:hidden}
.status{height:50px;display:flex;align-items:center;justify-content:space-between;padding:6px 30px 0 34px;font-size:17px;font-weight:600}
.status .r{display:flex;gap:6px;align-items:center}
.mn{display:flex;align-items:center;justify-content:space-between;padding:6px 20px 8px}
.mn .logo{padding:0;gap:9px}.mn .logo .mark{width:34px;height:34px;border-radius:10px}.mn .logo .mark svg{width:19px;height:19px}.mn .logo .word{font-size:21px}
.mn .r{display:flex;gap:10px;align-items:center}
.mn .in{font-size:17px;font-weight:600}
.mn .bur{width:44px;height:44px;border-radius:50%;background:#fff;box-shadow:var(--shadow);display:grid;place-items:center}
.mh{padding:26px 22px 8px}
.mh .kick{display:inline-block;background:var(--tint);color:var(--accent);border-radius:999px;padding:6px 14px;font-size:15px;font-weight:700}
.mh h1{font-size:40px;line-height:1.06;letter-spacing:-.04em;margin-top:16px}
.mh h1 em{font-style:normal;background:linear-gradient(90deg,#5B4BFF,#9B5BFF);-webkit-background-clip:text;color:transparent}
.mh .sub{font-size:19px;margin-top:14px}
.mh .btn-xl{margin-top:24px;font-size:20px}
.mh small{display:block;text-align:center;font-size:16px;color:var(--ink2);margin-top:12px}
.mvis{margin:26px 16px 0;background:#fff;border-radius:24px;box-shadow:var(--shadow-lg);padding:18px 18px 8px}
.mvis h4{font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-bottom:4px}
.mvis .it{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.mvis .it:last-child{border-bottom:0}
.mvis .it b{font-size:16.5px;display:block}.mvis .it small{font-size:14.5px;color:var(--ink2)}
.mvis .it .tx{flex:1;min-width:0}
.ms{padding:52px 16px 0}
.ms .hd{padding:0 6px}
.ms .label{margin-bottom:8px}
.ms h2{font-size:30px;font-weight:700;letter-spacing:-.03em;line-height:1.12}
.ms .p{font-size:18px;color:var(--ink2);margin-top:8px}
.mt{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.mtc{display:flex;gap:14px;align-items:center;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:16px}
.mtc b{font-size:19px;font-weight:700;display:block}
.mtc p{font-size:15.5px;color:var(--ink2);line-height:1.35;margin-top:2px}
.mst{display:flex;gap:14px;align-items:flex-start;background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:18px}
.mst .n{width:40px;height:40px;border-radius:50%;background:var(--accent);color:#fff;font-weight:700;font-size:19px;display:grid;place-items:center;flex:none}
.mst b{font-size:19px;display:block}.mst p{font-size:16px;color:var(--ink2);margin-top:2px}
.mg{display:flex;gap:10px;margin-top:22px;overflow:hidden;padding:0 6px}
.maud{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}
.maud div{background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:16px;font-size:17px;font-weight:650;display:flex;flex-direction:column;gap:10px}
.maud div svg.i{color:var(--accent);width:26px;height:26px}
.maud small{font-size:14.5px;color:var(--ink2);font-weight:500}
.mpl{background:#fff;border-radius:24px;box-shadow:0 0 0 3px var(--accent),var(--shadow-lg);padding:24px 20px;margin-top:26px;position:relative}
.mpl .tagx{position:absolute;top:-15px;left:20px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;padding:5px 12px;border-radius:999px}
.mpl h3{font-size:21px}
.mpl .pr{font-size:42px;font-weight:750;letter-spacing:-.04em;margin-top:6px}
.mpl .pr span{font-size:18px;color:var(--ink2);font-weight:600;letter-spacing:0}
.mpl .pn{font-size:17px;color:var(--ink2)} .mpl .pn b{color:var(--ink)}
.strike{text-decoration:line-through;color:var(--ink3)}
.mpl2{display:flex;gap:10px;margin-top:12px}
.mpl2 div{flex:1;background:#fff;border-radius:18px;box-shadow:var(--shadow);padding:16px}
.mpl2 b{font-size:17px;display:block}.mpl2 span{font-size:22px;font-weight:750;letter-spacing:-.03em}.mpl2 small{font-size:14px;color:var(--ink2)}
.midea{margin-top:20px;display:flex;gap:14px;align-items:center;background:#fff;border-radius:20px;box-shadow:inset 0 0 0 1.5px #E4E0FF;padding:18px}
.midea b{font-size:18px;display:block}.midea p{font-size:15.5px;color:var(--ink2);margin-top:2px}
.mfq{margin-top:20px;background:#fff;border-radius:20px;box-shadow:var(--shadow);overflow:hidden}
.mfq .q{display:flex;align-items:center;gap:10px;padding:18px;font-size:18px;font-weight:600;border-top:1px solid var(--line)}
.mfq .q:first-child{border-top:0}
.mfq .q svg.i{margin-left:auto;color:var(--ink3);width:20px;height:20px}
.mfq .a{padding:0 18px 18px;font-size:16.5px;color:var(--ink2);margin-top:-8px}
.mfin{margin:52px 16px 0;border-radius:28px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff;padding:32px 22px;text-align:center}
.mfin h2{font-size:28px;letter-spacing:-.03em;line-height:1.15}
.mfin .btn{width:100%;margin-top:20px;height:64px;background:#fff;color:var(--accent);font-size:19px;border-radius:17px}
.mfin small{display:block;font-size:15px;opacity:.88;margin-top:12px}
.mfoot{margin-top:40px;background:#fff;border-top:1px solid var(--line);padding:30px 22px 40px}
.mfoot .logo{padding:0}
.mfoot .lk{display:grid;grid-template-columns:1fr 1fr;gap:12px 10px;margin-top:22px;font-size:16.5px}
.mfoot .cp{font-size:14.5px;color:var(--ink3);margin-top:22px;line-height:1.5}
'''
m_vis = vis_items.replace('class="it"','class="it"').replace('48,14,24','40,12,20')
m_vis = f'''<div class="it">{toolicon("scissors","#5B4BFF",42,12,21)}<div class="tx"><b>6 clips listos</b><small>De tu stream de anoche</small></div><span class="pill ok">{ic("check")}Listo</span></div>
<div class="it">{toolicon("trend","#FF9F0A",42,12,21)}<div class="tx"><b>Señal: Bitcoin</b><small>Buen momento para comprar</small></div><span class="pill acc">Nuevo</span></div>
<div class="it">{toolicon("bot","#30B0C7",42,12,21)}<div class="tx"><b>Tu Asistente respondió</b><small>Mientras dormías</small></div><span class="pill ok">{ic("check")}Hecho</span></div>'''
mtools = "".join(f'<div class="mtc">{toolicon(i,c,52,15,26)}<div><b>{n}</b><p>{d}</p></div></div>' for n,i,d,c in TOOLS)
b11 = f'''<div class="pg">{statusbar()}<div class="mn">{logo()}<div class="r"><a class="in">Entrar</a><div class="bur">{ic("menu")}</div></div></div>
<div class="mh"><span class="kick">Un plan, todas las herramientas</span><h1>Bots que <em>trabajan por ti</em> mientras duermes</h1>
<p class="sub">Clips, señales de cripto, tu transmisión y mucho más. Fuiste por una cosa y te llevaste todo.</p>
<button class="btn btn-primary btn-xl">Prueba Pro gratis 1 mes</button><small>Todas las herramientas incluidas. Cancela cuando quieras.</small></div>
<div class="mvis"><h4>Mientras dormías</h4>{m_vis}</div>
<section class="ms"><div class="hd"><div class="label">Herramientas</div><h2>Todo lo que necesitas, en un solo lugar</h2></div><div class="mt">{mtools}</div></section>
<section class="ms"><div class="hd"><div class="label">Cómo funciona</div><h2>Cómo funciona en 3 pasos</h2></div><div class="mt">
<div class="mst"><div class="n">1</div><div><b>Crea tu cuenta</b><p>Con Google o con tu correo. Toma 1 minuto.</p></div></div>
<div class="mst"><div class="n">2</div><div><b>Elige qué quieres hacer</b><p>Todo está en Inicio, con botones grandes.</p></div></div>
<div class="mst"><div class="n">3</div><div><b>Listo, trabaja por ti</b><p>Te avisamos cuando tus resultados estén listos.</p></div></div></div></section>
<section class="ms"><div class="hd"><div class="label">Clips</div><h2>Así se ven tus clips</h2></div>
<div class="mg">{"".join(thumb(k,110,196,dur=d,cap="",radius=16,playsize=38) for k,(t,d,c) in enumerate(CLIPS[:3]))}</div></section>
<section class="ms"><div class="hd"><h2>Hecho para streamers, creadores y negocios</h2></div><div class="maud">
<div>{ic("live")}Streamers<small>Clips y control de OBS</small></div><div>{ic("scissors")}Creadores<small>Publica sin editar</small></div>
<div>{ic("bot")}Negocios<small>Atiende a tus clientes</small></div><div>{ic("trend")}Quien invierte<small>Avisos claros</small></div></div></section>
<section class="ms"><div class="hd"><div class="label">Planes</div><h2>Un plan, todo el kit</h2></div>
<div class="mpl"><div class="tagx">Recomendado · Ahorras $1,498 al año</div><h3>Pro anual</h3><div class="pr">$7,490<span> MXN al año</span></div>
<div class="pn">(equivale a $624 al mes)</div><div class="pn"><b>Se renueva cada año</b></div><div class="pn" style="font-size:15px">o $749 MXN al mes · se renueva cada mes</div>
<button class="btn btn-primary btn-xl" style="margin-top:18px;font-size:19px">Prueba Pro gratis 1 mes</button></div>
<div class="mpl2"><div><b>Gratis</b><span>$0</span><small style="display:block">Para conocer Chalyb</small></div><div><b>VIP</b><span>$2,499</span><small style="display:block">MXN al mes · más créditos</small></div></div>
<div style="text-align:center;margin-top:16px"><a class="lnk" style="font-size:17px">Ver todos los planes</a></div>
<div class="midea">{toolicon("bulb","#E8A600",48,14,24)}<div><b>Tienes la idea, nosotros la construimos</b><p>Propón una herramienta y compartimos las ganancias.</p></div></div></section>
<section class="ms"><div class="hd"><h2>Preguntas frecuentes</h2></div><div class="mfq">
<div class="q">{FAQS[0][0]}{ic("chevd","i","transform:rotate(180deg)")}</div><div class="a">{FAQS[0][1]}</div>
{"".join(f'<div class="q">{q}{ic("chevd")}</div>' for q,a in FAQS[1:5])}</div></section>
<div class="mfin"><h2>Fuiste por una cosa y te llevaste todo.</h2><button class="btn">Prueba Pro gratis 1 mes</button><small>Todas las herramientas incluidas. Cancela cuando quieras.</small></div>
<footer class="mfoot">{logo()}<div class="lk"><a>Términos y Condiciones</a><a>Términos de Suscripción</a><a>Aviso de Privacidad</a><a>Uso aceptable</a><a>Planes</a><a>Ayuda</a></div>
<div class="cp">© 2026 Chalyb · Hecho en México.<br>Precios en MXN, IVA incluido. Pago seguro con Mercado Pago.</div></footer></div>'''
write("11-landing-movil.html", page2("Chalyb móvil", b11, css11))

# ===================== 12 PLANES =====================
css12 = css10 + '''
.ph{text-align:center;padding:64px 0 0}
.ph h1{font-size:52px;letter-spacing:-.04em}
.ph .sub{font-size:21px}
.tog{display:inline-flex;background:#E6E6EC;border-radius:18px;padding:5px;margin-top:30px;gap:4px}
.tog span{height:56px;padding:0 26px;display:flex;align-items:center;gap:10px;border-radius:14px;font-size:19px;font-weight:600;color:var(--ink2)}
.tog span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.tog .pill{font-size:13px}
.pc{display:grid;grid-template-columns:1fr 1.1fr 1fr;gap:22px;margin-top:40px;align-items:stretch}
.pk{background:#fff;border-radius:26px;box-shadow:var(--shadow);padding:32px 30px;display:flex;flex-direction:column;position:relative}
.pk.hi{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.pk .tagx{position:absolute;top:-17px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:7px 16px;border-radius:999px;white-space:nowrap}
.pk h3{font-size:26px;font-weight:700}
.pk .d{font-size:18px;color:var(--ink2);margin-top:4px}
.pk .pr{font-size:54px;font-weight:750;letter-spacing:-.045em;margin-top:20px;line-height:1}
.pk .pr span{font-size:21px;font-weight:600;color:var(--ink2);letter-spacing:-.01em}
.pk .pn{font-size:19px;color:var(--ink);margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:600}
.pk .pn2{font-size:17px;color:var(--ink2);margin-top:6px}
.pk .btn{width:100%;margin-top:24px}
.pk .bn{font-size:16px;color:var(--ink2);text-align:center;margin-top:10px}
.pk ul{list-style:none;margin-top:26px;padding-top:22px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:13px}
.pk li{display:flex;gap:12px;font-size:18px;line-height:1.35}
.pk li .ck{width:26px;height:26px;border-radius:50%;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.pk li .ck svg{width:15px;height:15px;stroke-width:3}
.pk li.no{color:var(--ink3)} .pk li.no .ck{background:#F0F0F3;color:#B0B0B8}
.pk .h5{font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3)}
.pnote{text-align:center;font-size:17px;color:var(--ink2);margin-top:28px}
'''
def lis(items):
    o=""
    for t in items:
        no = t.startswith("-")
        o += f'<li class="{"no" if no else ""}"><span class="ck">{ic("x" if no else "check")}</span><span>{t.lstrip("-")}</span></li>'
    return f"<ul>{o}</ul>"
PFAQ = [
 ("¿Qué pasa cuando termina mi mes gratis?","Sigues con el plan que elegiste (anual o mensual) y se cobra a tu tarjeta. Te avisamos por correo 7 días antes. Si cancelas antes, no pagas nada."),
 ("¿Puedo cambiar de anual a mensual?","Sí, desde Mi cuenta → Mi plan, cuando quieras."),
 ("¿Qué son los créditos?","Son lo que usan las herramientas para trabajar, por ejemplo, cada clip. Tu plan trae créditos nuevos cada mes."),
 ("¿Puedo cancelar cuando quiera?","Sí. Es 1 clic desde Mi cuenta. Sigues con tu plan hasta el final del periodo que pagaste."),
]
b12 = f'''<div class="pg">{pubnav("planes")}<section class="sec">
<div class="ph"><h1>Un plan. Todas las herramientas.</h1><p class="sub">Prueba Pro gratis 1 mes. Cancela cuando quieras.</p>
<div class="tog"><span>Mensual</span><span class="on">Anual <i class="pill acc" style="font-style:normal">Ahorras $1,498</i></span></div></div>
<div class="pc">
<div class="pk"><h3>Gratis</h3><div class="d">Para conocer Chalyb</div><div class="pr">$0</div><div class="pn">Sin tarjeta</div><div class="pn2">Para siempre</div>
<button class="btn btn-secondary">Crear cuenta gratis</button><div class="bn">&nbsp;</div>
{lis(["Clips para probar","Tus resultados guardados","Ayuda por correo","-Señales, En vivo y las demás herramientas"])}</div>
<div class="pk hi"><div class="tagx">Recomendado</div><h3>Pro</h3><div class="d">Todas las herramientas</div>
<div class="pr">$7,490<span> MXN al año</span></div><div class="pn2" style="margin-top:6px">(equivale a $624 al mes)</div><div class="pn">Se renueva cada año</div><div class="pn2" style="display:flex;align-items:center;gap:8px;margin-top:8px"><span class="pill acc" style="margin:0">Ahorras $1,498 al año</span></div><div class="pn2" style="margin-top:6px">vs. $8,988 pagando mes a mes</div>
<div class="pn2">o $749 MXN al mes con Mensual</div>
<button class="btn btn-primary btn-xl" style="margin-top:24px">Prueba Pro gratis 1 mes</button><div class="bn">Hoy pagas $0. Te avisamos 7 días antes del primer cobro.</div>
{lis(["Las 7 herramientas: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones","2,000 créditos cada mes","Clips sin marca de agua","Opciones avanzadas para profesionales","Ayuda de una persona por WhatsApp"])}</div>
<div class="pk"><h3>VIP</h3><div class="d">Para quien lo usa todos los días</div><div class="pr">$2,499<span> MXN al mes</span></div><div class="pn">Se renueva cada mes</div><div class="pn2">Sin plan anual</div>
<button class="btn btn-secondary">Elegir VIP</button><div class="bn">&nbsp;</div>
{lis(["Todo lo de Pro","Muchos más créditos cada mes","Atención prioritaria por WhatsApp","Primero en recibir herramientas nuevas"])}</div></div>
<p class="pnote">Precios en pesos mexicanos (MXN), IVA incluido. Pago seguro con Mercado Pago.</p>
<div class="shd" style="margin-top:80px"><h2>Preguntas sobre los planes</h2></div><div class="faq" style="margin-bottom:0">{faqs(PFAQ)}</div></section>
{footer()}</div>'''
write("12-planes.html", page2("Planes", b12, css12))
