# ===================== APP 19-26, 30 =====================
APPX = '''
.main{padding-top:44px}
.hrow{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.hrow .sub{margin-top:6px}
.srch{display:flex;align-items:center;gap:12px;height:60px;width:380px;padding:0 20px;border-radius:18px;background:#fff;box-shadow:var(--shadow);font-size:18px;color:#A8A8B0}
.srch svg.i{color:var(--ink3)}
.chips{display:flex;gap:10px;margin-top:20px;flex-wrap:nowrap}
.chips .chip{height:46px;padding:0 18px;font-size:17px}
'''
# ---- 19 mis resultados
css19 = APPX + '''
.rg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}
.rc{background:#fff;border-radius:22px;box-shadow:var(--shadow);overflow:hidden;display:flex;flex-direction:column}
.rc .vz{height:104px;position:relative;display:flex;align-items:center;padding:0 22px;gap:14px}
.rc .vz .big{font-size:21px;font-weight:700;letter-spacing:-.02em;color:var(--ink)}
.rc .bd{padding:14px 20px 18px}
.rc .lb{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase}
.rc h3{font-size:20px;font-weight:650;letter-spacing:-.015em;margin-top:6px;line-height:1.25}
.rc .dt{font-size:16px;color:var(--ink3);margin-top:4px}
.rc .ac{display:flex;gap:10px;margin-top:12px}
.rc .ac .btn{height:50px;font-size:17px;padding:0 20px;border-radius:14px;box-shadow:none}
.rc .ac .btn-gray{background:var(--bg)}
.stk{display:flex}.stk .thumb{box-shadow:0 0 0 3px #fff}.stk .thumb + .thumb{margin-left:-16px}
'''
def rcard(tool, icon, col, title, dt, vz, primary, second=None, tint="#F6F5FF"):
    sec = f'<button class="btn btn-gray">{second}</button>' if second else ""
    return f'''<div class="rc"><div class="vz" style="background:{tint}">{vz}</div><div class="bd">
<div class="lb" style="color:{col}">{ic(icon,"i","width:17px;height:17px")}{tool}</div><h3>{title}</h3><div class="dt">{dt}</div>
<div class="ac"><button class="btn btn-primary">{primary}</button>{sec}</div></div></div>'''
stk = "".join(thumb(i,46,80,radius=10,play=False) for i in range(5))
R19 = [
 rcard("Clips","scissors","#5B4BFF","6 clips de “Noche de preguntas”","Hoy, 8:40 p.m. · Vertical con subtítulos",f'<div class="stk">{stk}</div><span class="pill ok" style="margin-left:auto">{ic("check")}Listos</span>',"Ver clips","Descargar"),
 rcard("Señales","trend","#C77700","Bitcoin: buen momento para comprar","Hoy, 7:15 a.m. · Te avisamos por WhatsApp",f'<div class="coin" style="background:#F7931A">₿</div><div class="big">Buen momento<br>para comprar</div>',"Ver señal",tint="#FFF6E8"),
 rcard("En vivo","live","#E0244A","Transmisión del martes","Mar 29 sep · Duró 2 h 14 min",thumb(3,140,80,dur="2:14:08",radius=12,playsize=32)+'<div class="big" style="font-size:18px">Grabación<br>guardada</div>',"Ver grabación","Hacer clips",tint="#FFEFF2"),
 rcard("Asistente","bot","#1F8FA6","Respondió 12 mensajes de tus clientes","Lun 28 sep · WhatsApp e Instagram",f'{toolicon("chat","#30B0C7",52,16,26)}<div class="big">12 respuestas<br>enviadas</div>',"Ver mensajes",tint="#EAF8FB"),
 rcard("Inmuebles","house","#0A6FD8","Ficha: Casa en Coyoacán, 3 recámaras","Dom 27 sep · Lista para publicar",f'{toolicon("house","#0A84FF",52,16,26)}<div class="big">Ficha lista<br>con fotos y texto</div>',"Abrir","Compartir",tint="#EAF3FF"),
 rcard("Pronósticos","target","#25883F","Pronósticos del sábado","Sáb 26 sep · 5 partidos",f'{toolicon("target","#34A853",52,16,26)}<div class="big">5 partidos<br>explicados</div>',"Abrir",tint="#EBF8EF"),
]
chips19 = "".join(f'<span class="chip{" on" if k==0 else ""}">{t}</span>' for k,t in enumerate(["Todos","Clips","Señales","En vivo","Asistente","Pronósticos","Inmuebles","Inversiones"]))
b19 = f'''<div class="app">{sidebar("resultados")}<main class="main"><div class="wrap">
<div class="hrow"><div><h1>Mis resultados</h1><p class="sub">Todo lo que tus herramientas hicieron por ti.</p></div><div class="srch">{ic("search")}Buscar en mis resultados</div></div>
<div class="chips">{chips19}</div><div class="rg">{"".join(R19)}</div></div></main></div>'''
write("19-mis-resultados.html", page2("Mis resultados", b19, css19))

