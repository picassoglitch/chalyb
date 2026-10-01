# ===================== SIGNUP + TRIAL 13-18 =====================
GOOGLE = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335"/></svg>'
SU = '''
.flow{min-height:900px}
.two{display:grid;grid-template-columns:560px 440px;gap:56px;justify-content:center;margin-top:18px}
.fcard{background:#fff;border-radius:28px;box-shadow:var(--shadow-lg);padding:26px 40px 24px}
.fcard h1{font-size:34px}
.fcard .sub{font-size:18px;margin-top:6px}
.gbtn{margin-top:18px;width:100%;height:64px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1.5px #DCDCE3;display:flex;align-items:center;justify-content:center;gap:14px;font-size:20px;font-weight:600}
.or{display:flex;align-items:center;gap:16px;margin:14px 0 0;color:var(--ink3);font-size:16px;font-weight:500}
.or::before,.or::after{content:"";flex:1;height:1px;background:#E3E3E9}
.fcard .field{margin-top:10px}
.fcard .field label{margin-bottom:6px;font-size:16px}
.fcard .field .in{height:52px}
.legal{font-size:15.5px;color:var(--ink2);margin-top:14px;line-height:1.5}
.legal a{color:var(--accent);font-weight:600;text-decoration:underline;text-underline-offset:2px}
.have{text-align:center;font-size:17px;color:var(--ink2);margin-top:16px}
.have a{color:var(--accent);font-weight:650}
.recap{border-radius:28px;background:linear-gradient(150deg,#6B5CFF 0%,#5B4BFF 55%,#4632E6 100%);color:#fff;padding:34px;position:relative;overflow:hidden;box-shadow:0 18px 44px rgba(91,75,255,.30);align-self:start}
.recap::after{content:"";position:absolute;right:-70px;top:-90px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.10)}
.recap .k{font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.85}
.recap h2{color:#fff;font-size:30px;margin-top:8px}
.recap ul{list-style:none;margin-top:20px;display:flex;flex-direction:column;gap:11px}
.recap li{display:flex;align-items:center;gap:12px;font-size:18px;font-weight:550}
.recap li .c{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center;flex:none}
.recap li .c svg{width:15px;height:15px;stroke-width:3}
.recap .zero{margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,.22);display:flex;align-items:baseline;justify-content:space-between}
.recap .zero span{font-size:18px;opacity:.9}.recap .zero b{font-size:34px;font-weight:750;letter-spacing:-.03em}
.recap small{display:block;font-size:15.5px;opacity:.85;margin-top:6px}
'''
def recap_panel():
    tools = "".join(f'<li><span class="c">{ic("check")}</span>{n}</li>' for n,_,_,_ in TOOLS)
    return f'''<div class="recap"><div class="k">Tu mes de Pro gratis</div><h2>Todo incluido</h2><ul>{tools}</ul>
<div class="zero"><span>Hoy pagas</span><b>$0</b></div><small>Te avisamos 7 días antes de cualquier cobro. Cancela en 1 clic.</small></div>'''
# ---- 13 crear cuenta
b13 = f'''<div class="flow">{wtop("Atrás","Prueba Pro gratis","gift",step=1)}
<div class="two"><div class="fcard"><h1>Crea tu cuenta</h1><p class="sub">Toma 1 minuto. No necesitas tarjeta en este paso.</p>
<button class="gbtn">{GOOGLE}Continuar con Google</button><div class="or">o con tu correo</div>
<div class="field"><label>Tu nombre</label><div class="in val">María</div></div>
<div class="field"><label>Correo</label><div class="in focus val">maria.lopez@correo.mx</div></div>
<div class="field"><label>Contraseña</label><div class="in">Mínimo 8 letras o números<span style="margin-left:auto">{ic("eye")}</span></div></div>
<button class="btn btn-primary btn-xl" style="margin-top:18px">Crear cuenta</button>
<p class="legal">Al crear tu cuenta aceptas los <a>Términos y Condiciones</a> y la <a>Política de Uso Aceptable</a>, y confirmas que leíste el <a>Aviso de Privacidad</a>. Debes tener 18 años o más.</p>
<div class="cbx" style="margin-top:14px;font-size:16px"><span class="b"></span><span>Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera.</span></div>
</div>
<div>{recap_panel()}<div class="have" style="margin-top:22px;font-size:19px">¿Ya tienes cuenta? <a>Entrar</a></div></div></div></div>'''
write("13-crear-cuenta.html", page2("Crear cuenta", b13, SU))

