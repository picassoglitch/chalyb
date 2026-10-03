# FIX-3: rediseño de 3 páginas viejas (/app/subscription, /app/usage, /app/settings/perfil).
# Igual que build_tools.py: carga los helpers de build.py en un sandbox (sus escrituras van a un
# directorio temporal) y escribe SOLO html/70-*.html … html/74-*.html. Reusa html/style.css + SH.
# Correr: python3 build_fix3.py && python3 render_fix3.py
import os, tempfile, glob, contextlib, io
B = os.path.dirname(os.path.abspath(__file__))
_T = tempfile.mkdtemp(prefix="chalyb_fix3_")
os.makedirs(os.path.join(_T, "html")); os.makedirs(os.path.join(_T, "mockups"))
for _m in glob.glob(os.path.join(B, "more_*.py")):
    os.symlink(_m, os.path.join(_T, os.path.basename(_m)))
_G = {"__file__": os.path.join(_T, "build.py"), "__name__": "chalyb_base"}
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(open(os.path.join(B, "build.py"), encoding="utf-8").read(), "build.py", "exec"), _G)
globals().update({k: v for k, v in _G.items() if not k.startswith("__")})
H = os.path.join(B, "html")
def write(name, html):
    assert name[:2] in ("70","71","72","73","74"), name
    with open(os.path.join(H, name), "w", encoding="utf-8") as f: f.write(html)

P.update({
 "edit":'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
 "camera":'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
 "chevd":'<path d="m6 9 6 6 6-6"/>',
 "mail":'<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="m3 7 9 6 9-6"/>',
 "spark2":'<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>',
 "history":'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
 "wifi_off":'<path d="M2 2l20 20"/><path d="M8.5 16a5 5 0 0 1 7 0"/><path d="M5 12.5a10 10 0 0 1 5-2.7M19 12.5a10 10 0 0 0-2.4-1.8"/>',
})

# ---------- datos de ejemplo (salen de PRICING / TIER_CAPS en producción) ----------
# Precios: ver PRICING-CARDS-SPEC.md (fuente única). Totales con IVA incluido; vienen de more_shared.py (P_*).
PRO_M, PRO_Y, VIP_M = P_PRO_M, P_PRO_Y, P_VIP_M
PRO_Y_SAVE = P_SAVE_PRO
# Paquetes de créditos: NO están en PRICING-CARDS-SPEC; siguen siendo lista × 1.16 (pendiente del dueño).
PACKS = [("100,000","$172.84","Para unos cuantos clips más"),
         ("500,000","$694.84","Cada crédito te sale más barato"),
         ("2,000,000","$2,318.84","El más barato por crédito, para uso diario")]

FX = '''
:root{--ink3-text:#6C6C74;--ok-text:#167A3E}
.main{padding-top:38px}
.crumb{font-size:18px;color:var(--ink2);margin-bottom:4px;font-weight:500}
/* AA (Q28 del código real): texto secundario nunca en --ink3 */
.ghead{color:var(--ink3-text)}
.row .tx small,.row .val,.cred .mt,.rowsub{color:var(--ink3-text)}
.row .tx small{font-size:16px}
.ok2{color:var(--ok-text)}
.plan .k,.plan p{opacity:1}
.row .val b{color:var(--ink);font-weight:650}
.act{font-size:17px;color:var(--accent);font-weight:600;white-space:nowrap}
.cancel b{color:var(--bad)!important}
.lnk2{color:var(--accent);font-weight:600;font-size:17px;white-space:nowrap}
/* Opciones avanzadas (copiado de build_tools.py TS · componente AdvancedOptions/.ch-adv) */
.advbar{display:flex;align-items:center;gap:14px;padding:0 22px 0 24px;height:66px;border-radius:20px;box-shadow:inset 0 0 0 1.5px #DEDEE4}
.advbar .ic2{color:var(--ink2)} .advbar b{font-size:19px;font-weight:600;white-space:nowrap}
.advbar .pro{background:var(--tint);color:var(--accent);font-size:16px;font-weight:700;padding:5px 12px;border-radius:999px;white-space:nowrap}
.advbar small{font-size:16px;color:var(--ink3-text);margin-left:auto;margin-right:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.advbar{min-width:0}
.advbar .chev{color:var(--ink3);margin-left:auto}
.pill{font-size:16px;padding:4px 12px}
.pill svg.i{width:16px;height:16px}
.btn:disabled,.btn.dis{background:#EBEBF0;color:#6C6C74;box-shadow:none}
.toast{position:absolute;left:50%;transform:translateX(-50%);bottom:30px;display:flex;align-items:center;gap:12px;background:var(--ink);color:#fff;padding:14px 22px 14px 14px;border-radius:16px;box-shadow:var(--shadow-lg);font-size:18px;white-space:nowrap;z-index:5}
.toast .ti{width:32px;height:32px;border-radius:50%;background:var(--ok);display:grid;place-items:center}
.toast .ti svg{width:18px;height:18px;stroke-width:3;color:#fff}
'''
def side(plan, name="María López", ini="ML"):
    return sidebar2("cuenta", plan).replace("María López", name).replace(">ML<", f">{ini}<")