# ---- 20 señales paso 1
COINS = [("Bitcoin","BTC","#F7931A","₿",True),("Ethereum","ETH","#627EEA","Ξ",True),("Solana","SOL","linear-gradient(135deg,#14F195,#9945FF)","S",True),("XRP","XRP","#23292F","X",False),
         ("Dogecoin","DOGE","#C2A633","Ð",False),("Cardano","ADA","#0033AD","A",False),("BNB","BNB","#F3BA2F","B",False),("Litecoin","LTC","#345D9D","Ł",False)]
css20 = '''
.col{max-width:1000px}
.title{margin-top:40px;text-align:center}
.cg{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:38px}
.cn{position:relative;height:104px;border-radius:22px;background:#fff;box-shadow:var(--shadow);display:flex;align-items:center;gap:16px;padding:0 20px}
.cn b{font-size:20px;font-weight:650;display:block}.cn small{font-size:16px;color:var(--ink3);font-weight:600}
.cn.sel{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.cn .chk{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center}
.cn .chk svg{width:17px;height:17px;stroke-width:3}
.cn .rad{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;box-shadow:inset 0 0 0 2px #D2D2DA}
.more{margin-top:16px;text-align:center;font-size:18px}
.cnt{margin-top:26px;text-align:center;font-size:19px;color:var(--ink2)}
.cnt b{color:var(--ink)}
.adv{margin:18px auto 0;max-width:820px;display:flex;align-items:center;gap:16px;padding:0 22px 0 26px;height:68px;border-radius:20px;box-shadow:inset 0 0 0 1.5px #DEDEE4}
.adv b{font-size:19px;font-weight:600}.adv small{font-size:16px;color:var(--ink3);margin-left:auto;margin-right:6px}
.adv .ic2{color:var(--ink2)}.adv .chev{color:var(--ink3)}
.foot{margin-top:22px;display:flex;justify-content:center}
.foot .btn-xl{max-width:520px}
'''
cg = ""
for n,s_,c,sym,sel in COINS:
    mark = f'<div class="chk">{ic("check")}</div>' if sel else '<div class="rad"></div>'
    cg += f'<div class="cn{" sel" if sel else ""}">{mark}<div class="coin" style="background:{c}">{sym}</div><div><b>{n}</b><small>{s_}</small></div></div>'
b20 = f'''<div class="flow">{wtop("Inicio","Señales","trend",step=1)}<div class="col">
<div class="title"><h1>¿Qué monedas te interesan?</h1><p class="sub">Elige una o varias. Puedes cambiarlas después.</p></div>
<div class="cg">{cg}</div><div class="more"><a class="lnk">Buscar otra moneda</a></div>
<div class="cnt">Elegiste <b>3 monedas</b>: Bitcoin, Ethereum y Solana.<br><span style="font-size:16px;color:var(--ink3)">Las señales son iguales para todos los usuarios de tu plan.</span></div>
<div class="adv">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><small>Temporalidad y horario de avisos</small>{ic("chevd","i chev")}</div>
<div class="foot"><button class="btn btn-primary btn-xl">Continuar</button></div></div></div>'''
write("20-senales-paso1.html", page2("Señales paso 1", b20, css20))

