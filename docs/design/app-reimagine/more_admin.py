# ===================== ADMIN 27-29 (/dashboard) =====================
def adminside(active):
    items = [("centro","gauge","Centro de mando"),("personas","users","Personas"),("dinero","money","Dinero"),
             ("herr","grid","Herramientas"),("act","activity","Actividad"),("ajustes","gear","Ajustes")]
    nav = "".join(f'<a class="{"on" if k==active else ""}">{ic(i)}<span>{t}</span></a>' for k,i,t in items)
    return f'''<aside class="side">{logo()}<div class="own">Panel del dueño</div><nav class="nav">{nav}</nav>
<div class="me"><div class="avatar" style="background:linear-gradient(135deg,#7B6CFF,#3F2FE0)">DC</div><div><div class="n">Dueño</div><div class="p">Ver la app ›</div></div></div></aside>'''
ADM = '''
.side .logo{padding-bottom:12px}
.own{margin:0 12px 22px;align-self:flex-start;font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink2);background:#EEEEF2;padding:5px 10px;border-radius:8px}
.nav a{height:54px;font-size:19px;margin-bottom:4px}
.main{padding:40px 56px 32px}
.wrap{max-width:1060px}
.hrow{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.hrow .sub{margin-top:6px;font-size:19px}
.seg2{display:flex;background:#E6E6EC;border-radius:14px;padding:4px;gap:4px}
.seg2 span{height:42px;padding:0 16px;display:grid;place-items:center;border-radius:11px;font-size:16px;font-weight:600;color:var(--ink2)}
.seg2 span.on{background:#fff;color:var(--ink);box-shadow:0 2px 6px rgba(0,0,0,.08)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin-top:24px}
.kpi{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:20px 22px}
.kpi .kt{font-size:16.5px;font-weight:600;color:var(--ink2);white-space:nowrap}
.kpi .kv{white-space:nowrap;font-size:33px;font-weight:750;letter-spacing:-.035em;margin-top:10px;font-variant-numeric:tabular-nums}
.kpi .kv span{font-size:17px;font-weight:600;color:var(--ink3);letter-spacing:0}
.kpi .kd{font-size:15.5px;color:var(--ink2);margin-top:8px;line-height:1.6}
.kpi .kd .tag-ej{font-size:11.5px;padding:1px 6px;margin-right:4px;vertical-align:1px}
.kpi .kd b{color:var(--accent)}
.kpi .kd b.bad{color:var(--bad)}
.c2{display:grid;grid-template-columns:1.1fr .9fr;gap:22px;margin-top:22px;align-items:start}
.gh2{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 4px;font-size:18px;font-weight:650}
.gh2 a{font-size:16px;color:var(--accent);font-weight:600}
.row .btn{height:44px;font-size:16px;padding:0 16px;border-radius:12px;box-shadow:none}
.stt{display:flex;align-items:center;gap:8px;font-size:16.5px;font-weight:600;white-space:nowrap}
.stt i{width:10px;height:10px;border-radius:50%;display:block}
'''
def kpi(t, v, d, unit=""):
    u = f'<span> {unit}</span>' if unit else ""
    return f'<div class="kpi"><div class="kt">{t}</div><div class="kv">{v}{u}</div><div class="kd"><span class="tag-ej">Ejemplo</span> {d}</div></div>'
# ---- 27
att = [
 ("alert","#D70015","6 cobros fallidos","Mercado Pago reintenta solo. Puedes avisarles por correo.","Revisar"),
 ("money","#FF9F0A","2 personas pidieron reembolso","Esperan respuesta desde ayer.","Responder"),
 ("trend","#FF9F0A","Señales: los avisos por WhatsApp van lentos","Llegan unos minutos tarde desde las 9:00 a.m.","Ver"),
 ("bulb","#8E8E93","3 ideas nuevas de herramientas","Del programa “Tienes la idea”.","Leer"),
]
att_rows = "".join(f'<div class="row"><div class="ic" style="background:{c}">{ic(i)}</div><div class="tx"><b>{t}</b><small>{s}</small></div><button class="btn btn-gray">{b}</button></div>' for i,c,t,s,b in att)
st = [("Clips","scissors","#5B4BFF","ok","Funcionando bien"),("Señales","trend","#FF9F0A","warn","Lento hoy"),("En vivo","live","#FF375F","ok","Funcionando bien"),
      ("Asistente","bot","#30B0C7","ok","Funcionando bien"),("Pronósticos","target","#34A853","ok","Funcionando bien"),("Inmuebles","house","#0A84FF","ok","Funcionando bien"),("Inversiones","chart","#AF52DE","ok","Funcionando bien")]