def chk(c="var(--accent)"): return f'<span class="ck" style="color:{c}">{ic("check")}</span>'

# =============================== 70 · MI PLAN · GRATIS ===============================
css70 = css30 + FX + '''
.cols{grid-template-columns:440px minmax(0,1fr);gap:26px;margin-top:18px}
.colx > * + *{margin-top:18px}
.cur{padding:20px 24px 20px}
.cur .k{font-size:15px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3-text)}
.cur h2{font-size:28px;margin-top:4px}
.cur .big{font-size:34px;font-weight:750;letter-spacing:-.03em;margin-top:4px}
.cur .big span{font-size:18px;font-weight:600;color:var(--ink2);letter-spacing:0}
.cur ul{list-style:none;margin-top:12px;display:grid;gap:6px}
.cur li{display:flex;gap:10px;align-items:flex-start;font-size:17px;color:var(--ink2);line-height:1.35}
.ck svg{width:20px;height:20px;stroke-width:2.6;margin-top:1px}
.offer{padding:24px 28px 22px;border-radius:24px;background:#fff;box-shadow:0 0 0 2px var(--accent),var(--shadow-lg)}
.offer .top{display:flex;align-items:center;gap:10px}
.offer h2{font-size:32px;font-weight:700;letter-spacing:-.03em;margin-top:8px}
.offer .s{font-size:19px;color:var(--ink2);margin-top:6px}
.adds{margin-top:18px}
.adds .t{font-size:17px;font-weight:650;margin-bottom:10px}
.adds ul{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:10px 18px}
.adds li{display:flex;gap:10px;font-size:18px;line-height:1.35;white-space:nowrap}
.price{margin-top:20px;border-radius:18px;background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF;padding:16px 20px;display:flex;gap:18px;align-items:center}
.price .today{font-size:18px;padding-right:18px;border-right:1px solid #E0DCFF;white-space:nowrap}
.price .today b{display:block;font-size:30px;font-weight:750;letter-spacing:-.02em}
.price .after{flex:1;min-width:0}
.price .after small{display:block;font-size:16px;color:var(--ink2)}
.price .after .n{font-size:28px;font-weight:750;letter-spacing:-.02em;line-height:1.15}
.price .after .n span{font-size:18px;font-weight:600}
.price .after .eq{font-size:16px;color:var(--ink2);margin-top:2px}
.offer .btn-xl{margin-top:18px}
.offer .legal{font-size:16px;color:var(--ink2);margin-top:12px;line-height:1.45}
.offer .alt{font-size:16.5px;margin-top:10px;color:var(--ink2)}
.colx > * + *{margin-top:20px}
.price{padding:14px 20px}
'''
pro_adds = ["Todas las herramientas","1,000,000 de créditos al mes",
            "Clips sin marca de agua","Tu logo en tus clips",
            "Publica en tus redes","Comunidad premium"]