# ---- 14 tu prueba
css14 = SU + '''
.col{max-width:860px}
.title{text-align:center;margin-top:16px}
.q{font-size:24px;font-weight:650;letter-spacing:-.02em;margin-top:16px;text-align:center}
.opts{display:grid;grid-template-columns:1.15fr 1fr;gap:18px;margin-top:14px}
.op{position:relative;background:#fff;border-radius:24px;box-shadow:var(--shadow);padding:22px 26px 22px 74px;min-height:160px}
.op .rd{position:absolute;left:24px;top:26px;width:32px;height:32px;border-radius:50%;box-shadow:inset 0 0 0 2px #CFCFD8;background:#fff}
.op.sel{box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.op.sel .rd{box-shadow:inset 0 0 0 10px var(--accent)}
.op h3{font-size:21px;font-weight:650}
.op .amt{font-size:34px;font-weight:750;letter-spacing:-.035em;margin-top:6px}
.op .amt span{font-size:19px;font-weight:600;color:var(--ink2);letter-spacing:-.01em}
.op .eq{font-size:17px;color:var(--ink2);margin-top:2px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.op .tags{display:flex;gap:8px;margin-top:10px}
.strike{text-decoration:line-through;color:var(--ink3)}
.disc{margin-top:14px;font-size:17px;padding:16px 22px}
.foot{margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:8px;padding-bottom:16px}
.foot .btn-xl{max-width:520px}
.foot small{font-size:16px;color:var(--ink2)}
'''
DISC_14 = f'''<div class="disc"><div class="di">{ic("info")}</div><div>
<p><b>Hoy pagas $0.</b> Tu mes gratis termina el <b>{FIN}</b>.</p>
<p>Si no cancelas antes, el <b>{COBRO}</b> se cobrarán <b>$7,490 MXN</b> por 1 año de Pro a la tarjeta que registres, y se renovará automáticamente cada año ($7,490 MXN) hasta que canceles.</p>
<p>Te avisaremos por correo el <b>{RECORD}</b> (7 días antes).</p>
<p>Cancela en 1 clic desde <b>Mi cuenta → Mi plan</b>, sin llamadas. Si cancelas, sigues con Pro hasta el {FIN} y no se te cobra nada.</p></div></div>'''
b14 = f'''<div class="flow">{wtop("Atrás","Prueba Pro gratis","gift",step=2)}<div class="col">
<div class="title"><h1>Prueba Pro gratis 1 mes</h1><p class="sub">Todas las herramientas incluidas. Cancela cuando quieras.</p></div>
<div class="q">¿Qué plan quieres cuando termine tu mes gratis?</div>
<div class="opts"><div class="op sel"><div class="rd"></div><h3>Pro anual</h3><div class="amt">$7,490 <span>MXN al año</span></div>
<div class="eq">(equivale a $624 al mes)</div><div class="eq"><b style="color:var(--ink)">Se renueva cada año</b></div><div class="tags"><span class="pill acc">Recomendado</span><span class="pill dark">Ahorras $1,498 al año</span></div></div>
<div class="op"><div class="rd"></div><h3>Pro mensual</h3><div class="amt">$749 <span>MXN al mes</span></div><div class="eq">&nbsp;</div><div class="eq"><b style="color:var(--ink)">Se renueva cada mes</b></div></div></div>
{DISC_14}
<div class="foot"><button class="btn btn-primary btn-xl">Continuar al pago</button><small>Precios en MXN, IVA incluido.</small></div></div></div>'''
write("14-tu-prueba.html", page2("Tu prueba", b14, css14))