colr = {"ok":("var(--ok)","var(--ok)"),"warn":("#F5A623","var(--warn)")}
st_rows = "".join(f'<div class="row" style="min-height:52px;padding-top:8px;padding-bottom:8px"><div class="ic" style="background:{c};width:32px;height:32px;border-radius:9px">{ic(i,"i","width:18px;height:18px")}</div><div class="tx"><b style="font-size:18px">{n}</b></div><span class="stt" style="color:{colr[k][1]}"><i style="background:{colr[k][0]}"></i>{w}</span></div>' for n,i,c,k,w in st)
css27 = ADM + '.c2 .row + .row::before{left:72px}'
b27 = f'''<div class="app">{adminside("centro")}<main class="main"><div class="wrap">
<div class="hrow"><div><div class="eyebrow">Buenos días 👋</div><h1>Centro de mando</h1><p class="sub">Así va Chalyb este mes. Lo importante, primero.</p></div><div class="seg2"><span>Hoy</span><span>7 días</span><span class="on">Este mes</span></div></div>
<div class="kpis">{kpi("Ingresos del mes","$184,250","<b>+12%</b> vs. el mes pasado","MXN")}{kpi("Suscriptores activos","1,240","<b>+86</b> este mes")}
{kpi("Pruebas activas","312","Terminan esta semana: 74")}{kpi("Conversión de prueba","62%","De cada 10 pruebas, 6 se quedan")}</div>
<div class="c2"><div class="group"><div class="gh2">Necesita tu atención<span class="pill bad">4</span></div>{att_rows}</div>
<div class="group"><div class="gh2">Herramientas<a>Ver actividad</a></div>{st_rows}</div></div></div></main></div>'''
write("27-admin-centro.html", page2("Centro de mando", b27, css27))

# ---- 28 personas
css28 = ADM + '''
.lay{display:grid;grid-template-columns:1fr 372px;gap:22px;margin-top:20px;align-items:start}
.tools2{display:flex;gap:10px;align-items:center;margin-top:20px}
.tools2 .srch{display:flex;align-items:center;gap:10px;height:52px;flex:1;padding:0 18px;border-radius:16px;background:#fff;box-shadow:var(--shadow);font-size:17px;color:#A8A8B0}
.tools2 .srch svg.i{color:var(--ink3);width:20px;height:20px}
.tools2 .chip{height:44px;font-size:16px;padding:0 16px}
.tbl{background:#fff;border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.tr{display:grid;grid-template-columns:1.55fr .8fr 1.05fr .85fr 24px;align-items:center;gap:8px;padding:0 16px;height:64px;border-top:1px solid var(--line)}
.tr.th{height:46px;border-top:0;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);background:#FAFAFC}
.tr.sel{background:var(--tint2);box-shadow:inset 3px 0 0 var(--accent)}
.pp{display:flex;align-items:center;gap:12px;min-width:0}
.pp .avatar{width:38px;height:38px;font-size:14px}
.pp b{font-size:17px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp small{font-size:14.5px;color:var(--ink3);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr .d{font-size:15.5px;color:var(--ink2);white-space:nowrap}
.tr .dt svg.i{color:var(--ink3)}
.sheet2{background:#fff;border-radius:24px;box-shadow:var(--shadow-lg);padding:18px}
.sheet2 .who{display:flex;align-items:center;gap:14px}
.sheet2 .who .avatar{width:56px;height:56px;font-size:20px}
.sheet2 .who b{font-size:21px;display:block}.sheet2 .who small{font-size:15.5px;color:var(--ink2)}
.sheet2 .who .x{margin-left:auto;width:38px;height:38px;border-radius:50%;background:var(--bg);display:grid;place-items:center;color:var(--ink2)}
.sheet2 .meta{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
.acts2{margin-top:14px;display:flex;flex-direction:column;gap:6px}
.a2{display:flex;align-items:center;gap:12px;height:46px;padding:0 14px;border-radius:14px;background:var(--bg);font-size:17px;font-weight:600}
.a2 svg.i{width:21px;height:21px;color:var(--accent)}
.a2.on{background:var(--tint);box-shadow:inset 0 0 0 2px var(--accent)}
.a2.red{color:var(--bad)} .a2.red svg.i{color:var(--bad)}
.conf{margin-top:12px;padding:16px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 2px var(--accent),0 10px 26px rgba(91,75,255,.14)}
.conf .st{font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--accent)}
.conf h4{font-size:19px;font-weight:700;margin-top:4px;line-height:1.3}
.conf p{font-size:15.5px;color:var(--ink2);margin-top:6px;line-height:1.45}
.conf .bb{display:flex;gap:10px;margin-top:14px}
.conf .bb .btn{flex:1;height:52px;font-size:17px;padding:0 12px;border-radius:14px}
'''
PPL = [("Luis Hernández","luis.h@correo.mx","Pro","acc","Activo","acc","12 mar 2026",True,"#7DD3FC,#3B82F6"),
       ("María López","maria.lopez@correo.mx","Pro anual","acc","En prueba","gray","3 oct 2026",False,"#FFB86B,#FF7A8A"),
       ("Jorge Ramírez","jorge.r@correo.mx","VIP","dark","Activo","acc","2 ene 2026",False,"#A7F3D0,#10B981"),
       ("Ana Torres","ana.torres@correo.mx","Pro","acc","Pago pendiente","bad","18 jun 2026",False,"#FBCFE8,#EC4899"),
       ("Carlos Méndez","c.mendez@correo.mx","Gratis","gray","Activo","acc","9 sep 2026",False,"#FDE68A,#F59E0B"),
       ("Sofía Castillo","sofia.c@correo.mx","Pro anual","acc","Termina pronto","warn","1 oct 2025",False,"#C7D2FE,#6366F1"),
       ("Diego Flores","diego.f@correo.mx","Pro","acc","Cancelado","gray","4 abr 2026",False,"#FECACA,#EF4444"),
       ("Lucía Navarro","lucia.n@correo.mx","Gratis","gray","Activo","acc","27 sep 2026",False,"#DDD6FE,#8B5CF6")]
