# ===================== 86-88 · Pro Lealtad (antes "Reducto"; los nombres de archivo conservan 'reducto') (Pro, el precio baja cada mes que te quedas) =====================
# Standalone. Reusa: build_pricing.py (CSS de tarjetas + tabla PRICES/REF) y build_fix3.py (shell de la app, 71).
# Ninguno de los dos escribe nada al cargarse aquí (pricing con filtro vacío; fix3 en un directorio temporal).
# Correr: python3 build_reducto.py && python3 render_reducto.py
import os, sys, math, tempfile, glob, contextlib, io, datetime
B = os.path.dirname(os.path.abspath(__file__)); H = os.path.join(B, "html")

# --- 1) tarjetas de precios: CSS, PRICES, REF, mxn() (sin generar 80-85)
_argv = sys.argv; sys.argv = [_argv[0], "99"]
_PG = {"__file__": os.path.join(B, "build_pricing.py"), "__name__": "pricing_lib"}
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(open(os.path.join(B, "build_pricing.py"), encoding="utf-8").read(), "build_pricing.py", "exec"), _PG)
sys.argv = _argv
PCSS, PRICES, REF, mxn, toggle_unused = _PG["CSS"], _PG["PRICES"], _PG["REF"], _PG["mxn"], None

# --- 2) shell de la app (build.py + fix3) en un sandbox temporal
_T = tempfile.mkdtemp(prefix="chalyb_reducto_"); os.makedirs(os.path.join(_T, "html")); os.makedirs(os.path.join(_T, "mockups"))
for _m in glob.glob(os.path.join(B, "more_*.py")) + [os.path.join(B, "build.py")]:
    os.symlink(_m, os.path.join(_T, os.path.basename(_m)))
_FG = {"__file__": os.path.join(_T, "build_fix3.py"), "__name__": "fix3_lib"}
with contextlib.redirect_stdout(io.StringIO()):
    exec(compile(open(os.path.join(B, "build_fix3.py"), encoding="utf-8").read(), "build_fix3.py", "exec"), _FG)
page2, side, grow, icb, ic, css30, FX = (_FG[k] for k in ("page2", "side", "grow", "icb", "ic", "css30", "FX"))

def write(name, html):
    assert name[:2] in ("86", "87", "88"), name
    open(os.path.join(H, name), "w", encoding="utf-8").write(html)