# ---- 15 pago
css15 = SU + '''
.two{grid-template-columns:600px 440px;margin-top:10px;gap:44px}
.lh h1{font-size:36px}
.lh .sub{font-size:18px;margin-top:4px}
.one{margin-top:14px;display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:16px;background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF;font-size:17.5px}
.one svg.i{color:var(--accent)}
.mp{margin-top:12px;background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:16px 22px 18px;border:1px solid #E3EEFA}
.mp .mh{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:650;color:#2D5F8F;padding-bottom:12px;border-bottom:1px dashed #D6E4F2}
.mp .mh .mb{height:26px;padding:0 10px;border-radius:13px;background:#E6F3FF;color:#1B66B1;display:flex;align-items:center;font-size:13.5px;font-weight:700}
.mp .mh .cards{margin-left:auto;display:flex;gap:6px}
.mp .mh .cards span{font-size:12px;font-weight:800;padding:3px 7px;border-radius:5px;background:#F2F4F7;color:#4A5568;letter-spacing:.02em}
.mp .field{margin-top:10px}
.mp .field label{font-size:15.5px;margin-bottom:6px;color:#3A4250}
.mp .field .in{height:52px;border-radius:12px;font-size:18px}
.mp .r2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mpn{font-size:15px;color:var(--ink2);margin-top:10px;display:flex;align-items:center;gap:8px}
.mpn svg.i{width:17px;height:17px}
.cons{margin-top:12px;padding:14px 18px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 2px #DAD6FF;font-size:17px;color:var(--ink)}
.cons .b{box-shadow:inset 0 0 0 2px var(--accent)}
.cons a{color:var(--accent);font-weight:650;text-decoration:underline;text-underline-offset:2px}
.go{margin-top:12px}
.go .btn-xl{opacity:.42;box-shadow:none}
.go small{display:block;text-align:center;font-size:15.5px;color:var(--ink2);margin-top:8px}
.sum{background:#fff;border-radius:26px;box-shadow:var(--shadow-lg);padding:28px;align-self:start;margin-top:58px}
.sum h3{font-size:22px;font-weight:700}
.sum .rw{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 0;border-bottom:1px solid var(--line);font-size:17.5px}
.sum .rw span:first-child{color:var(--ink2)}
.sum .rw b{font-weight:650;text-align:right;white-space:nowrap}
.sum .rw small{display:block;font-size:15px;color:var(--ink3);margin-top:2px}
.sum .tot{display:flex;justify-content:space-between;align-items:baseline;margin-top:16px}
.sum .tot span{font-size:19px;font-weight:650}.sum .tot b{font-size:40px;font-weight:750;letter-spacing:-.03em}
.sum .chg{display:block;margin-top:12px;font-size:16.5px}
'''
b15 = f'''<div class="flow">{wtop("Atrás","Prueba Pro gratis","gift",step=3)}
<div class="two"><div class="lh"><h1>Agrega tu tarjeta</h1>
<div class="one">{ic("info")}<span>Hoy pagas <b>$0</b>. Primer cobro: <b>$7,490 MXN</b> el <b>{COBRO}</b> y después <b>cada año</b>, salvo que canceles antes.</span></div>
<div class="mp"><div class="mh"><span class="mb">Mercado Pago</span>Formulario seguro de pago<span class="cards"><span>VISA</span><span>MASTERCARD</span><span>AMEX</span></span></div>
<div class="field"><label>Número de tarjeta</label><div class="in">1234 5678 9012 3456</div></div>
<div class="r2"><div class="field"><label>Vencimiento</label><div class="in">MM/AA</div></div><div class="field"><label>Código de seguridad</label><div class="in">3 dígitos</div></div></div>
<div class="field"><label>Nombre como aparece en la tarjeta</label><div class="in">María López</div></div></div>
<div class="mpn">{ic("lock")}Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta.<a class="lnk" style="margin-left:auto;font-size:15px;white-space:nowrap">Quién vende</a></div>
<div class="cons cbx"><span class="b"></span><span>Acepto que, si no cancelo antes del <b>{COBRO}</b>, Chalyb cobre automáticamente <b>$7,490 MXN</b> y cada año después a mi tarjeta, y acepto los <a>Términos de Suscripción</a>.</span></div>
<div class="go"><button class="btn btn-primary btn-xl">Empezar mi mes gratis</button><small>Marca la casilla para continuar. Puedes cancelar cuando quieras.</small></div></div>
<div class="sum"><h3>Resumen</h3>
<div class="rw"><span>Plan al terminar la prueba</span><b>Pro anual</b></div>
<div class="rw"><span>Tu mes gratis termina</span><b>{FIN}</b></div>
<div class="rw"><span>Te avisamos por correo</span><b>{RECORD}</b></div>
<div class="rw"><span>Primer cobro<small>{COBRO}</small></span><b>$7,490 MXN</b></div>
<div class="rw" style="border-bottom:0"><span>Después</span><b>$7,490 MXN cada año</b></div>
<div class="tot"><span>Total hoy</span><b>$0</b></div><a class="lnk chg">Cambiar a Pro mensual ($749/mes)</a></div></div></div>'''
write("15-pago.html", page2("Pago", b15, css15))