# ---- 21 señales listo
css21 = '''
.col{max-width:1240px;padding:0 40px}
.hd{display:flex;align-items:flex-end;justify-content:space-between;margin-top:16px}
.hd .sub{margin-top:8px}
.disc2{margin-top:18px;display:flex;align-items:center;gap:14px;padding:16px 22px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 2px #E4E0FF;font-size:18px}
.disc2 svg.i{color:var(--accent);width:26px;height:26px}
.disc2 a{margin-left:auto;white-space:nowrap;font-size:17px}
.lay{display:grid;grid-template-columns:1fr 380px;gap:24px;margin-top:20px;align-items:start}
.feed{display:flex;flex-direction:column;gap:14px}
.sg{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:18px 24px;display:flex;gap:18px;align-items:flex-start}
.sg .tx{flex:1}
.sg .top{display:flex;align-items:center;gap:10px}
.sg .top b{font-size:19px}.sg .top small{font-size:16px;color:var(--ink3);margin-left:auto}
.sg .verdict{display:inline-flex;align-items:center;gap:8px;margin-top:8px;font-size:22px;font-weight:700;letter-spacing:-.02em;padding:6px 14px 6px 10px;border-radius:12px}
.sg .verdict svg.i{width:22px;height:22px;stroke-width:2.6}
.v-buy{background:var(--tint);color:var(--accent)} .v-sell{background:var(--warn-tint);color:var(--warn)} .v-wait{background:#EEEEF2;color:var(--ink2)}
.sg p{font-size:18px;color:var(--ink2);margin-top:8px}
.sg .why{font-size:16px;color:var(--accent);font-weight:600;margin-top:8px}
.side2 .group{margin-bottom:16px}
.side2 .row{min-height:60px}
.cl{display:flex;flex-wrap:wrap;gap:8px;padding:14px 20px 18px}
.cl span{display:flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 6px;border-radius:999px;background:var(--bg);font-size:16px;font-weight:600}
.cl span i{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;font-style:normal;font-size:13px;font-weight:800}
.gh2{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0;font-size:17px;font-weight:650}
.gh2 a{font-size:16px;color:var(--accent)}
'''
def sgcard(coin, color, sym, when, kind, verdict, text, conf):
    icn = {"buy":"up","sell":"down","wait":"pause"}[kind]
    return f'''<div class="sg"><div class="coin" style="background:{color}">{sym}</div><div class="tx"><div class="top"><b>{coin}</b><small>{when}</small></div>
<div class="verdict v-{kind}">{ic(icn)}{verdict}</div><p>{text}</p><div class="why">{conf} · Ver por qué</div></div></div>'''
feed = (sgcard("Bitcoin","#F7931A","₿","Hoy, 7:15 a.m.","buy","Buen momento para comprar","Bitcoin lleva varios días subiendo de forma estable y sin sobresaltos.","Confianza alta")
      + sgcard("Solana","linear-gradient(135deg,#14F195,#9945FF)","S","Ayer, 6:02 p.m.","sell","Buen momento para vender","Subió muy rápido esta semana y podría bajar pronto.","Confianza media")
      + sgcard("Ethereum","#627EEA","Ξ","Ayer, 9:30 a.m.","wait","Mejor espera","El precio se está moviendo mucho. Te avisamos cuando se calme.","Sin prisa"))
side21 = f'''<div class="side2"><div class="group"><div class="gh2">Así te avisamos<a>Cambiar</a></div>
<div class="row"><div class="ic" style="background:#25D366">{ic("chat")}</div><div class="tx"><b>WhatsApp</b><small>+52 55 •••• 4821</small></div><div class="sw on"></div></div>
<div class="row"><div class="ic" style="background:#0A84FF">{ic("mail")}</div><div class="tx"><b>Correo</b></div><div class="sw"></div></div>
<div class="row"><div class="ic" style="background:#5B4BFF">{ic("bell")}</div><div class="tx"><b>En la app</b></div><div class="sw on"></div></div></div>
<div class="group"><div class="gh2">Tus monedas<a>Cambiar</a></div><div class="cl">
<span><i style="background:#F7931A">₿</i>Bitcoin</span><span><i style="background:#627EEA">Ξ</i>Ethereum</span><span><i style="background:linear-gradient(135deg,#14F195,#9945FF)">S</i>Solana</span></div></div>
<div class="group"><div class="row">{ic("sliders","i","color:var(--ink2)")}<div class="tx"><b>Opciones avanzadas</b><small>Temporalidad y horario de avisos</small></div>{ic("chev","i chev")}</div></div></div>'''
b21 = f'''<div class="flow">{wtop("Inicio","Señales","trend")}<div class="col">
<div class="hd"><div><h1>Tus señales ya están activas</h1><p class="sub">Te avisamos por WhatsApp cuando haya algo importante. Esto es lo más reciente.</p></div><span class="tag-ej">Datos de ejemplo</span></div>
<div class="disc2">{ic("info")}<span><b>Esto es informativo, no es asesoría financiera.</b> Las señales son iguales para todos y no usan tus saldos ni tus inversiones. Tú decides.</span><a class="lnk">Leer aviso completo</a></div>
<div class="lay"><div class="feed">{feed}</div>{side21}</div></div></div>'''
write("21-senales-listo.html", page2("Señales listo", b21, css21))