b70 = f'''<div class="app">{side("Plan Gratis","Ana Torres","AT")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="cols"><div class="colx">
<div class="card cur"><div class="k">Tu plan</div><h2>Gratis</h2><div class="big">$0 <span>Sin tarjeta · Para siempre</span></div>
<ul><li>{chk("var(--ink2)")}Clips con marca de agua</li><li>{chk("var(--ink2)")}50,000 créditos cada mes</li>
<li>{chk("var(--ink2)")}Descargas tus clips a mano</li><li>{chk("var(--ink2)")}Acceso a la comunidad</li></ul></div>
<div><div class="ghead">Tu cuenta Gratis</div><div class="group">
<div class="row cred" style="display:block"><div class="top">{icb("coins","#FF9F0A")}<div class="tx"><b>Créditos de este mes</b></div><span class="num">50,000</span></div>
<div class="meter"><i style="width:0%"></i></div><div class="mt"><span>Usaste 0 de 50,000</span><span class="lnk2" style="font-size:16px">Ver mis créditos ›</span></div></div>
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Sin tarjeta</span>',"No la necesitas")}
{grow(icb("receipt","#8E8E93"),"Facturas",'<span class="val">Ninguna aún</span>')}</div></div>
<div><div class="ghead">Otros planes</div><div class="group">
{grow(icb("star","#AF52DE"),"VIP",f'<span class="act">{VIP_M} al mes</span>',"Más créditos y ayuda prioritaria")}</div></div>
</div>
<div class="colx">
<div class="offer"><div class="top"><span class="pill acc">{ic("gift")}Incluido en Pro · Pruébalo gratis</span></div>
<h2>Prueba Pro gratis 7 días</h2><div class="s">Mensual o anual. Cancela en 1 clic, sin llamadas.</div>
<div class="adds"><div class="t">Lo que Pro te agrega</div><ul>{"".join(f"<li>{chk()}{a}</li>" for a in pro_adds)}</ul></div>
<div class="price"><div class="today">Hoy pagas<b>$0</b></div>
<div class="after"><small>Después de tus 7 días</small><div class="n">{PRO_M} <span>MXN al mes</span></div>
<div class="eq">Se renueva cada mes</div><div class="eq" style="margin-top:6px">o Pro anual: {PRO_Y} MXN al año <span class="pill acc">Ahorras {PRO_Y_SAVE} al año · {P_PCT_PRO}%</span></div></div></div>
<button class="btn btn-primary btn-xl">{TRIAL_CTA}</button>
<p class="legal">Hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Cancela en 1 clic desde Mi plan, sin llamadas. Precios en MXN, IVA incluido.</p>
<p class="alt">Eliges mensual o anual en el siguiente paso. VIP no tiene prueba.</p></div>
</div></div></div></main></div>'''
write("70-mi-plan-gratis.html", page2("Mi plan · Gratis", b70, css70))

# =============================== 71 · MI PLAN · PRO MENSUAL ===============================
css71 = css30 + FX + '''
.shellv{display:flex;flex-direction:column;height:100vh}
.shellv .app{height:auto;flex:1;min-height:0}
.main{padding-top:30px}
.cols{margin-top:18px}
.colx > * + *{margin-top:20px}
.bnr{border-bottom:1px solid var(--warn-line)}
'''
COBRO71 = "8 de octubre de 2026"
b71 = f'''<div class="shellv">
<div class="bnr warn"><div class="bi">{ic("clock")}</div><div class="bt">Tu plan Pro se renueva el <b>{COBRO71}</b> por <b>{PRO_M} MXN</b>. Si quieres cambiar o cancelar, hazlo antes de esa fecha.</div></div>
<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="cols"><div class="colx">
<div class="plan"><div class="k">Tu plan · Activo</div><h2>Pro mensual — todo incluido</h2><p>Se renueva cada mes.<br>Próximo cobro: {COBRO71}</p>
<div class="big">{PRO_M} <span>MXN al mes</span></div><div class="pb"><span class="inc">{ic("check")}Todas las herramientas</span><button class="btn">Cambiar plan</button></div></div>
<div><div class="ghead">Próximo cobro</div><div class="group">
{grow(icb("cal","#5B4BFF"),COBRO71,f'<span class="val"><b>{PRO_M} MXN</b></span>',"Aviso por correo 7 días antes")}
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Visa ••4821</span>',"Vence 08/29")}
<div class="row cred" style="display:block"><div class="top">{icb("coins","#FF9F0A")}<div class="tx"><b>Créditos de este mes</b></div><span class="num">587,500</span></div>
<div class="meter"><i style="width:41%"></i></div><div class="mt"><span>Usaste 412,500 de 1,000,000</span><span class="lnk2" style="font-size:16px">Ver mis créditos ›</span></div></div></div></div></div>
<div class="colx"><div><div class="ghead">Cambiar de plan</div><div class="group">
{grow(icb("swap","#0A84FF"),"Pasar a Pro anual",f'<span class="act">{PRO_Y} al año</span>',f"Ahorras {PRO_Y_SAVE} al año. Empieza en tu próxima fecha de cobro")}
{grow(icb("star","#AF52DE"),"Subir a VIP",f'<span class="act">{VIP_M} al mes</span>',"Se aplica hoy; te mostramos el ajuste antes")}
{grow(icb("down","#8E8E93"),"Pasar a Gratis",'<span class="act">$0</span>',"Al terminar tu mes pagado")}</div></div>
<div><div class="ghead">Facturas</div><div class="group">
{grow(icb("receipt","#8E8E93"),"8 de septiembre de 2026",f'<span class="val">{PRO_M} · CFDI</span>',"Pro mensual")}
{grow(icb("doc","#8E8E93"),"Datos de facturación (RFC)",'<span class="val">Agregar</span>')}</div></div>
<div><div class="group"><div class="row cancel">{icb("x","#FF3B30")}<div class="tx"><b>Cancelar suscripción</b><small>1 clic, sin llamadas. Sigues con Pro hasta el {COBRO71}.</small></div>{ic("chev","i chev")}</div></div></div>
</div></div></div></main></div></div>'''
write("71-mi-plan-pro.html", page2("Mi plan · Pro", b71, css71))