# ---- 16 listo
css16 = SU + '''
.col{max-width:760px;text-align:center}
.okc{width:104px;height:104px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;margin:22px auto 0;box-shadow:0 0 0 12px var(--ok-tint)}
.okc svg{width:54px;height:54px;stroke-width:3}
.col h1{margin-top:28px;font-size:40px}
.col .sub{font-size:20px;margin-top:10px}
.rc{margin-top:26px;text-align:left}
.rc .row{min-height:62px}
.rc .row .val{color:var(--ink);font-weight:650;font-size:18px}
.rc .row + .row::before{left:74px}
.cta{margin-top:24px}
.cta .btn-xl{max-width:520px}
.cta .lnk{display:inline-block;margin-top:16px;font-size:18px}
.mailn{margin-top:16px;font-size:16px;color:var(--ink3)}
'''
b16 = f'''<div class="flow"><header class="topbar" style="position:relative"><span></span><div class="toptitle">{logo().replace('class="logo "','class="logo" style="padding:0"')}</div><button class="close">{ic("x")}</button></header>
<div class="col"><div class="okc">{ic("check")}</div><h1>¡Listo, María!<br>Tu mes de Pro gratis ya empezó.</h1>
<p class="sub">Termina el {FIN}. Primer cobro: <b>$7,490 MXN</b> el {COBRO} a tu tarjeta ••4821.</p>
<div class="group rc">
<div class="row"><div class="ic" style="background:#34C759">{ic("check")}</div><div class="tx"><b>Hoy pagaste</b></div><span class="val">$0</span></div>
<div class="row"><div class="ic" style="background:#5B4BFF">{ic("cal")}</div><div class="tx"><b>Tu mes gratis termina</b></div><span class="val">{FIN}</span></div>
<div class="row"><div class="ic" style="background:#FF9F0A">{ic("mail")}</div><div class="tx"><b>Te avisamos por correo</b></div><span class="val">{RECORD}</span></div>
<div class="row"><div class="ic" style="background:#8E8E93">{ic("card")}</div><div class="tx"><b>Primer cobro (Pro anual)</b><small>Visa ••4821 · se renueva cada año hasta que canceles</small></div><span class="val">$7,490 MXN</span></div></div>
<div class="cta"><button class="btn btn-primary btn-xl">{ic("scissors")}Hacer mis primeros clips</button><br><a class="lnk">Ver mi plan</a></div>
<p class="mailn">Te enviamos estos datos a maria.lopez@correo.mx · Folio de tu aceptación: 8F3C-2A1E</p></div></div>'''
write("16-listo.html", page2("Listo", b16, css16))