# ---- 22 en vivo
css22 = '''
.col{max-width:1240px;padding:0 40px}
.lay{display:grid;grid-template-columns:1fr 380px;gap:26px;margin-top:22px;align-items:start}
.conn{display:flex;align-items:center;gap:16px;padding:18px 22px;border-radius:20px;background:#fff;box-shadow:var(--shadow)}
.conn .d{width:44px;height:44px;border-radius:50%;background:var(--ok-tint);color:var(--ok);display:grid;place-items:center;flex:none}
.conn .d svg{width:24px;height:24px;stroke-width:3}
.conn b{font-size:20px;display:block}.conn small{font-size:16.5px;color:var(--ink2)}
.conn .plat{margin-left:auto;display:flex;gap:10px;align-items:center}
.go{margin-top:18px;width:100%;height:100px;border-radius:24px;background:var(--accent);color:#fff;font-size:28px;font-weight:700;letter-spacing:-.02em;display:flex;align-items:center;justify-content:center;gap:18px;box-shadow:0 12px 30px rgba(91,75,255,.35)}
.go .rec{width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 0 0 6px rgba(255,255,255,.25)}
.gon{text-align:center;font-size:17px;color:var(--ink2);margin-top:10px}
.sh3{display:flex;align-items:baseline;justify-content:space-between;margin-top:24px}
.sh3 h3{font-size:22px;font-weight:650}.sh3 small{font-size:16px;color:var(--ink3)}
.scn{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:12px}
.sc{background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:10px 10px 14px;position:relative}
.sc b{display:block;font-size:18px;font-weight:650;margin:10px 6px 0}
.sc small{display:block;font-size:15px;color:var(--ink3);margin:2px 6px 0}
.sc.on{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.sc .onb{position:absolute;top:18px;left:18px;z-index:2;background:var(--accent);color:#fff;font-size:13px;font-weight:700;padding:4px 10px;border-radius:999px}
.rt .group{margin-bottom:16px}
.rt .row{min-height:62px}
.gh2{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 2px;font-size:17px;font-weight:650}
.gh2 a{font-size:16px;color:var(--accent)}
.ok3{color:var(--ok);font-weight:600;font-size:16px;display:flex;align-items:center;gap:5px}
.ok3 svg{width:16px;height:16px;stroke-width:3}
'''
SC = [("Empezando pronto","Pantalla de espera",0,False),("Juego","Pantalla + cámara",3,True),("Charla","Solo cámara",5,False),("Pausa","Vuelvo enseguida",1,False)]
scn = "".join(f'<div class="sc{" on" if on else ""}">{"<span class=onb>En pantalla</span>" if on else ""}{thumb(k,128,140,radius=14,play=False).replace("width:128px;height:140px","width:100%;height:140px")}<b>{t}</b><small>{d}</small></div>' for t,d,k,on in SC)
b22 = f'''<div class="flow">{wtop("Inicio","En vivo","live")}<div class="col">
<div style="margin-top:22px"><h1>Tu transmisión</h1><p class="sub" style="margin-top:6px">Todo listo. Cuando quieras, toca el botón grande.</p></div>
<div class="lay"><div>
<div class="conn"><div class="d">{ic("check")}</div><div><b>OBS conectado</b><small>Tu transmisión saldrá en YouTube y Twitch</small></div><div class="plat">{YT}{TW}<a class="lnk" style="font-size:17px;margin-left:6px">Cambiar</a></div></div>
<button class="go"><span class="rec"></span>Iniciar transmisión</button><div class="gon">Empieza en 3 segundos. Puedes detenerla cuando quieras.</div>
<div class="sh3"><h3>Escenas</h3><small>Toca una para cambiar lo que ve tu público</small></div><div class="scn">{scn}</div></div>
<div class="rt"><div class="group"><div class="gh2">Controles rápidos</div>
<div class="row"><div class="ic" style="background:#FF375F">{ic("mic")}</div><div class="tx"><b>Micrófono</b></div><div class="sw on"></div></div>
<div class="row"><div class="ic" style="background:#5B4BFF">{ic("cam")}</div><div class="tx"><b>Cámara</b></div><div class="sw on"></div></div>
<div class="row"><div class="ic" style="background:#FF9F0A">{ic("scissors")}</div><div class="tx"><b>Hacer clips al terminar</b></div><div class="sw on"></div></div></div>
<div class="group"><div class="gh2">Antes de empezar</div>
<div class="row"><div class="tx"><b>Internet</b></div><span class="ok3">{ic("check")}Bueno</span></div>
<div class="row"><div class="tx"><b>Título</b><small>Noche de preguntas</small></div><span class="val" style="color:var(--accent);font-weight:600;font-size:17px">Editar</span></div></div>
<div class="group"><div class="row">{ic("sliders","i","color:var(--ink2)")}<div class="tx"><b>Opciones avanzadas</b><small>Calidad, servidores y atajos</small></div>{ic("chev","i chev")}</div></div></div></div></div></div>'''
write("22-en-vivo.html", page2("En vivo", b22, css22))