# ----------------------------------------------------------------- calendario Pro Lealtad (una sola tabla)
BASE = REF["pro_month"]          # 166_200 = $1,662: mes 1 al precio regular completo (sin el 40% de promo)
STEP_PCT, FLOOR_PCT = 10, 60     # -10% por mes consecutivo, piso 60% ⇒ el piso llega en el mes 7
NAME = "Pro Lealtad"             # dueño 3-oct 09:50 (en: Pro Loyalty); plan_key pro_lealtad; ver §15.1 del spec
def step_price(step):            # step 0..6. Redondeo HACIA ABAJO al peso: el % anunciado siempre es real (≥)
    off = min(step * STEP_PCT, FLOOR_PCT)
    return (BASE * (100 - off) // 100) // 100 * 100, off
STEPS = [step_price(s) for s in range(FLOOR_PCT // STEP_PCT + 1)]       # [(166200,0) … (66400,60)]
for c, off in STEPS:                                                    # verificación: nunca prometer de más
    assert (BASE - c) * 100 / BASE >= off, (c, off)
def month_price(m): return STEPS[min(m - 1, len(STEPS) - 1)][0]
Y1 = sum(month_price(m) for m in range(1, 13)); Y2 = sum(month_price(m) for m in range(13, 25))
PRO_M, PRO_Y = PRICES["pro_month"], PRICES["pro_year"]
FLOOR = STEPS[-1][0]; FLOOR_M = len(STEPS)

# ----------------------------------------------------------------- piezas comunes
RCSS = PCSS + r'''
.tog span .sub{font-style:normal;font-size:13.5px;font-weight:700;color:var(--ink2);background:#E1E1E8;padding:3px 9px;border-radius:999px}
.tog span.on .sub{background:var(--tint);color:var(--accent)}
.rd{margin-top:52px;display:grid;grid-template-columns:minmax(0,430px) minmax(0,1fr);gap:0;background:#fff;border-radius:28px;box-shadow:0 0 0 3px var(--accent),var(--shadow-lg);position:relative}
.rd .tagx{position:absolute;top:-17px;left:215px;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:7px 16px;border-radius:999px;white-space:nowrap}
.rd .l{padding:36px 34px 32px;border-right:1px solid var(--line)}
.rd .r{padding:36px 38px 30px;min-width:0}
.rd h3{font-size:28px;font-weight:700;letter-spacing:-.02em}
.rd .who{font-size:17.5px;color:var(--ink2);margin-top:6px;line-height:1.4}
.rd .pr{display:flex;align-items:baseline;gap:8px;white-space:nowrap;margin-top:24px}
.rd .pr b{font-size:46px;font-weight:750;letter-spacing:-.045em;line-height:1}
.rd .pr span{font-size:18.5px;font-weight:600;color:var(--ink2)}
.rd .pn{font-size:17.5px;font-weight:650;margin-top:10px}
.rd .then{font-size:17px;color:var(--ink);margin-top:14px;line-height:1.45}
.rd .then b{color:var(--accent)}
.rd .btn{width:100%;margin-top:24px}
.rd .bn{font-size:15.5px;color:var(--ink2);margin-top:12px;line-height:1.5}
.rd .bn b{color:var(--ink);font-weight:650}
.rd .rst{display:flex;gap:10px;margin-top:16px;padding:12px 14px;border-radius:14px;background:#FFF7E8;box-shadow:inset 0 0 0 1px #F5DFB3;font-size:15.5px;line-height:1.45;color:#5C4210}
.rd .rst svg.i{width:20px;height:20px;flex:none;color:#B7791F;margin-top:1px}
.rd .rh{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.rd .rh h4{font-size:19px;font-weight:700}
.rd .rh small{font-size:15.5px;color:var(--ink2)}
/* escalera */
.st{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;align-items:end;height:300px;margin-top:22px;padding-bottom:4px;border-bottom:1.5px solid #E1E1E8}
.st .c{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;min-width:0}
.st .v{font-size:16px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.st .o{font-size:14.5px;font-weight:700;color:var(--accent);margin-top:2px;white-space:nowrap}
.st .o.z{color:var(--ink2)}
.st .bar{width:100%;border-radius:12px 12px 4px 4px;background:var(--tint);margin-top:8px;box-shadow:inset 0 0 0 1.5px #DCD6FF}
.st .c.fl .bar{background:var(--accent);box-shadow:none}
.st .c.first .bar{background:#EBEBF0;box-shadow:inset 0 0 0 1.5px #DCDCE3}
.stl{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;margin-top:10px}
.stl span{text-align:center;font-size:15px;font-weight:600;color:var(--ink2);white-space:nowrap}
.stl span.fl{color:var(--accent)}
.cmp{margin-top:22px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cmp div{border-radius:16px;background:var(--bg);padding:14px 16px}
.cmp div.me{background:var(--tint2);box-shadow:inset 0 0 0 1.5px #E4E0FF}
.cmp small{display:block;font-size:15px;color:var(--ink2);font-weight:600}
.cmp b{display:block;font-size:24px;font-weight:750;letter-spacing:-.02em;margin-top:2px}
.cmp em{display:block;font-style:normal;font-size:15px;color:var(--ink2);margin-top:2px}
.cmpn{font-size:15.5px;color:var(--ink2);margin-top:12px;line-height:1.5}
.oth{text-align:center;font-size:17px;color:var(--ink2);margin-top:30px}
.rd .rst b{color:#3D2A05}
.rd .chk{display:flex;gap:12px;margin-top:16px;font-size:15.5px;line-height:1.45;color:var(--ink)}
.rd .chk .box{width:22px;height:22px;flex:none;border-radius:6px;background:#fff;box-shadow:inset 0 0 0 2px #B9B9C6;margin-top:1px}
.rd .chk a{color:var(--accent);text-decoration:underline;font-weight:600}
.rd .btn[disabled]{opacity:.45;box-shadow:none;cursor:not-allowed}
.rd .btn.pay{margin-top:16px}
.rd .bh{font-size:14.5px;color:var(--ink2);margin-top:8px;text-align:center}
.rnd{font-size:15px;color:var(--ink2);margin-top:12px;line-height:1.45}
body.m .sth .srow .pq{font-size:14px;font-weight:700;color:var(--accent);white-space:nowrap;text-align:right}
/* móvil */
body.m .rd{display:block;margin-top:40px;border-radius:26px}
body.m .rd .tagx{left:50%}
body.m .rd .l{padding:30px 22px 24px;border-right:0;border-bottom:1px solid var(--line)}
body.m .rd .r{padding:24px 22px 24px}
body.m .rd .pr b{font-size:40px}
body.m .tog span{padding:0 6px;font-size:17px;gap:6px;flex-direction:column;justify-content:center;gap:0;height:58px}
body.m .tog span .sub{font-size:12px;padding:1px 7px;background:none!important}
body.m .sth{display:flex;flex-direction:column;gap:10px;margin-top:16px}
body.m .sth .srow{display:grid;grid-template-columns:62px minmax(0,1fr) 72px;align-items:center;gap:10px;font-size:16px}
body.m .sth .srow .mm{font-weight:600;color:var(--ink2);white-space:nowrap}
body.m .sth .srow .tr{height:26px;border-radius:8px;background:var(--tint);box-shadow:inset 0 0 0 1.5px #DCD6FF}
body.m .sth .srow.first .tr{background:#EBEBF0;box-shadow:inset 0 0 0 1.5px #DCDCE3}
body.m .sth .srow.fl .tr{background:var(--accent);box-shadow:none}
body.m .sth .srow .pv{text-align:right;font-weight:700;white-space:nowrap}
body.m .sth .srow.fl .mm{color:var(--accent)}
body.m .sth .srow{grid-template-columns:54px minmax(0,1fr) 60px 76px;gap:8px}
body.m .rd .btn.pay{font-size:16.5px;padding-left:10px;padding-right:10px;white-space:normal;height:auto;min-height:56px;line-height:1.25}
body.m .rd .rh{flex-direction:column;align-items:flex-start;gap:2px}
body.m .cmp{grid-template-columns:1fr;gap:8px}
body.m .cmp div{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:12px 14px}
body.m .cmp b{font-size:20px;margin:0}
body.m .cmp em{display:none}
'''
def mes_label(i): return f"Mes {i+1}+" if i == len(STEPS) - 1 else f"Mes {i+1}"
def staircase():
    cols, labs = [], []
    for i, (c, off) in enumerate(STEPS):
        cls = "c fl" if i == len(STEPS) - 1 else ("c first" if i == 0 else "c")
        h = round(210 * c / BASE)
        o = f'<div class="o">{off}% menos</div>' if off else '<div class="o z">&nbsp;</div>'   # Law R.2 / ux 4.2: no "Precio regular"/"Sin descuento"
        cols.append(f'<div class="{cls}"><div class="v">{mxn(c)}</div>{o}<div class="bar" style="height:{h}px"></div></div>')
        labs.append(f'<span class="{"fl" if i == len(STEPS)-1 else ""}">{mes_label(i)}</span>')
    return f'<div class="st" role="img" aria-label="Precio por mes: {", ".join(f"{mes_label(i)} {mxn(c)}" + (f", {o}% menos que el mes 1" if o else "") for i,(c,o) in enumerate(STEPS))}">{"".join(cols)}</div><div class="stl" aria-hidden="true">{"".join(labs)}</div>'
def staircase_h():
    rows = []
    for i, (c, off) in enumerate(STEPS):
        cls = "srow fl" if i == len(STEPS) - 1 else ("srow first" if i == 0 else "srow")
        rows.append(f'<div class="{cls}"><span class="mm">{mes_label(i)}</span><span class="tr" style="width:{round(100*c/BASE)}%"></span><span class="pv">{mxn(c)}</span><span class="pq">{f"{off}% menos" if off else ""}</span></div>')
    return f'<div class="sth">{"".join(rows)}</div>'
SCHED_TXT = ", ".join(mxn(c) for c, _ in STEPS[1:-1])          # $1,495, $1,329, $1,163, $997 y $831
SCHED_TXT = SCHED_TXT.rsplit(", ", 1)[0] + " y " + SCHED_TXT.rsplit(", ", 1)[1]
# ---- Law's exact strings (legal/aceptacion-ux.md §4.2; PRICING-2026-10-03-REVISION.md R.2) ----
RESET = (f"<b>Tu precio vuelve a {mxn(BASE)} si</b> cancelas (al terminar tu mes pagado), cambias a otro plan o un pago queda sin cubrir "
         f"7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician.")            # plans.lealtad.reset / billing.lealtad.warn
CONSENT = (f"Acepto que Chalyb cobre <b>hoy {mxn(BASE)} MXN</b> a mi tarjeta y después, <b>automáticamente cada mes</b>, {SCHED_TXT} MXN, "
           f"y luego <b>{mxn(FLOOR)} MXN al mes</b> mientras siga suscrito, hasta que cancele. Entiendo que <b>mi precio vuelve a empezar en {mxn(BASE)}</b> "
           f"si cancelo, cambio de plan o un pago queda sin cubrir 7 días después de fallar, y acepto los <a>Términos de Suscripción</a>.")  # checkout.lealtad.consent
PAY_BTN = f"Pagar {mxn(BASE)} y empezar {NAME}"
ROUNDING = "Montos con IVA incluido, redondeados hacia abajo al peso entero; el descuento real es igual o mayor al indicado."
VS_MENSUAL = (f"Del mes 1 al 4 pagas más que en Pro mensual ({mxn(PRO_M)}); desde el mes 6 pagas menos. "
              f"En el primer año, Pro anual ({mxn(PRO_Y)}) es lo más barato.")
def lealtad_panel(mobile=False):
    chart = staircase_h() if mobile else staircase()
    return f"""<section class="rd" aria-labelledby="pl-lealtad"><div class="tagx">Nuevo · Solo Pro</div>
<div class="l"><h3 id="pl-lealtad">{NAME}</h3><div class="who">Para quien se queda: cada mes que sigues con Pro, pagas menos.</div>
<div class="pr"><b>{mxn(BASE)}</b><span>MXN el primer mes</span></div>
<div class="pn">Se renueva cada mes · Sin prueba gratis</div>
<div class="then">Cada mes que sigues pagando, tu precio baja {STEP_PCT}% del precio del mes 1, hasta <b>{mxn(FLOOR)} MXN al mes desde el mes {FLOOR_M}</b> ({FLOOR_PCT}% menos).</div>
<div class="bn"><b>Se cobra hoy {mxn(BASE)} MXN.</b> Después se cobra automáticamente cada mes el monto del calendario, hasta que canceles. Te avisamos por correo y en la app 7 días antes de cada cobro, con su monto y fecha.</div>
<div class="rst">{ic("info")}<span>{RESET}</span></div>
<label class="chk"><span class="box" role="checkbox" aria-checked="false"></span><span>{CONSENT}</span></label>
<button class="btn btn-primary pay" disabled>{PAY_BTN}</button>
<div class="bh">Marca la casilla para continuar.</div></div>
<div class="r"><div class="rh"><h4>Así baja tu precio</h4><small>% = menos que el mes 1</small></div>{chart}
<div class="rnd">{ROUNDING}</div>
<div class="cmp"><div class="me"><small>{NAME}, 1.er año</small><b>{mxn(Y1)}</b><em>2.º año, si sigues: {mxn(Y2)}</em></div>
<div><small>Pro mensual, 1 año</small><b>{mxn(12*PRO_M)}</b><em>12 × {mxn(PRO_M)}</em></div>
<div><small>Pro anual, 1 año</small><b>{mxn(PRO_Y)}</b><em>Lo más barato el 1.er año</em></div></div>
<div class="cmpn">{VS_MENSUAL} Segundo año, si sigues: {NAME} {mxn(Y2)} · Pro anual {mxn(PRO_Y)} · Pro mensual {mxn(12*PRO_M)}.</div></div></section>"""
def pricing_page(mobile):
    tog = ('<div class="tog" role="radiogroup"><span role="radio" aria-checked="false">Mensual</span>'
           '<span role="radio" aria-checked="false">Anual <i class="sub">hasta −20%</i></span>'
           '<span class="on" role="radio" aria-checked="true">Lealtad <i class="sub">Solo Pro</i></span></div>')
    body = (f'<section class="band" id="precios"><div class="sec"><div class="shd"><div class="label">Planes</div>'
            f'<h2>Empieza gratis, crece con Pro</h2><p>Con {NAME}, cada mes que sigues pagas menos.</p>{tog}</div>'
            f'{lealtad_panel(mobile)}'
            f'<div class="oth">Gratis y VIP no tienen Pro Lealtad: <a class="lnk">ver Mensual y Anual</a></div>'
            f'<div class="pnote">Precios en MXN, IVA incluido.</div></div></section>')
    return (f'<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Precios · {NAME}</title>'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css">'
            f'<style>{RCSS}</style></head><body class="{"m" if mobile else ""}">{body}</body></html>')

# ----------------------------------------------------------------- 87 · Mi plan · Pro Lealtad (usuario en el mes 4)
CUR_STEP = 3                                   # mes 4 ⇒ escalón 3 ⇒ 30% menos
CUR, CUR_OFF = STEPS[CUR_STEP]; NXT, NXT_OFF = STEPS[CUR_STEP + 1]
COBRO = "8 de octubre de 2026"
css87 = css30 + FX + r'''
.shellv{display:flex;flex-direction:column;height:100vh}
.shellv .app{height:auto;flex:1;min-height:0}
.main{padding-top:26px}
.cols{margin-top:16px}
.colx > * + *{margin-top:18px}
.bnr{border-bottom:1px solid var(--warn-line)}
.plan .big{margin-top:10px}
.plan .stp{display:inline-flex;margin-left:10px;font-size:16px;font-weight:700;background:rgba(255,255,255,.2);padding:4px 11px;border-radius:999px;vertical-align:middle;letter-spacing:0}
.prog{padding:18px 22px 18px}
.prog .t{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.prog .t b{font-size:19px;font-weight:700}
.prog .t span{font-size:16px;color:var(--ink3-text);white-space:nowrap}
.prog .bar{position:relative;height:14px;border-radius:999px;background:#EBEBF0;margin-top:14px}
.prog .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--accent)}
.prog .tk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));margin-top:10px}
.prog .tk span{font-size:15px;color:var(--ink3-text);text-align:center;white-space:nowrap}
.prog .tk span.on{color:var(--accent);font-weight:700}
.prog .tk span.now{color:var(--ink);font-weight:700}
.prog .ft{font-size:16px;color:var(--ink2);margin-top:10px}
.wrn{display:flex;gap:12px;padding:16px 18px;border-radius:18px;background:#FFF7E8;box-shadow:inset 0 0 0 1px #F5DFB3;font-size:16.5px;line-height:1.45;color:#5C4210}
.wrn .wi{width:30px;height:30px;border-radius:50%;background:#FBE3B5;display:grid;place-items:center;flex:none;color:#9A5B00}
.wrn .wi svg{width:18px;height:18px}
.wrn b{color:#3D2A05}
'''
def ticks():
    out = []
    for i, (c, off) in enumerate(STEPS):
        cls = "now" if i == CUR_STEP else ("on" if i < CUR_STEP else "")
        out.append(f'<span class="{cls}">{mes_label(i)}</span>')
    return "".join(out)
pct_bar = round(100 * CUR_OFF / FLOOR_PCT)
left = len(STEPS) - 1 - CUR_STEP
b87 = f'''<div class="shellv">
<div class="bnr warn"><div class="bi">{ic("clock")}</div><div class="bt">El <b>{COBRO}</b> se cobran <b>{mxn(NXT)} MXN</b> de tu {NAME} (mes {CUR_STEP+2}), {NXT_OFF}% menos que tu mes 1. ¿No quieres seguir? Cancela antes de esa fecha y no se te cobra.</div></div>
<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="cols"><div class="colx">
<div class="plan"><div class="k">Tu plan · Activo</div><h2>{NAME}</h2><p>Mes {CUR_STEP+1}: pagas {mxn(CUR)}, {CUR_OFF}% menos que el mes 1.<br>Cada mes que sigues baja {STEP_PCT}% del mes 1, hasta {FLOOR_PCT}%.</p>
<div class="big">{mxn(CUR)} <span>MXN este mes</span><span class="stp">Mes {CUR_STEP+1}</span></div><div class="pb"><span class="inc">{ic("check")}Todo lo de Pro</span><button class="btn">Cambiar plan</button></div></div>
<div class="card prog" role="group" aria-label="Avance en tu calendario"><div class="t"><b>{CUR_OFF}% menos que el mes 1</b><span>Mes {CUR_STEP+1} · faltan {left}</span></div>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="{FLOOR_PCT}" aria-valuenow="{CUR_OFF}"><i style="width:{pct_bar}%"></i></div>
<div class="tk">{ticks()}</div>
<div class="ft">Desde el mes {FLOOR_M}: {mxn(FLOOR)} MXN al mes mientras sigas.</div></div>
<div><div class="ghead">Próximo cobro</div><div class="group">
{grow(icb("cal","#5B4BFF"),COBRO,f'<span class="val"><b>{mxn(NXT)} MXN</b></span>',f"Mes {CUR_STEP+2} · {NXT_OFF}% menos que el mes 1")}
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Visa ••4821</span>',"Vence 08/29")}</div></div></div>
<div class="colx">
<div class="wrn" role="note"><div class="wi">{ic("alert")}</div><div>{RESET}</div></div>
<div><div class="ghead">Cambiar de plan</div><div class="group">
{grow(icb("swap","#0A84FF"),"Pasar a Pro anual",f'<span class="act">{mxn(PRO_Y)} al año</span>',"Tu precio vuelve a empezar en " + mxn(BASE))}
{grow(icb("star","#AF52DE"),"Subir a VIP",f'<span class="act">{mxn(PRICES["vip_month"])} al mes</span>',"Tu precio vuelve a empezar en " + mxn(BASE))}
{grow(icb("down","#8E8E93"),"Pasar a Gratis",'<span class="act">$0</span>',"Al terminar tu mes pagado")}</div></div>
<div><div class="ghead">Facturas</div><div class="group">
{grow(icb("receipt","#8E8E93"),"8 de septiembre de 2026",f'<span class="val">{mxn(CUR)} · CFDI</span>',f"{NAME} · mes {CUR_STEP+1}")}</div></div>
<div><div class="group"><div class="row cancel">{icb("x","#FF3B30")}<div class="tx"><b>Cancelar suscripción</b><small>Sigues con Pro hasta el {COBRO}. No habrá más cobros. Si vuelves después, {NAME} empieza otra vez en {mxn(BASE)}.</small></div>{ic("chev","i chev")}</div></div></div>
</div></div></div></main></div></div>'''

if __name__ == "__main__":
    write("86-precios-reducto.html", pricing_page(False))
    write("88-reducto-movil.html", pricing_page(True))
    write("87-mi-plan-reducto.html", page2(f"Mi plan · {NAME}", b87, css87))
    print("schedule:", [(mes_label(i), mxn(c), f"-{o}%", f"{(BASE-c)*100/BASE:.3f}%") for i, (c, o) in enumerate(STEPS)])
    print("Y1", mxn(Y1), "Y2", mxn(Y2), "| Pro mensual 12x", mxn(12*PRO_M), "| Pro anual", mxn(PRO_Y))