# =============================== 72 · MIS CRÉDITOS ===============================
css72 = css07 + FX + '''
.main{padding-top:34px}
.hsub{font-size:19px;color:var(--ink2);margin-top:6px}
.cols{grid-template-columns:470px minmax(0,1fr);gap:26px;margin-top:20px}
.colx > * + *{margin-top:20px}
.bal{padding:24px 26px 24px}
.bal .k{font-size:19px;color:var(--ink2);font-weight:500}
.bal .n{font-size:60px;font-weight:750;letter-spacing:-.04em;line-height:1.05;margin-top:2px}
.bal .n span{font-size:22px;font-weight:650;letter-spacing:-.01em;color:var(--ink2)}
.bal .m{height:14px;border-radius:7px;background:#ECEBF3;margin-top:16px;overflow:hidden}
.bal .m i{display:block;height:100%;width:59%;border-radius:7px;background:linear-gradient(90deg,#8A7DFF,#5B4BFF)}
.bal .l{display:flex;justify-content:space-between;font-size:17px;color:var(--ink2);margin-top:8px}
.bal .facts{margin-top:16px;display:grid;gap:10px}
.bal .f{display:flex;gap:12px;align-items:center;font-size:17.5px}
.bal .f .fi{width:34px;height:34px;border-radius:10px;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.bal .f .fi svg{width:19px;height:19px}
.bal .btn{margin-top:18px;width:100%}
.tool .ic{border-radius:11px}
.hist .row{min-height:64px}
.amt{font-size:18px;font-weight:650;white-space:nowrap;font-variant-numeric:tabular-nums}
.amt.plus{color:var(--accent)}
.gh{display:flex;justify-content:space-between;align-items:baseline}
.gh a{font-size:16px;color:var(--accent);font-weight:600;padding:0 20px 10px}
'''
def trow(icn, col, t, sub, amt, plus=False):
    return f'<div class="row">{toolicon(icn,col,38,10,21)}<div class="tx"><b>{t}</b><small>{sub}</small></div><span class="amt{" plus" if plus else ""}">{amt}</span></div>'
INNER72 = f'''<div class="crumb">Mi cuenta ›</div><h1>Mis créditos</h1>
<p class="hsub">Los créditos se usan cuando tus herramientas trabajan por ti.</p>
<div class="cols"><div class="colx">
<div class="card bal"><div class="k">Te quedan</div><div class="n">587,500 <span>créditos</span></div>
<div class="m"><i></i></div><div class="l"><span>Usaste 412,500 de 1,000,000 este mes</span></div>
<div class="facts"><div class="f"><span class="fi">{ic("refresh")}</span><span>Se renuevan el <b>1 de noviembre de 2026</b>. Vuelves a tener 1,000,000.</span></div>
<div class="f"><span class="fi">{ic("plus")}</span><span>Créditos extra comprados: <b>0</b>. Se usan después de los de tu plan.</span></div></div>
<button class="btn btn-primary">{ic("plus")}Conseguir más créditos</button></div>
<div><div class="ghead">En qué los usaste este mes</div><div class="group tool">
{trow("scissors","#5B4BFF","Clips","Hiciste 18 clips","360,000")}
{trow("trend","#FF9F0A","Señales","Te mandamos 42 avisos","42,000")}
{trow("live","#FF375F","En vivo","Manejaste 3 transmisiones","10,500")}</div></div>
</div><div class="colx">
<div><div class="gh"><div class="ghead">Historial</div><a>Ver todo</a></div><div class="group hist">
{trow("scissors","#5B4BFF","6 clips de “Noche de preguntas”","Clips · hoy, 8:40 p.m.","−120,000")}
{trow("trend","#FF9F0A","Aviso de Bitcoin","Señales · hoy, 7:15 a.m.","−1,000")}
{trow("live","#FF375F","Transmisión del martes","En vivo · 29 de septiembre","−3,500")}
{trow("scissors","#5B4BFF","4 clips de “Torneo del viernes”","Clips · 25 de septiembre","−80,000")}
{trow("refresh","#8E8E93","Se renovaron tus créditos","Plan Pro · 1 de octubre","+1,000,000",True)}</div></div>
<div class="advbar">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><span class="pro">Para profesionales</span><small></small>{ic("chevd","i chev")}</div>
</div></div>'''
b72 = f'<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">{INNER72}</div></main></div>'
write("72-creditos.html", page2("Mis créditos", b72, css72))