# ---- 23 más herramientas
css23 = APPX + '''
.main{overflow:visible}
.app{height:auto;min-height:100vh;overflow:visible}
.tg4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:26px}
.t4{background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:22px 20px 20px;display:flex;flex-direction:column;min-height:300px}
.t4 p{margin-bottom:18px}
.t4 h3{font-size:24px;font-weight:700;margin-top:18px;letter-spacing:-.02em}
.t4 p{font-size:17.5px;color:var(--ink2);margin-top:6px;line-height:1.4}
.t4 .pill{align-self:flex-start;margin-top:auto}
.t4 .btn{margin-top:12px;width:100%;height:58px}
.free{margin-top:36px;padding:26px;border-radius:28px;box-shadow:inset 0 0 0 2px #DEDEE4;background:rgba(255,255,255,.4)}
.free .fh{display:flex;align-items:center;gap:14px}
.free .fh h2{font-size:22px}
.free .fh .tag-ej{background:#EEEEF2;color:var(--ink2);border-color:#C9C9D2}
.free .t4{min-height:290px}
.free .t4 .btn{background:var(--tint);color:var(--accent);box-shadow:none}
.promo{margin-top:18px;display:flex;align-items:center;gap:18px;padding:18px 22px;border-radius:20px;background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF}
.promo b{font-size:19px;display:block}.promo small{font-size:16.5px;color:var(--ink2)}
.promo .btn{margin-left:auto;height:56px}
'''
MORE = TOOLS[3:]
def t4(name, icon, desc, col, locked=False):
    if locked:
        return f'<div class="t4">{toolicon(icon,col,60,18,30)}<h3>{name}</h3><p>{desc}</p><span class="pill acc">{ic("star","i","width:13px;height:13px;fill:currentColor;stroke-width:0")}Incluido en Pro</span><button class="btn">Pruébalo gratis</button></div>'
    return f'<div class="t4">{toolicon(icon,col,60,18,30)}<h3>{name}</h3><p>{desc}</p><span class="pill ok">{ic("check")}Incluido en tu plan</span><button class="btn btn-primary">Abrir</button></div>'
b23 = f'''<div class="app">{sidebar("inicio")}<main class="main"><div class="wrap">
<div class="eyebrow">Inicio ›</div><h1>Más herramientas</h1><p class="sub" style="margin-top:6px">Todo está incluido en tu plan Pro. Abre la que quieras.</p>
<div class="tg4">{"".join(t4(*t) for t in MORE)}</div>
<div class="free"><div class="fh"><h2>Así lo ve alguien con plan Gratis</h2><span class="tag-ej">Otro estado</span></div>
<div class="tg4" style="margin-top:18px">{"".join(t4(*t, locked=True) for t in MORE)}</div>
<div class="promo">{toolicon("gift","#5B4BFF",48,14,24)}<div><b>Prueba Pro gratis 1 mes</b><small>Todas las herramientas incluidas. Cancela cuando quieras.</small></div><button class="btn btn-primary">Prueba Pro gratis 1 mes</button></div></div>
</div></main></div>'''
write("23-mas-herramientas.html", page2("Más herramientas", b23, css23))