def ini(n): return "".join(p[0] for p in n.split()[:2])
rows = ""
for n,e,pl,pk,es,ek,d,sel,g in PPL:
    rows += f'''<div class="tr{" sel" if sel else ""}"><div class="pp"><div class="avatar" style="background:linear-gradient(135deg,{g})">{ini(n)}</div><div style="min-width:0"><b>{n}</b><small>{e}</small></div></div>
<div><span class="pill {pk}">{pl}</span></div><div><span class="pill {ek}">{es}</span></div><div class="d">{d}</div><div class="dt">{ic("dots")}</div></div>'''
sheet28 = f'''<div class="sheet2"><div class="who"><div class="avatar" style="background:linear-gradient(135deg,#7DD3FC,#3B82F6)">LH</div><div><b>Luis Hernández</b><small>luis.h@correo.mx</small></div><span class="x">{ic("x","i","width:18px;height:18px")}</span></div>
<div class="meta"><span class="pill acc">Pro mensual · {P_PRO_M}</span><span class="pill gray">Cobro: 12 oct · Visa ••3307</span></div>
<div class="acts2"><div class="a2">{ic("gift")}Regalar 1 mes de Pro</div><div class="a2">{ic("swap")}Cambiar su plan</div><div class="a2">{ic("mail")}Reenviar correo de acceso</div>
<div class="a2 on">{ic("refresh")}Reembolsar último cobro</div><div class="a2 red">{ic("x")}Cancelar su suscripción</div></div>
<div class="conf"><div class="st">Confirma · paso 2 de 2</div><h4>¿Reembolsar {P_PRO_M} MXN a Luis Hernández?</h4><p>Regresa a su tarjeta por Mercado Pago en 5 a 10 días. Queda registrado con tu nombre.</p>
<div class="bb"><button class="btn btn-gray">No, volver</button><button class="btn btn-primary">Sí, reembolsar</button></div></div></div>'''
b28 = f'''<div class="app">{adminside("personas")}<main class="main"><div class="wrap" style="max-width:1100px">
<div class="hrow"><div><h1>Personas</h1><p class="sub">Todos tus suscriptores en un solo lugar.</p></div><span class="tag-ej">Datos de ejemplo</span></div>
<div class="tools2"><div class="srch">{ic("search")}Buscar por nombre o correo</div><span class="chip on">Todos</span><span class="chip">En prueba</span><span class="chip">Pago pendiente</span><span class="chip">Cancelados</span></div>
<div class="lay"><div class="tbl"><div class="tr th"><span>Persona</span><span>Plan</span><span>Estado</span><span>Desde</span><span></span></div>{rows}</div>{sheet28}</div></div></main></div>'''
write("28-admin-personas.html", page2("Personas", b28, css28))