# ---- 72b · hoja "Conseguir más créditos"
css72b = css72 + '''
.app{position:relative}
.sheetwrap{position:absolute;inset:0;display:grid;place-items:center;z-index:4}
.sheetc{width:660px;padding:30px 32px 26px;position:relative}
.sheetc .close{position:absolute;right:22px;top:22px;box-shadow:inset 0 0 0 1.5px var(--line)}
.sheetc h2{font-size:30px;font-weight:700;letter-spacing:-.025em}
.sheetc .s{font-size:18px;color:var(--ink2);margin-top:6px;padding-right:50px}
.opts{display:grid;gap:12px;margin-top:20px}
.opt{display:flex;align-items:center;gap:16px;min-height:84px;padding:14px 20px;border-radius:20px;background:#fff;box-shadow:inset 0 0 0 1.5px #DCDCE3}
.opt.sel{box-shadow:inset 0 0 0 2.5px var(--accent);background:var(--tint2)}
.opt .rd{width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 2px #C9C9D2;flex:none;display:grid;place-items:center}
.opt.sel .rd{box-shadow:inset 0 0 0 9px var(--accent)}
.opt .tx{flex:1}.opt .tx b{display:block;font-size:21px;font-weight:650}.opt .tx small{font-size:16.5px;color:var(--ink2)}
.opt .pr{text-align:right}.opt .pr b{display:block;font-size:22px;font-weight:750;letter-spacing:-.02em}.opt .pr small{font-size:15px;color:var(--ink2)}
.terms{margin-top:16px;font-size:16.5px;color:var(--ink2);line-height:1.45}
.payw{display:flex;align-items:center;gap:12px;margin-top:14px;font-size:17px}
.payw .lnk2{margin-left:auto}
.payw .pi{width:38px;height:38px;border-radius:10px;background:#34C759;color:#fff;display:grid;place-items:center}.payw .pi svg{width:21px;height:21px}
.sheetc .btn-xl{margin-top:16px}
.later{display:block;text-align:center;margin-top:12px;font-size:18px;font-weight:600;color:var(--ink2)}
'''
optsh = "".join(f'''<div class="opt{" sel" if k==1 else ""}"><span class="rd"></span><div class="tx"><b>{n} créditos</b><small>{d}</small></div>
<div class="pr"><b>{p} MXN</b><small>Pago único</small></div></div>''' for k,(n,p,d) in enumerate(PACKS))
b72b = f'''<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">{INNER72}</div></main>
<div class="dim"></div><div class="sheetwrap"><div class="sheetc">
<button class="close">{ic("x")}</button><h2>Conseguir más créditos</h2>
<p class="s">Se suman a los que ya tienes. Tu plan y tu fecha de cobro no cambian.</p>
<div class="opts">{optsh}</div>
<p class="terms">Es un <b>pago único</b>, no una suscripción. Los créditos extra se usan después de los de tu plan y <b>no vencen</b>. Precios en MXN, IVA incluido.</p>
<div class="payw"><span class="pi">{ic("card")}</span><span>En el siguiente paso pones tu tarjeta. Pago seguro con Mercado Pago.</span></div>
<button class="btn btn-primary btn-xl">Continuar al pago · $694.84 MXN</button><span class="later">Ahora no</span>
</div></div></div>'''
write("72b-creditos-comprar.html", page2("Conseguir más créditos", b72b, css72b))