# ---- 24 vacío y error
css24 = '''
body{background:#ECECF1}
.sheet{width:1440px;height:900px;padding:40px 48px}
.sh h1{font-size:36px}.sh p{font-size:18px;color:var(--ink2);margin-top:6px}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:28px}
.lab{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:18px;font-weight:650}
.lab .n{font-size:14px;font-weight:700;color:#fff;background:var(--accent);border-radius:7px;padding:2px 8px}
.win{height:640px;border-radius:24px;background:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(20,20,50,.12);display:flex;flex-direction:column;overflow:hidden}
.wt{height:56px;display:flex;align-items:center;gap:10px;padding:0 20px;border-bottom:1px solid var(--line);background:#FBFBFD;font-size:17px;font-weight:650}
.wt .tm{width:28px;height:28px;border-radius:8px;background:var(--tint);color:var(--accent);display:grid;place-items:center}
.wt .tm svg{width:16px;height:16px}
.st{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 34px 20px}
.art{width:120px;height:120px;border-radius:36px;display:grid;place-items:center}
.art svg.i{width:56px;height:56px;stroke-width:1.8}
.st h2{font-size:27px;font-weight:700;margin-top:26px;letter-spacing:-.025em;line-height:1.2}
.st p{font-size:18.5px;color:var(--ink2);margin-top:10px;line-height:1.45}
.st .btn{width:100%;margin-top:26px;height:64px;font-size:20px}
.st .btn + .btn{margin-top:12px}
.st .tip{font-size:16px;color:var(--ink3);margin-top:16px}
.ghosts{display:flex;gap:10px;margin-bottom:22px;opacity:.5}
.ghosts div{width:54px;height:96px;border-radius:12px;background:repeating-linear-gradient(135deg,#E2E2EA 0 8px,#ECECF2 8px 16px)}
'''
b24 = f'''<div class="sheet"><div class="sh"><h1>Cuando algo falta o falla</h1><p>Siempre una frase clara, qué hacer y un solo botón principal. Nunca un callejón sin salida.</p></div>
<div class="g3">
<div><div class="lab"><span class="n">1</span>Vacío</div><div class="win"><div class="wt"><span class="tm">{ic("results")}</span>Mis resultados</div><div class="st">
<div class="ghosts"><div></div><div></div><div></div></div><div class="art" style="background:var(--tint);color:var(--accent)">{ic("scissors")}</div>
<h2>Aún no tienes clips</h2><p>Haz el primero en 1 minuto. Solo pega el enlace de tu stream.</p><button class="btn btn-primary">{ic("scissors")}Hacer mi primer clip</button></div></div></div>
<div><div class="lab"><span class="n">2</span>Error</div><div class="win"><div class="wt"><span class="tm">{ic("scissors")}</span>Hacer clips</div><div class="st">
<div class="art" style="background:var(--warn-tint);color:var(--warn)">{ic("link")}</div>
<h2>No pudimos leer ese enlace</h2><p>Revisa que el video sea público y vuelve a pegarlo.</p><button class="btn btn-primary">{ic("refresh")}Intentar otra vez</button>
<button class="btn btn-secondary" style="color:var(--ok);box-shadow:inset 0 0 0 1.5px #BFE6CD">{ic("chat")}Hablar con una persona</button><div class="tip">No se usaron créditos.</div></div></div></div>
<div><div class="lab"><span class="n">3</span>Falta un paso</div><div class="win"><div class="wt"><span class="tm">{ic("scissors")}</span>Hacer clips</div><div class="st">
<div class="art" style="background:#FFEEF0">{YT.replace('width="34" height="24"','width="64" height="46"')}</div>
<h2>Te falta conectar YouTube</h2><p>Así podemos traer tus streams y hacer tus clips solos. Toma 30 segundos.</p><button class="btn btn-primary">Conectar ahora</button>
<div class="tip">O pega un enlace, sin conectar nada.</div></div></div></div>
</div></div>'''
write("24-vacio-y-error.html", page2("Vacío y error", b24, css24))