# ---- 29 dinero
css29 = ADM + '''
.src{display:flex;align-items:center;gap:10px;font-size:16px;color:var(--ink2);background:#fff;border-radius:999px;padding:8px 16px;box-shadow:var(--shadow)}
.src svg.i{width:18px;height:18px;color:var(--accent)}
.c3{display:grid;grid-template-columns:1.25fr .75fr;gap:20px;margin-top:20px}
.chart{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:0 0 18px}
.bars{display:flex;align-items:flex-end;gap:22px;height:150px;padding:10px 28px 0}
.bars div{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end}
.bars i{display:block;width:100%;border-radius:10px 10px 4px 4px;background:linear-gradient(180deg,#8A7DFF,#5B4BFF)}
.bars div:not(:last-child) i{background:#DCD8FF}
.bars span{font-size:14.5px;color:var(--ink3);font-weight:600}
.fun{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding-bottom:12px}
.fr2{display:flex;align-items:center;gap:12px;padding:9px 20px}
.fr2 .bar{height:12px;border-radius:6px;background:var(--tint);flex:1;overflow:hidden}
.fr2 .bar i{display:block;height:100%;background:var(--accent);border-radius:6px}
.fr2 b{font-size:16.5px;width:150px;font-weight:600}
.fr2 span{font-size:16.5px;font-weight:700;width:44px;text-align:right;font-variant-numeric:tabular-nums}
.mv{margin-top:20px;background:#fff;border-radius:22px;box-shadow:var(--shadow);overflow:hidden}
.mr{display:grid;grid-template-columns:.8fr 1.4fr 1.3fr .8fr .9fr;gap:10px;align-items:center;padding:0 20px;height:54px;border-top:1px solid var(--line);font-size:16.5px}
.mr.th{height:42px;border-top:0;font-size:13.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);background:#FAFAFC}
.mr .m{font-weight:650;font-variant-numeric:tabular-nums}
'''
months = [("may",52),("jun",61),("jul",66),("ago",74),("sep",88),("oct",100)]
bars = "".join(f'<div><i style="height:{h}%"></i><span>{m}</span></div>' for m,h in months)
fun = [("Empezaron prueba",100,"420"),("Siguen en prueba",74,"312"),("Ya pagaron",62,"261"),("Cancelaron",21,"88")]
funr = "".join(f'<div class="fr2"><b>{t}</b><div class="bar"><i style="width:{w}%"></i></div><span>{n}</span></div>' for t,w,n in fun)
MV = [("Hoy","Luis Hernández","Pro mensual",P_PRO_M,"ok","Cobrado"),("Hoy","Ana Torres","Pro mensual",P_PRO_M,"bad","Falló"),
      ("Ayer","Sofía Castillo","Pro anual",P_PRO_Y,"ok","Cobrado"),("Ayer","Diego Flores","Pro mensual",P_PRO_M,"gray","Reembolsado")]
mv = "".join(f'<div class="mr"><span style="color:var(--ink2)">{d}</span><span>{n}</span><span style="color:var(--ink2)">{c}</span><span class="m">{m}</span><span><span class="pill {k}">{s}</span></span></div>' for d,n,c,m,k,s in MV)
b29 = f'''<div class="app">{adminside("dinero")}<main class="main"><div class="wrap">
<div class="hrow"><div><h1>Dinero</h1><p class="sub">Una sola fuente de verdad para tus ingresos.</p></div><div class="src">{ic("refresh")}Viene de Mercado Pago · se actualiza cada hora</div></div>
<div class="kpis">{kpi("Ingresos del mes","$184,250","Ya descontados los reembolsos","MXN")}{kpi("Pruebas que se convierten","62%","261 de 420 pruebas")}
{kpi("Cobros fallidos","$4,494","<b class='bad'>6 cobros</b> · se reintentan solos","MXN")}{kpi("Reembolsos","$2,247","3 este mes","MXN")}</div>
<div class="c3"><div class="chart"><div class="gh2">Ingresos por mes<span class="tag-ej">Ejemplo</span></div><div class="bars">{bars}</div></div>
<div class="fun"><div class="gh2">Pruebas de este mes<span class="tag-ej">Ejemplo</span></div>{funr}</div></div>
<div class="mv"><div class="mr th"><span>Fecha</span><span>Persona</span><span>Concepto</span><span>Monto</span><span>Estado</span></div>{mv}</div></div></main></div>'''
write("29-admin-dinero.html", page2("Dinero", b29, css29))