# =============================== 73 · MI PERFIL ===============================
css73 = css07 + FX + '''
.main{padding-top:34px;position:relative}
.hsub{font-size:19px;color:var(--ink2);margin-top:6px}
.cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:26px;margin-top:18px}
.colx > * + *{margin-top:18px}
.fcard{padding:8px 24px 22px}
.photo{display:flex;align-items:center;gap:18px;padding:14px 0 4px}
.photo .avatar{width:72px;height:72px;font-size:26px}
.photo b{display:block;font-size:19px;font-weight:600}.photo small{font-size:16px;color:var(--ink3-text)}
.photo .btn{margin-left:auto;height:48px;font-size:17px;padding:0 18px;border-radius:14px;box-shadow:inset 0 0 0 1.5px #DAD6FF}
.field{margin-top:12px}
.field label{font-size:18px}
.field .in{height:58px;font-size:19px}
.field .in.ro{background:#F7F7FA;color:var(--ink)}
.field .hint{font-size:16px;color:var(--ink3-text);margin-top:6px}
.field .in .dd{margin-left:auto;color:var(--ink2)}
.sw{flex:none}
.notif .row{min-height:74px}
.savebar{display:grid;gap:12px}
.savebar .tx{font-size:17px;color:var(--ink2);display:flex;gap:10px;align-items:flex-start;line-height:1.35;padding:0 4px}
.savebar .tx svg{color:var(--ok-text);width:20px;height:20px;flex:none;margin-top:1px}
.toast{bottom:32px}
.photo{padding:14px 0 0}.photo .avatar{width:64px;height:64px;font-size:23px}
.fcard .field:first-of-type{margin-top:10px}
'''
def fld(lbl, val, hint="", ro=False, dd=False, ico=None):
    i = ic(ico) if ico else ""
    d = f'<span class="dd">{ic("chevd")}</span>' if dd else ""
    h = f'<div class="hint">{hint}</div>' if hint else ""
    return f'<div class="field"><label>{lbl}</label><div class="in val{" ro" if ro else ""}">{i}{val}{d}</div>{h}</div>'
def swrow(icn, col, t, sub, on):
    return f'<div class="row">{icb(icn,col)}<div class="tx"><b>{t}</b><small>{sub}</small></div><span class="sw{" on" if on else ""}"></span></div>'
def perfil(savebar, toast=""):
    return f'''<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi perfil</h1>
<div class="cols"><div class="colx">
<div><div class="ghead">Tus datos</div><div class="card fcard">
<div class="photo"><div class="avatar">ML</div><div><b>Tu foto</b><small>Opcional</small></div><button class="btn btn-secondary">{ic("camera")}Cambiar foto</button></div>
{fld("Tu nombre","María López")}
{fld("Correo","maria.lopez@correo.mx","Aquí te mandamos tus avisos y recibos.",ro=True,ico="mail")}</div></div>
<div><div class="ghead">Idioma y hora</div><div class="card fcard">
{fld("Idioma","Español (México)",dd=True,ico="globe")}
{fld("Zona horaria","Ciudad de México (UTC−6)","Usamos esta hora en tus avisos y fechas.",dd=True,ico="clock")}</div></div>
</div><div class="colx">
<div><div class="ghead">Notificaciones</div><div class="group notif">
{swrow("alert","#FF3B30","Si algo deja de funcionar","Te avisamos por correo y en tu celular.",True)}
{swrow("cal","#5B4BFF","Resumen del día","Lo que hicieron tus herramientas ayer, a las 9:00 a.m.",True)}
{swrow("spark2","#FF9F0A","Cuando a un clip tuyo le va muy bien","Si se vuelve viral o recibe muchas reacciones.",False)}
{swrow("mail","#30B0C7","Novedades y promociones","Consejos y ofertas por correo. Quítalo cuando quieras.",False)}</div></div>
<div class="advbar">{ic("sliders","i ic2")}<b>Opciones avanzadas</b><span class="pro">Seguridad</span>{ic("chevd","i chev")}</div>
{savebar}</div></div></div>{toast}</main></div>'''
SAVED = f'<div class="savebar"><div class="tx">{ic("check")}Todo se guarda en tu cuenta: se ve igual en tu celular y en tu computadora.</div><button class="btn dis btn-xl" disabled>Guardar cambios</button></div>'
TOAST = f'<div class="toast"><span class="ti">{ic("check")}</span>Listo, guardamos tus cambios.</div>'
write("73-perfil.html", page2("Mi perfil", perfil(SAVED, TOAST), css73))