# ---- 25 ayuda
css25 = '''
.main{padding-top:44px}
.hum{margin-top:24px;display:flex;align-items:center;gap:24px;padding:28px 30px;border-radius:26px;background:#fff;box-shadow:0 0 0 2px var(--ok),var(--shadow-lg)}
.hum .hi{width:76px;height:76px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;flex:none}
.hum .hi svg{width:38px;height:38px}
.hum h2{font-size:28px}.hum p{font-size:18.5px;color:var(--ink2);margin-top:4px}
.hum .bs{margin-left:auto;display:flex;gap:12px}
.hum .bs .btn{height:64px;font-size:20px}
.btn-okl{background:#fff;color:var(--ok);box-shadow:inset 0 0 0 1.5px #BFE6CD}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:30px}
.cols .ghead{padding-left:6px}
.qs .row{min-height:64px}
.qs .row .tx b{font-size:18.5px}
.vg{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.vd{background:#fff;border-radius:20px;box-shadow:var(--shadow);padding:10px 10px 14px}
.vd b{display:block;font-size:17px;font-weight:650;margin:10px 6px 0;line-height:1.3}
.vd small{display:block;font-size:15px;color:var(--ink3);margin:2px 6px 0}
'''
QS = ["¿Cómo hago mis primeros clips?","¿Cómo conecto YouTube o Twitch?","¿Qué son los créditos?","¿Cómo cambio o cancelo mi plan?","Tengo un problema con un cobro"]
VIDS = [("Haz tus clips en 1 minuto","2 min"),("Recibe señales en WhatsApp","3 min"),("Conecta OBS a En vivo","4 min"),("Conoce tu Asistente","3 min")]
vg = "".join(f'<div class="vd">{thumb(k+1,160,112,radius=14,playsize=40).replace("width:160px;height:112px","width:100%;height:112px")}<b>{t}</b><small>Video · {d}</small></div>' for k,(t,d) in enumerate(VIDS))
qs = "".join(f'<div class="row"><div class="tx"><b>{q}</b></div>{ic("chev","i chev")}</div>' for q in QS)
b25 = f'''<div class="app">{sidebar("cuenta")}<main class="main"><div class="wrap">
<div class="eyebrow">Mi cuenta ›</div><h1>Ayuda</h1><p class="sub" style="margin-top:6px">Aquí estamos para ayudarte, en español.</p>
<div class="hum"><div class="hi">{ic("chat")}</div><div><h2>Hablar con una persona</h2><p>Te respondemos en minutos. Sin robots, sin esperas largas.</p></div>
<div class="bs"><button class="btn btn-ok">{ic("phone")}WhatsApp</button><button class="btn btn-okl">{ic("chat")}Chat aquí</button></div></div>
<div class="cols"><div><div class="ghead">Preguntas comunes</div><div class="group qs">{qs}</div></div>
<div><div class="ghead">Videos para aprender</div><div class="vg">{vg}</div></div></div></div></main></div>'''
write("25-ayuda.html", page2("Ayuda", b25, css25))

# ---- 26 notificaciones (móvil)
css26 = css08 + '''
.nh{padding:6px 16px 0;display:flex;align-items:center;justify-content:space-between}
.nh .bk{display:flex;align-items:center;gap:2px;font-size:17px;font-weight:600;color:var(--accent)}
.nh .bk svg.i{width:24px;height:24px}
.nh a{font-size:16px;color:var(--accent);font-weight:600}
.nt{padding:10px 20px 0}
.nt h1{font-size:34px}
.sec{padding:16px 20px 6px;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink3)}
.nl{display:flex;flex-direction:column;gap:8px;padding:0 12px}
.nf{display:flex;gap:12px;padding:14px 14px;border-radius:20px;background:#fff;box-shadow:var(--shadow);position:relative}
.nf .ni{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;color:#fff;flex:none}
.nf .ni svg.i{width:22px;height:22px}
.nf .tx{flex:1;min-width:0}
.nf .t1{display:flex;align-items:baseline;gap:8px}
.nf b{font-size:16.5px;font-weight:650;flex:1;line-height:1.25}
.nf time{font-size:13.5px;color:var(--ink3);white-space:nowrap}
.nf p{font-size:15px;color:var(--ink2);margin-top:2px;line-height:1.35}
.nf.un::after{content:"";position:absolute;left:5px;top:50%;width:7px;height:7px;border-radius:50%;background:var(--accent);transform:translateY(-50%)}
'''
def nf(icon, col, title, body, t, un=False):
    return f'<div class="nf{" un" if un else ""}"><div class="ni" style="background:{col}">{ic(icon)}</div><div class="tx"><div class="t1"><b>{title}</b><time>{t}</time></div><p>{body}</p></div></div>'
