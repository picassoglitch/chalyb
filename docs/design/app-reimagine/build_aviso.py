# ===================== 89 · Aviso de nuevo precio (suscriptores actuales) =====================
# Copy EXACTO de legal/aceptacion-ux.md §4.1 (modal) y legal/PRICING-2026-10-03-REVISION.md Q1.
# Aviso exactamente 30 días antes de la renovación en que aplica; sin aceptación expresa no se cobra el precio nuevo.
# Reusa el shell de la app (build_reducto.py → build_fix3.py). Correr: python3 build_aviso.py && python3 render_reducto.py 89
import os, datetime
import build_reducto as R
mxn, ic, icb, grow, side, page2, css30, FX = R.mxn, R.ic, R.icb, R.grow, R.side, R.page2, R.css30, R.FX
OLD, NEW = 74_900, R.PRICES["pro_month"]                     # $749 (producción) → $997
TODAY = datetime.date(2026, 10, 3)
APPLY = TODAY + datetime.timedelta(days=30)                  # exactamente 30 días (ni 29 ni 31)
REMIND = APPLY - datetime.timedelta(days=7)
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()
def f(d): return f"{d.day} de {MESES[d.month-1]} de {d.year}"
PCT = (NEW - OLD) * 100 // OLD                                # 33 (33.1, hacia abajo)
OPTION = "a"   # "a" = no se renueva → Gratis (Términos §5.3) · "b" = sigue pagando $749 (decisión del dueño pendiente)
css = css30 + FX + r'''
.shellv{display:flex;flex-direction:column;height:100vh;position:relative}
.shellv .app{height:auto;flex:1;min-height:0}
.main{padding-top:30px}
.dim{position:absolute;inset:0;background:rgba(20,20,28,.42);z-index:4}
.md{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:600px;background:#fff;border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.28);padding:34px 36px 28px;z-index:5}
.md .k{font-size:15px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--accent)}
.md h2{font-size:30px;font-weight:750;letter-spacing:-.03em;margin-top:6px}
.md .cmp{display:flex;align-items:center;gap:16px;margin-top:20px;padding:16px 20px;border-radius:18px;background:var(--bg)}
.md .cmp .o{font-size:17px;color:var(--ink2)}
.md .cmp .o b{display:block;font-size:26px;color:var(--ink2);font-weight:700;letter-spacing:-.02em}
.md .cmp .n{font-size:17px;color:var(--ink)}
.md .cmp .n b{display:block;font-size:30px;font-weight:750;letter-spacing:-.03em}
.md .cmp .ar{color:var(--ink3);width:26px;height:26px}
.md .cmp .pct{margin-left:auto;font-size:16px;font-weight:700;color:#9A5B00;background:#FFF1D6;padding:5px 12px;border-radius:999px;white-space:nowrap}
.md p{font-size:18px;line-height:1.5;margin-top:16px;color:var(--ink)}
.md p.s{color:var(--ink2);font-size:16.5px;margin-top:10px}
.md .acts{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.md .acts .btn{width:100%}
.md .acts .row2{display:flex;gap:10px}
.md .acts .row2 .btn{flex:1}
.md .lnkc{color:var(--bad);font-weight:600}
'''
no_accept = (f"Solo se te cobrará si lo aceptas. Si no, conservas Pro hasta el {f(APPLY)} y después pasas a Gratis, sin cobro."
             if OPTION == "a" else f"Solo se te cobrará si lo aceptas. Si no, seguirás pagando {mxn(OLD)} MXN al mes.")
body = f'''<div class="shellv">
<div class="app">{side("Plan Pro")}<main class="main"><div class="wrap">
<div class="crumb">Mi cuenta ›</div><h1>Mi plan</h1>
<div class="cols"><div class="colx">
<div class="plan"><div class="k">Tu plan · Activo</div><h2>Pro mensual</h2><p>Se renueva cada mes.<br>Cambio de precio: {f(APPLY)}</p>
<div class="big">{mxn(OLD)} <span>MXN al mes</span></div><div class="pb"><span class="inc">{ic("check")}Todo lo de Pro</span><button class="btn">Cambiar plan</button></div></div></div>
<div class="colx"><div><div class="ghead">Próximo cobro</div><div class="group">
{grow(icb("cal","#5B4BFF"),f(APPLY),f'<span class="val"><b>{mxn(NEW)} MXN</b></span>',"Solo si aceptas el nuevo precio" if OPTION == "a" else f"Si no aceptas: {mxn(OLD)} MXN")}
{grow(icb("card","#34C759"),"Método de pago",'<span class="val">Visa ••4821</span>',"Vence 08/29")}</div></div></div>
</div></div></main></div>
<div class="dim"></div>
<div class="md" role="dialog" aria-modal="true" aria-labelledby="pc-t">
<div class="k">Aviso de cambio de precio · {f(TODAY)}</div>
<h2 id="pc-t">Cambia el precio de tu plan Pro</h2>
<div class="cmp"><div class="o">Hoy<b>{mxn(OLD)}</b></div>{ic("arrow","i ar")}<div class="n">Desde el {APPLY.day} de {MESES[APPLY.month-1]}<b>{mxn(NEW)}</b></div><span class="pct">+{PCT}%</span></div>
<p>Hoy pagas {mxn(OLD)} MXN al mes. A partir del {f(APPLY)}: <b>{mxn(NEW)} MXN al mes</b>, IVA incluido.</p>
<p>{no_accept}</p>
<p class="s">Te lo recordamos el {f(REMIND)} si aún no decides.</p>
<div class="acts"><button class="btn btn-primary btn-xl">Acepto el nuevo precio</button>
<div class="row2"><button class="btn btn-secondary">No, gracias</button><button class="btn btn-secondary"><span class="lnkc">Cancelar mi plan</span></button></div></div>
</div></div>'''
open(os.path.join(R.H, "89-aviso-nuevo-precio.html"), "w", encoding="utf-8").write(page2("Mi plan · aviso de nuevo precio", body, css))
print("built 89", f(TODAY), "→", f(APPLY), "remind", f(REMIND), f"+{PCT}%", "option", OPTION)