# =============================== 74 · ESTADOS ===============================
css74 = FX + '''
body{background:var(--bg)}
.board{padding:40px 48px 44px;width:1440px}
.board h1{font-size:34px}.board .bs{font-size:18px;color:var(--ink2);margin-top:6px}
.sec{display:flex;align-items:center;gap:10px;margin:26px 0 12px;font-size:19px;font-weight:650}
.sec .n{width:26px;height:26px;border-radius:7px;background:var(--accent);color:#fff;font-size:15px;font-weight:700;display:grid;place-items:center}
.sec small{font-size:16px;color:var(--ink3-text);font-weight:500}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.panel{background:#fff;border-radius:22px;box-shadow:var(--shadow);padding:22px 24px;position:relative;overflow:hidden}
.panel .cap{font-size:15px;font-weight:650;color:var(--ink3-text);margin-bottom:12px}
.savebar{display:flex;align-items:center;gap:14px;padding:10px 10px 10px 18px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1.5px var(--line)}
.savebar .tx{flex:1;font-size:16.5px;color:var(--ink2);display:flex;gap:8px;align-items:center;line-height:1.3}
.savebar .tx svg{width:20px;height:20px;flex:none}
.savebar .btn{height:54px;font-size:18px;min-width:200px}
.savebar.err{box-shadow:inset 0 0 0 1.5px var(--bad-line);background:var(--bad-tint)}
.savebar.err .tx{color:var(--bad)}
.spin{width:20px;height:20px;border-radius:50%;border:3px solid rgba(255,255,255,.4);border-top-color:#fff}
.st{display:grid;gap:12px}
.toastx{display:inline-flex;align-items:center;gap:12px;background:var(--ink);color:#fff;padding:14px 22px 14px 14px;border-radius:16px;font-size:18px}
.toastx .ti{width:32px;height:32px;border-radius:50%;background:var(--ok);display:grid;place-items:center}.toastx .ti svg{width:18px;height:18px;stroke-width:3;color:#fff}
.empty{text-align:center;padding:10px 6px 4px}
.empty .ei{width:64px;height:64px;border-radius:20px;background:var(--tint);color:var(--accent);display:grid;place-items:center;margin:0 auto}
.empty .ei svg{width:32px;height:32px}
.empty h3{font-size:22px;margin-top:12px}.empty p{font-size:17px;color:var(--ink2);margin-top:6px}
.empty .btn{margin-top:14px;height:54px;font-size:18px}
.sk{height:18px;border-radius:9px;background:linear-gradient(90deg,#EEEEF3,#F6F6F9,#EEEEF3)}
.err2 .ei{background:#EEEEF2;color:var(--ink2)}
.offer2 h3{font-size:24px;font-weight:700}
.offer2 .p{margin-top:10px;font-size:17px;color:var(--ink2)}
.offer2 .n{font-size:26px;font-weight:750;color:var(--ink);letter-spacing:-.02em}
.offer2 .btn{margin-top:14px;width:100%;height:58px}
.field .in{height:56px}
.field .in.err{box-shadow:inset 0 0 0 2px var(--bad)}
.field .em{font-size:16px;color:var(--bad);margin-top:6px}
.lang p{font-size:17px;color:var(--ink2);margin-top:8px}
.bnr{border-radius:16px;flex-wrap:wrap;row-gap:10px;padding:12px 14px}
.panel .bnr .bt{flex:1 1 220px}
.panel .bnr .btn{margin-left:48px}
'''
SB = lambda cls, tx, btn: f'<div class="savebar {cls}"><div class="tx">{tx}</div>{btn}</div>'
b74 = f'''<div class="board"><h1>Estados · Mi plan, Mis créditos y Mi perfil</h1>
<p class="bs">Lo que ve la persona en cada caso. Un solo botón principal por estado; nunca un botón sin acción.</p>
<div class="sec"><span class="n">1</span>Mi perfil · botón “Guardar cambios” <small>· uno solo, abajo, para toda la página</small></div>
<div class="g2"><div class="panel st"><div class="cap">Sin cambios (deshabilitado) · Con cambios</div>
{SB("",ic("check","i","color:var(--ok-text)")+"Todo se guarda en tu cuenta.",'<button class="btn dis">Guardar cambios</button>')}
{SB("",ic("edit","i","color:var(--accent)")+"Tienes cambios sin guardar.",'<button class="btn btn-primary">Guardar cambios</button>')}</div>
<div class="panel st"><div class="cap">Guardando · No se pudo guardar</div>
{SB("",ic("clock","i","color:var(--ink2)")+"Guardando tus cambios…",'<button class="btn btn-primary" style="opacity:.75"><span class="spin"></span>Guardando…</button>')}
{SB("err",ic("alert")+"No pudimos guardar. Revisa tu internet e intenta otra vez. Tus cambios siguen aquí.",'<button class="btn btn-primary">Intentar otra vez</button>')}</div></div>
<div class="g3" style="margin-top:20px">
<div class="panel"><div class="cap">Guardado (aviso 3 s, sin salir de la página)</div><div class="toastx"><span class="ti">{ic("check")}</span>Listo, guardamos tus cambios.</div>
<div class="lang"><p style="margin-top:14px">Si cambió el idioma, la página se vuelve a mostrar en el idioma nuevo <b>sin cerrar tu sesión</b> y el aviso sale ya traducido: “Done, your changes are saved.”</p></div></div>
<div class="panel"><div class="cap">Error en un campo (al salir del campo)</div>
<div class="field" style="margin-top:0"><label>Tu nombre</label><div class="in val err">M</div><div class="em">Escribe tu nombre (mínimo 2 letras).</div></div></div>
<div class="panel"><div class="cap">Cargando (esqueleto, sin girador a pantalla completa)</div>
<div style="display:grid;gap:12px"><div class="sk" style="width:40%;height:22px"></div><div class="sk" style="height:56px;border-radius:16px"></div><div class="sk" style="height:56px;border-radius:16px"></div><div class="sk" style="width:60%"></div></div></div></div>

<div class="sec"><span class="n">2</span>Mis créditos <small>· vacío, error, compra recibida, casi sin créditos</small></div>
<div class="g3">
<div class="panel empty"><div class="ei">{ic("coins")}</div><h3>Aún no usas tus créditos</h3><p>Cuando hagas tu primer clip, aquí verás en qué se usaron.</p><button class="btn btn-primary">Hacer mi primer clip</button></div>
<div class="panel empty err2"><div class="ei">{ic("refresh")}</div><h3>No pudimos cargar tus créditos</h3><p>Tus créditos están bien; solo no pudimos mostrarlos ahora.</p><button class="btn btn-primary">Intentar otra vez</button></div>
<div class="panel st" style="align-content:start"><div class="cap">Arriba del contenido (Banner)</div>
<div class="bnr trial" style="border:0"><div class="bi">{ic("check")}</div><div class="bt"><b>Pago recibido.</b> Tus créditos se suman en unos minutos.</div></div>
<div class="bnr warn" style="border:0"><div class="bi">{ic("clock")}</div><div class="bt">Te queda poco: <b>8%</b> de tus créditos. Se renuevan el 1 de noviembre.</div><button class="btn">Conseguir más</button></div></div></div>

<div class="sec"><span class="n">3</span>Mi plan · Gratis <small>· si ya usó su prueba de 7 días no se ofrece otra vez</small></div>
<div class="g3">
<div class="panel offer2"><div class="cap">Ya usó su prueba</div><h3>Elige tu plan Pro</h3><p class="p">Hoy se cobran</p><div class="n">{PRO_M} MXN al mes</div><p class="p">Se renueva cada mes hasta que canceles. O {PRO_Y} MXN al año.</p><button class="btn btn-primary">Elegir Pro</button></div>
<div class="panel offer2"><div class="cap">Su prueba terminó (banner gris arriba)</div>
<div class="bnr gray" style="border:0;padding-left:14px"><div class="bi">{ic("info")}</div><div class="bt">Tu prueba terminó. Estás en el plan Gratis.</div><button class="btn">Volver a Pro</button></div>
<p class="p">El resto de la página es igual a 70, con “Volver a Pro” en vez de “{TRIAL_CTA}”.</p></div>
<div class="panel offer2"><div class="cap">Administrador (no es suscriptor)</div>
<div class="bnr gray" style="border:0;padding-left:14px"><div class="bi">{ic("shield")}</div><div class="bt">Eres administrador: tienes todo incluido, sin importar el plan.</div></div>
<p class="p">Sin botones de compra. El plan guardado se ve en Opciones avanzadas.</p></div></div>
</div>'''
write("74-estados-fix3.html", page2("Estados fix 3", b74, css74))
print("built fix3: 70, 71, 72, 72b, 73, 74")