b26 = f'''<div class="phone">{statusbar()}<div class="nh"><span class="bk">{ic("chevl")}Inicio</span><a>Marcar como leídos</a></div>
<div class="nt"><h1>Avisos</h1></div><div class="sec">Hoy</div><div class="nl">
{nf("scissors","#5B4BFF","Tus clips están listos","Hicimos 6 clips de “Noche de preguntas”. Ya tienen subtítulos.","8:40 p.m.",True)}
{nf("clock","#FF9F0A","Tu prueba termina en 7 días",f"El {COBRO} se cobrarán $7,490 MXN. Puedes cancelar en 1 clic.","9:00 a.m.",True)}
{nf("trend","#C77700","Bitcoin: buen momento para comprar","Informativo, no es asesoría financiera.","7:15 a.m.")}</div>
<div class="sec">Esta semana</div><div class="nl">
{nf("live","#FF375F","Tu transmisión terminó","Duró 2 h 14 min. ¿Hacemos clips?","mar.")}
{nf("bot","#30B0C7","Tu Asistente respondió 12 mensajes","Tus clientes ya tienen respuesta.","lun.")}</div>
<nav class="tabs"><div class="tab">{ic("home")}Inicio</div><div class="tab">{ic("results")}Resultados</div><div class="tab">{ic("user")}Cuenta</div></nav>
<div class="homebar"></div></div>'''
write("26-notificaciones.html", page2("Notificaciones", b26, css26))

# ---- 30 mi plan (Pro anual pagado)
css30 = css07 + '''
.main{padding-top:40px}
.crumb{font-size:18px;color:var(--ink2);margin-bottom:4px}
.cols{margin-top:22px}
.plan .pb .btn{height:50px}
.plan .big{font-size:30px;font-weight:750;letter-spacing:-.03em;margin-top:14px;position:relative;z-index:1}
.plan .big span{font-size:17px;font-weight:600;opacity:.85;letter-spacing:0}
.row .val b{color:var(--ink);font-weight:650}
.act{font-size:17px;color:var(--accent);font-weight:600;white-space:nowrap}
.cancel b{color:var(--bad)!important}
.rowsub{font-size:15px;color:var(--ink3)}
'''
b30 = f'''<div class="app">{sidebar("cuenta")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="cols"><div class="colx">
<div class="plan"><div class="k">Tu plan · Activo</div><h2>Pro anual — todo incluido</h2><p>Se renueva cada año.<br>Próximo cobro: 30 de octubre de 2027</p>
<div class="big">$7,490 <span>MXN al año</span></div><div class="pb"><span class="inc">{ic("check")}Las 7 herramientas</span><button class="btn">Cambiar plan</button></div></div>
<div><div class="ghead">Próximo cobro</div><div class="group">
{grow(icb("cal","#5B4BFF"),"30 de octubre de 2027",'<span class="val"><b>$7,490 MXN</b></span>',"Aviso por correo 30 y 7 días antes")}
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Visa ••4821</span>',"Vence 08/29")}
<div class="row cred" style="display:block"><div class="top">{icb("coins","#FF9F0A")}<div class="tx"><b>Créditos de este mes</b></div><span class="num">1,200</span></div>
<div class="meter"><i></i></div><div class="mt"><span>Usaste 800 de 2,000</span><span>Se renuevan el día 30 de cada mes</span></div></div></div></div></div>
<div class="colx"><div><div class="ghead">Cambiar de plan</div><div class="group">
{grow(icb("swap","#0A84FF"),"Pasar a Pro mensual",'<span class="act">$749/mes</span>',"Empieza cuando termine tu año pagado")}
{grow(icb("star","#AF52DE"),"Subir a VIP",'<span class="act">$2,499/mes</span>',"Se aplica hoy; te mostramos el ajuste antes")}
{grow(icb("down","#8E8E93"),"Pasar a Gratis",'<span class="act">$0</span>',"Al terminar tu año pagado")}</div></div>
<div><div class="ghead">Facturas</div><div class="group">
{grow(icb("receipt","#8E8E93"),"30 de octubre de 2026",'<span class="val">$7,490 · CFDI</span>',"Pro anual")}</div></div>
<div><div class="group"><div class="row cancel">{icb("x","#FF3B30")}<div class="tx"><b>Cancelar suscripción</b><small>1 clic, sin llamadas. Sigues con Pro hasta el 30 de octubre de 2027.</small></div>{ic("chev","i chev")}</div></div></div>
</div></div></div></main></div>'''
write("30-mi-plan.html", page2("Mi plan", b30, css30))