# ---- 17 banners
css17 = '''
body{background:#ECECF1}
.sheet{width:1440px;padding:44px 56px 56px}
.sh{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:26px}
.sh h1{font-size:36px}.sh p{font-size:18px;color:var(--ink2);margin-top:6px}
.fr{margin-top:22px}
.fr .lab{display:flex;align-items:center;gap:10px;margin-bottom:10px;font-size:18px;font-weight:650}
.fr .lab .n{font-size:14px;font-weight:700;color:#fff;background:var(--accent);border-radius:7px;padding:2px 8px}
.fr .lab small{font-size:16px;font-weight:500;color:var(--ink2)}
.win{border-radius:20px;overflow:hidden;background:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(20,20,50,.10);position:relative}
.ghost{display:flex;height:150px;opacity:.45;filter:saturate(.6);pointer-events:none}
.ghost .gs{width:272px;background:#FBFBFD;border-right:1px solid var(--line);padding:22px 20px}
.ghost .gs .logo{padding:0 12px 22px}
.ghost .gs .nv{height:48px;border-radius:14px;background:var(--tint);margin-bottom:8px}
.ghost .gs .nv.o{background:#F0F0F4}
.ghost .gm{flex:1;padding:28px 64px}
.ghost .gm .e{font-size:18px;color:var(--ink2)}
.ghost .gm h1{font-size:34px;margin-top:4px}
.ghost .gm .cards{display:flex;gap:18px;margin-top:20px}
.ghost .gm .cards div{flex:1;height:60px;border-radius:18px;background:#fff;box-shadow:var(--shadow)}
.bnr{position:relative;z-index:2}
.rules{margin-top:26px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.rules div{background:#fff;border-radius:18px;padding:16px 18px;font-size:16px;color:var(--ink2);box-shadow:var(--shadow)}
.rules b{display:block;font-size:17px;color:var(--ink);margin-bottom:4px}
'''
ghost = f'''<div class="ghost"><div class="gs">{logo()}<div class="nv"></div><div class="nv o"></div></div>
<div class="gm"><div class="e">Hola, María 👋</div><h1>¿Qué quieres hacer hoy?</h1><div class="cards"><div></div><div></div></div></div></div>'''
BN = [
 ("1","Prueba activa","Tranquilo, siempre visible, sin alarma", banner("trial","<b>Prueba Pro gratis</b> · te quedan 12 días","Ver mi plan")),
 ("2","Últimos 7 días","Ámbar, del día 23 al 30 de la prueba", banner("warn",f"Tu prueba termina el <b>{FIN}</b>. Se cobrarán <b>$7,490 MXN</b> el <b>{COBRO}</b>.","Ver mi plan")),
 ("3","Prueba terminada o cancelada","Neutral, una sola invitación a volver", banner("gray","Tu prueba terminó. Estás en el plan Gratis.","Volver a Pro")),
 ("4","Pago pendiente","Rojo, solo cuando falla el cobro", banner("bad",f"No pudimos cobrar tu plan. Actualiza tu tarjeta antes del <b>{GRACIA}</b> para no perder Pro.","Actualizar tarjeta")),
]
fr = "".join(f'<div class="fr"><div class="lab"><span class="n">{n}</span>{t}<small>· {d}</small></div><div class="win">{b}{ghost}</div></div>' for n,t,d,b in BN)
b17 = f'''<div class="sheet"><div class="sh"><div><h1>Avisos de tu prueba</h1><p>Una línea y un botón, arriba de todo. Solo se ve uno a la vez.</p></div></div>{fr}
<div class="rules"><div><b>Siempre una línea</b>Fecha y monto en negritas, sin letra chiquita.</div><div><b>Un solo botón</b>Lleva directo a Mi plan o a cambiar la tarjeta.</div>
<div><b>No se puede ocultar</b>Los avisos 2 y 4 se quedan hasta que pasen.</div><div><b>Mismo texto que el correo</b>El aviso 2 sale el mismo día que el correo de 7 días.</div></div></div>'''
write("17-banners.html", page2("Banners", b17, css17))

# ---- 18 cancelar
css18 = '''
body{background:#ECECF1}
.sheet{width:1440px;height:900px;padding:36px 48px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
.fr .lab{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:18px;font-weight:650}
.fr .lab .n{font-size:14px;font-weight:700;color:#fff;background:var(--accent);border-radius:7px;padding:2px 8px}
.win{position:relative;height:790px;border-radius:22px;overflow:hidden;background:var(--bg);box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px rgba(20,20,50,.12)}
.mp{padding:32px 34px}
.mp h1{font-size:34px}
.mp .crumb{font-size:17px;color:var(--ink2);margin-bottom:6px}
.mp .plan{margin-top:20px;padding:24px;border-radius:22px;background:linear-gradient(135deg,#6B5CFF 0%,#5B4BFF 50%,#4632E6 100%);color:#fff}
.mp .plan .k{font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;opacity:.85}
.mp .plan h2{color:#fff;font-size:26px;margin-top:6px}.mp .plan p{font-size:17px;opacity:.9;margin-top:4px}
.mp .group{margin-top:18px}
.mp .row .val{font-size:17px}
.mp .cancel b{color:var(--bad)!important}
.sc{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:540px}
.sc h2{font-size:30px;font-weight:700;letter-spacing:-.025em}
.sc p{font-size:19px;color:var(--ink2);margin-top:12px;line-height:1.5}
.sc p b{color:var(--ink)}
.sc .acts{display:flex;flex-direction:column;gap:12px;margin-top:24px}
.sc .acts .btn{width:100%;height:64px;font-size:20px}
.sc .acts.two2{flex-direction:row}
.sc .acts.two2 .btn{flex:1;box-shadow:none}
.btn-dark{background:var(--ink);color:#fff}
.sc .off{margin-top:18px;padding:14px 16px;border-radius:16px;background:var(--bg);font-size:16.5px;color:var(--ink2);display:flex;align-items:center;gap:10px}
.sc .off svg.i{color:var(--accent);width:22px;height:22px}
.sc .off a{margin-left:auto;white-space:nowrap}
.done{text-align:center}
.done .okc{width:88px;height:88px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;margin:0 auto 18px;box-shadow:0 0 0 10px var(--ok-tint)}
.done .okc svg{width:46px;height:46px;stroke-width:3}
.done .fol{margin-top:14px;font-size:16px;color:var(--ink3)}
'''
mi_plan_bg = f'''<div class="mp"><div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="plan"><div class="k">Tu plan</div><h2>Prueba Pro gratis</h2><p>Te quedan 12 días · termina el {FIN}</p></div>
<div class="group"><div class="row"><div class="ic" style="background:#5B4BFF">{ic("cal")}</div><div class="tx"><b>Después de la prueba</b><small>Pro anual · $7,490 MXN al año</small></div><span class="val" style="color:var(--accent);font-weight:600">Cambiar</span></div>
<div class="row"><div class="ic" style="background:#34C759">{ic("card")}</div><div class="tx"><b>Tarjeta</b></div><span class="val">Visa ••4821</span></div>
<div class="row"><div class="ic" style="background:#FF9F0A">{ic("coins")}</div><div class="tx"><b>Créditos</b><small>Usaste 350 de 2,000 este mes</small></div></div>
<div class="row"><div class="ic" style="background:#8E8E93">{ic("doc")}</div><div class="tx"><b>Facturas</b></div><span class="val">Ninguna aún</span></div></div>
<div class="group" style="margin-top:14px"><div class="row cancel"><div class="ic" style="background:#FF3B30">{ic("x")}</div><div class="tx"><b>Cancelar prueba</b><small>1 clic, sin llamadas</small></div></div></div></div>'''
s18a = f'''<div class="sheetc sc"><h2>¿Cancelar tu prueba?</h2>
<p>Seguirás teniendo Pro hasta el <b>{FIN}</b>. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados.</p>
<div class="off">{ic("swap")}<span>¿Prefieres pagar mes a mes?</span><a class="lnk">Cambiar a $749/mes</a></div>
<div class="acts two2"><button class="btn btn-dark">Sí, cancelar</button><button class="btn btn-primary">Seguir con Pro</button></div></div>'''
s18b = f'''<div class="sheetc sc done"><div class="okc">{ic("check")}</div><h2>Listo, cancelaste.</h2>
<p>No se te volverá a cobrar. Tienes Pro hasta el <b>{FIN}</b>.<br>Si cambias de opinión, puedes volver a activar Pro en cualquier momento.</p>
<div class="acts"><button class="btn btn-primary">Volver a Inicio</button><button class="btn btn-secondary">Volver a activar Pro</button></div>
<div class="fol">Folio: CAN-20261018-4821 · Te enviamos la confirmación a maria.lopez@correo.mx</div></div>'''
b18 = f'''<div class="sheet"><div class="fr"><div class="lab"><span class="n">1</span>Confirmar (1 pantalla, sin laberintos)</div><div class="win">{mi_plan_bg}<div class="dim"></div>{s18a}</div></div>
<div class="fr"><div class="lab"><span class="n">2</span>Hecho</div><div class="win">{mi_plan_bg.replace("Prueba Pro gratis</h2><p>Te quedan 12 días","Pro hasta el "+FIN+"</h2><p>Cancelado · no habrá más cobros")}<div class="dim"></div>{s18b}</div></div></div>'''
write("18-cancelar.html", page2("Cancelar", b18, css18))
