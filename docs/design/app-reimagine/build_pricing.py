# ===================== 80-85 · Tarjetas de precios (rediseño para conversión) =====================
# Genera html/80-…85-*.html reutilizando html/style.css (tokens). Standalone: no toca build.py ni
# los mockups existentes. Captura con render_pricing.py (Playwright, 2x, Inter).
#
# Montos: TODOS salen de PRICES (abajo) = precios FINALES al cliente, IVA incluido (dueño, 2026-10-03).
# Ahorro = 12×mensual − anual; la línea de ahorro SOLO aparece si ahorro > 0 (nunca "Ahorras $0").
# Descuento vs. precio regular = (regular − actual)/regular, calculado, nunca escrito a mano.
import os, sys, math, datetime
B = os.path.dirname(os.path.abspath(__file__)); H = os.path.join(B, "html")

def svg(d, cls="i", style=""):
    return f'<svg class="{cls}" viewBox="0 0 24 24" style="{style}">{d}</svg>'
CHECK = svg('<path d="M20 6 9 17l-5-5"/>')
XMARK = svg('<path d="M18 6 6 18M6 6l12 12"/>')
GIFT = svg('<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>')
ARROW = svg('<path d="M5 12h14M13 5l7 7-7 7"/>')
USER = svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>')
SHIELD = svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>')

CSS = r'''
body{font-family:"Inter",-apple-system,system-ui,sans-serif;background:#fff}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;padding:5px 12px;border-radius:999px;white-space:nowrap;font-style:normal}
.pill svg.i{width:16px;height:16px}
.pill.acc{background:var(--tint);color:var(--accent)}
.pill.gray{background:#EEEEF2;color:var(--ink2)}
.pill.dark{background:var(--ink);color:#fff}
.lnk{color:var(--accent);font-weight:600;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.tag-ej{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#8E6A00;background:#FFF6D6;border:1px dashed #E8C55A;padding:3px 8px;border-radius:7px;white-space:nowrap}
.band{background:#fff;padding:96px 0 88px}
.sec{max-width:1280px;margin:0 auto;padding:0 40px}
.shd{text-align:center;max-width:880px;margin:0 auto}
.shd .label{margin-bottom:14px}
.shd h2{font-size:48px;letter-spacing:-.04em;line-height:1.08;font-weight:750}
.shd p{font-size:21px;color:var(--ink2);margin-top:14px;line-height:1.45}
.ejbar{display:flex;justify-content:center;margin-top:18px}
/* toggle — sits ABOVE the cards, centred */
.tog{display:inline-flex;background:#EBEBF0;border-radius:18px;padding:5px;margin-top:30px;gap:4px}
.tog span{height:54px;padding:0 26px;display:flex;align-items:center;gap:10px;border-radius:14px;font-size:19px;font-weight:600;color:var(--ink2)}
.tog span.on{background:#fff;color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.10)}
.tog .pill{font-size:13.5px;padding:4px 10px}
/* cards: one grid, subgrid rows => equal heights + every row (price, CTA, list) aligned */
.pc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(6,auto);column-gap:24px;row-gap:0;margin-top:52px;align-items:stretch}
.pk{grid-row:span 6;display:grid;grid-template-rows:subgrid;row-gap:0;background:var(--bg);border-radius:28px;padding:34px 28px 32px;position:relative;min-width:0}
.pk.hi{background:#fff;box-shadow:0 0 0 3px var(--accent),var(--shadow-lg)}
.pk .tagx{position:absolute;top:-17px;left:50%;transform:translateX(-50%);background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:7px 16px;border-radius:999px;white-space:nowrap}
.pk .tagx.cur{background:var(--ink)}
.pk .hd h3{font-size:26px;font-weight:700;letter-spacing:-.02em;display:flex;align-items:center;gap:10px}
.pk .hd .who{font-size:17.5px;color:var(--ink2);margin-top:6px;line-height:1.4}
.pk .hd .chip{margin-top:14px;font-size:15px;padding:7px 14px 7px 11px}
.pk .pb{margin-top:24px;container-type:inline-size}
.pk .pr{display:flex;align-items:baseline;gap:8px;white-space:nowrap;flex-wrap:nowrap}
.pk .pr b{font-size:clamp(30px,12.2cqi,46px);font-weight:750;letter-spacing:-.045em;line-height:1}
.pk .pr span{font-size:clamp(14px,5cqi,18.5px);font-weight:600;color:var(--ink2);letter-spacing:-.01em}
.pk .pn{font-size:17.5px;color:var(--ink);font-weight:650;margin-top:10px}
.pk .pb .tag-ej{margin-bottom:10px}
.pk .ref{font-size:15.5px;color:var(--ink2);margin-top:6px}
.pk .vl .save-g{font-size:16px;color:var(--ink2);font-weight:600}
.lnk.mute{color:var(--ink2)}
.pk .vl{margin-top:14px;min-height:30px}
.pk .vl .pill{font-size:15px}
.pk .vl .muted2{font-size:16.5px;color:var(--ink2)}
.pk .vl .swy{font-size:16.5px}
.pk .vl .was{display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap}
.pk .vl .was s{font-size:18px;font-weight:600;color:var(--ink2);text-decoration-thickness:1.5px}
.pk .vl .refl{font-size:15.5px;color:var(--ink2);line-height:1.45;margin-top:4px}
.pk .vl .refl b{color:var(--ink);font-weight:650}
.ph{font-style:normal;font-weight:700;color:#8E6A00;background:#FFF6D6;border:1px dashed #E8C55A;padding:0 5px;border-radius:5px;white-space:nowrap}
.pk .vl .launch{font-size:16px;font-weight:650;color:var(--ink)}
.pk .ct{margin-top:24px}
.pk .btn{width:100%}
.pk .btn.cur{background:#EBEBF0;color:var(--ink2);box-shadow:none}
.pk .bn{font-size:15.5px;color:var(--ink2);text-align:center;margin-top:12px;line-height:1.45}
.pk .bn b{color:var(--ink);font-weight:650}
.pk .ft{margin-top:24px;padding-top:22px;border-top:1px solid #E1E1E8;align-self:start}
.pk.hi .ft{border-top-color:var(--line)}
.pk .ft h4{font-size:15px;font-weight:700;color:var(--ink);margin-bottom:14px;letter-spacing:-.005em}
.pk ul{list-style:none;display:flex;flex-direction:column;gap:13px}
.pk li{display:flex;gap:12px;font-size:17.5px;line-height:1.38}
.pk li .ck{width:26px;height:26px;border-radius:50%;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.pk li .ck svg{width:15px;height:15px;stroke-width:3}
.pk li.no{color:var(--ink3)} .pk li.no .ck{background:#E9E9EE;color:#A8A8B0}
.pnote{text-align:center;font-size:17px;color:var(--ink2);margin-top:40px;line-height:1.6}
.pnote small{display:block;font-size:15px;color:var(--ink2);margin-top:4px}
.pnote a{display:table;margin:10px auto 0}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
/* ---------- mobile 390 ---------- */
body.m .band{padding:56px 0 48px}
body.m .sec{padding:0 20px}
body.m .shd h2{font-size:31px;line-height:1.12}
body.m .shd p{font-size:18px}
body.m .tog{display:flex;width:100%;margin-top:22px;border-radius:16px;padding:4px}
body.m .tog span{flex:1;justify-content:center;height:52px;padding:0 10px;font-size:18px;border-radius:13px}
body.m .tog .pill{font-size:12.5px;padding:3px 8px}
body.m .pc{display:flex;flex-direction:column;gap:30px;margin-top:40px}
body.m .pk{display:block;padding:30px 22px 26px;border-radius:26px}
body.m .pk .vl{min-height:0}
body.m .pk .btn{height:60px}
body.m .pnote{font-size:16px;margin-top:30px}
'''

def li(items, no_label='No incluye: '):
    out = []
    for it in items:
        no = it.startswith("!")
        t = it[1:] if no else it
        mark = XMARK if no else CHECK
        sr = f'<span class="sr">{no_label}</span>' if no else ''
        out.append(f'<li class="{"no" if no else ""}"><span class="ck">{mark}</span><span>{sr}{t}</span></li>')
    return "<ul>" + "".join(out) + "</ul>"

def card(c):
    cls = "pk hi" if c.get("hi") else "pk"
    tag = ""
    if c.get("current_badge"): tag = f'<div class="tagx cur">{c["current_badge"]}</div>'
    elif c.get("badge"): tag = f'<div class="tagx">{c["badge"]}</div>'
    chip = f'<div><span class="pill acc chip">{GIFT}{c["chip"]}</span></div>' if c.get("chip") else ""
    ej = f'<div><span class="tag-ej">{c["example"]}</span></div>' if c.get("example") else ""
    unit = f'<span>{c["unit"]}</span>' if c.get("unit") else ""
    ref = f'<div class="ref">{c["ref"]}</div>' if c.get("ref") else ""
    price = f'<div class="pb">{ej}<div class="pr"><b>{c["price"]}</b>{unit}</div><div class="pn">{c["renew"]}</div>{ref}</div>'
    vl = f'<div class="vl">{c.get("value","")}</div>'
    if c.get("btn_current"):
        btn = f'<button class="btn cur" aria-disabled="true">{c["cta"]}</button>'
    else:
        btn = f'<button class="btn {"btn-primary" if c.get("primary") else "btn-secondary"}">{c["cta"]}</button>'
    ct = f'<div class="ct">{btn}</div>'
    bn = f'<div class="bn">{c.get("note","")}</div>'
    ft = f'<div class="ft">{f"<h4>{c[chr(102)+chr(104)]}</h4>" if c.get("fh") else ""}{li(c["feats"], c.get("no_label","No incluye: "))}</div>'
    return (f'<section class="{cls}" aria-labelledby="pl-{c["id"]}">{tag}'
            f'<div class="hd"><h3 id="pl-{c["id"]}">{c["name"]}</h3><div class="who">{c["who"]}</div>{chip}</div>'
            f'{price}{vl}{ct}{bn}{ft}</section>')

def toggle(t, yearly):
    m, y, save = t
    return (f'<div class="tog" role="radiogroup"><span class="{"" if yearly else "on"}" role="radio" aria-checked="{str(not yearly).lower()}">{m}</span>'
            f'<span class="{"on" if yearly else ""}" role="radio" aria-checked="{str(yearly).lower()}">{y}{f" <i class=\"pill acc\">{save}</i>" if save else ""}</span></div>')

def section(s):
    tog = toggle(s["toggle"], s["yearly"]) if s.get("toggle") else ""
    ej = f'<div class="ejbar"><span class="tag-ej">{s["ejbar"]}</span></div>' if s.get("ejbar") else ""
    order = [s["pro"], s["gratis"], s["vip"]] if s.get("mobile") else [s["gratis"], s["pro"], s["vip"]]
    cards = "".join(card(c) for c in order)
    foot = f'<small>{s["foot"]}</small>' if s.get("foot") else ""
    return (f'<section class="band" id="precios"><div class="sec"><div class="shd"><div class="label">{s["label"]}</div>'
            f'<h2>{s["title"]}</h2><p>{s["sub"]}</p>{ej}{tog}</div><div class="pc">{cards}</div>'
            f'<div class="pnote">{s["tax"]}{foot}<a class="lnk">{s["all"]}</a></div></div></section>')

def page(name, title, s, lang="es-MX"):
    body_cls = "m" if s.get("mobile") else ""
    html = (f'<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><title>{title}</title>'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<link rel="stylesheet" href="style.css"><style>{CSS}</style></head>'
            f'<body class="{body_cls}">{section(s)}</body></html>')
    open(os.path.join(H, name + ".html"), "w").write(html)

# ----------------------------------------------------------------- precios (una sola tabla)
# Centavos, IVA INCLUIDO (lo que paga el cliente). Fuente: dueño 2026-10-03. => PRICES_INCLUDE_IVA=true.
PRICES = dict(pro_month=99_700, pro_year=997_000,   # Pro anual $9,970 "promo aplicada" (dueño 08:51)
              vip_month=379_900, vip_year=3_632_500)
# Precio "regular" tachado junto a Pro mensual. PENDIENTE LEGAL (L8): debe ser un precio realmente cobrado.
REF = dict(pro_month=166_200)      # $1,662 (dueño 08:55) → 40.01% → "40%". $1,395 era el precio anterior real.
SHOW_REFERENCE_PRICE = False   # Ley Q2: apagado por defecto hasta que exista la evidencia. Cada pantalla puede forzarlo (81 = encendido).
REF_SITE, REF_UNTIL, PROMO_UNTIL = "[sitio]", "[fecha]", "[fecha]"   # los da el dueño con la evidencia
PCT_ROUNDING = "floor"   # "floor" nunca exagera (16.67% → 16). "round" daría 17. Decisión D14.
# Prueba (dueño + Ley 2026-10-03): 7 días, Pro mensual Y Pro anual, nunca VIP ni Pro Lealtad. = PRICING.trial.days
TRIAL_DAYS = 7          # Ley 2026-10-03 Q3: 7 días (aviso de cobro el día 0 = 7 días antes, ≥5 por LFPC 76 Bis VIII)
RENDER_DAY = datetime.date(2026, 10, 3)            # "hoy" de los mockups; en código = now() en America/Mexico_City
CHARGE_DAY = RENDER_DAY + datetime.timedelta(days=TRIAL_DAYS)
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()
FECHA_ES = f"{CHARGE_DAY.day} de {MESES[CHARGE_DAY.month-1]}"          # 6 de octubre
FECHA_EN = CHARGE_DAY.strftime("%B ") + str(CHARGE_DAY.day)            # October 6
# USD (mockup 84): precios finales, dólares enteros.
USD = dict(pro_month=50, pro_year=500, vip_month=200, vip_year=2_000)
USD_REF = dict()   # Ley Q2: sin US$84 tachado salvo evidencia de ofertas reales a EE. UU./Canadá → "Launch price"

DUMMY = "--dummy" in sys.argv          # solo prueba de layout: monto ficticio largo, a /tmp
OUT = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else H
if DUMMY:
    PRICES = dict(PRICES, vip_year=9_999_999)

def total(k): return PRICES[k]
def mxn(c):                                                     # = formatMXN
    return f"${c/100:,.0f}" if c % 100 == 0 else f"${c/100:,.2f}"
def mxn_floor(c): return mxn(c // 100 * 100)                    # = formatMXNFloor
def pct(save, base):
    v = save * 100 / base
    return str(math.floor(v) if PCT_ROUNDING == "floor" else round(v))
def annual(tier):                                               # = annualMath(tier)
    m, y = total(f"{tier}_month"), total(f"{tier}_year")
    sv = 12 * m - y
    return dict(month=m, year=y, vs=12 * m, save=sv, pct=pct(sv, 12 * m) if sv > 0 else None)
def discount(now, reg): return pct(reg - now, reg)               # 997 vs 1,395 → 28 (no 40)
def usd(k): return f"${USD[k]:,}"
def usd_annual(tier):
    m, y = USD[f"{tier}_month"], USD[f"{tier}_year"]
    sv = 12 * m - y
    return dict(save=sv, pct=pct(sv, 12 * m) if sv > 0 else None)
def best_pct(*aa):
    v = [int(a["pct"]) for a in aa if a["pct"]]
    return str(max(v)) if v else None

# ----------------------------------------------------------------- copy (es) — ver PRICING-CARDS-SPEC.md §6 / §12
GRATIS_F = ["Haz clips para probar (calidad SD, con marca de agua)", "Tus resultados se guardan 7 días",
            "500 MB para tus videos y archivos", "!Clips de tus transmisiones en vivo"]
PRO_F = ["Clips sin marca de agua, en HD", "Clips de hasta 12 transmisiones en vivo al mes",
         "Tus resultados se guardan 90 días", "5 GB para tus videos y archivos", "Cancela en 1 clic, sin llamadas"]
VIP_F = ["Clips en 4K", "Clips de transmisiones en vivo sin límite al mes",
         "Tus resultados se guardan 1 año", "50 GB para tus videos y archivos"]
PAID_NOTE = "Se cobra hoy. Cancela en 1 clic, sin llamadas."

def es_gratis(current=False):
    return dict(id="gratis", name="Gratis", who="Para conocer Chalyb", price="$0", renew="Sin tarjeta · Para siempre",
                cta="Tu plan actual" if current else "Crear cuenta gratis", btn_current=current,
                current_badge="Tu plan" if current else None, fh="Incluye:", feats=GRATIS_F)

def ph(t): return f'<i class="ph">{t}</i>'
def es_pro(yearly, trial, annual_offered=True, show_ref=None):
    """yearly: toggle en Anual · trial: trialOffered (7 días, Pro mensual y anual) · show_ref: SHOW_REFERENCE_PRICE."""
    show_ref = SHOW_REFERENCE_PRICE if show_ref is None else show_ref
    a = annual("pro") if annual_offered else None
    c = dict(id="pro", name="Pro", who="Para quien publica cada semana", hi=True, primary=True, fh="Incluye:", feats=PRO_F,
             badge="Más popular")       # Ley L3: no "Mejor oferta" (VIP anual ahorra más). Requiere dato que lo respalde.
    if yearly:
        c.update(price=mxn(a["year"]), unit="MXN al año", renew="Se renueva cada año",
                 ref=f"o paga mes a mes: {mxn(a['month'])} MXN al mes (plan mensual)")
        if a["save"] > 0:
            c["value"] = f'<span class="pill acc">Ahorras {mxn_floor(a["save"])} al año · {a["pct"]}%</span>'
        charge, paid_cta = a["year"], "Elegir Pro anual"
    else:
        c.update(price=mxn(total("pro_month")), unit="MXN al mes", renew="Se renueva cada mes")
        if show_ref and REF.get("pro_month"):     # Ley Q2, etiqueta A: sitio + fecha, periodo limitado
            r = REF["pro_month"]
            c["value"] = (f'<div class="was"><s><span class="sr">Precio anterior: </span>{mxn(r)}</s></div>'   # sin pill "40%" suelto (Ley Q2)
                          f'<div class="refl">Precio anterior en {ph(REF_SITE)} hasta el {ph(REF_UNTIL)}. Aquí pagas {discount(total("pro_month"), r)}% menos. '
                          f'Precio de lanzamiento vigente hasta el {ph(PROMO_UNTIL)}.</div>')
        else:                                      # Ley Q2, opción C
            c["value"] = f'<span class="launch">Precio de lanzamiento: {mxn(total("pro_month"))} MXN al mes</span>'
        charge, paid_cta = total("pro_month"), "Elegir Pro mensual"
    if trial:   # ⚖ copy exacto de Ley Q3 ("Under the CTA on the card"). Sin recordatorio día 6 (dueño).
        c.update(chip=f"{TRIAL_DAYS} días gratis", cta=f"Empezar mis {TRIAL_DAYS} días gratis",
                 note=(f"<b>Hoy pagas $0.</b> El {FECHA_ES} se cobran {mxn(charge)} MXN por el año completo y se renueva cada año, automáticamente. Cancela cuando quieras."
                       if yearly else
                       f"<b>Hoy pagas $0.</b> El {FECHA_ES} se cobran {mxn(charge)} MXN y después cada mes, automáticamente. Cancela cuando quieras."))
    else:
        c.update(cta=paid_cta, note=PAID_NOTE)
    return c

def es_vip(yearly, annual_offered=True):
    c = dict(id="vip", name="VIP", who="Para quien transmite a diario o maneja varios canales",
             fh="Todo lo de Pro, más:", feats=VIP_F)
    if yearly:
        a = annual("vip")
        c.update(price=mxn(a["year"]), unit="MXN al año", renew="Se renueva cada año",
                 ref=f"o paga mes a mes: {mxn(a['month'])} MXN al mes (plan mensual)",
                 cta="Elegir VIP anual", note=PAID_NOTE)
        if a["save"] > 0:
            c["value"] = f'<span class="save-g">Ahorras {mxn_floor(a["save"])} al año · {a["pct"]}%</span>'
    else:
        c.update(price=mxn(total("vip_month")), unit="MXN al mes", renew="Se renueva cada mes",
                 cta="Elegir VIP mensual" if annual_offered else "Elegir VIP", note=PAID_NOTE)
        if annual_offered and annual("vip")["save"] > 0:
            a = annual("vip")
            c["value"] = f'<a class="lnk mute swy">Cambia a Anual y ahorra {mxn_floor(a["save"])} al año</a>'
    return c

def es_section(yearly, trial, mobile=False, gratis_current=False, annual_offered=True, show_ref=None):
    best = best_pct(annual("pro"), annual("vip")) if annual_offered else None
    return dict(label="Planes", title="Empieza gratis, crece con Pro",
                sub=f"Prueba Pro gratis {TRIAL_DAYS} días. Cancela en 1 clic, sin llamadas." if trial else "Cancela en 1 clic, sin llamadas.",
                toggle=("Mensual", "Anual", f"Ahorra hasta {best}%" if best else None) if annual_offered else None,
                yearly=yearly, mobile=mobile,
                gratis=es_gratis(gratis_current), pro=es_pro(yearly, trial, annual_offered, show_ref), vip=es_vip(yearly, annual_offered),
                tax="Precios en MXN, IVA incluido.",
                foot=f"Prueba Pro gratis {TRIAL_DAYS} días: mensual o anual, una vez por cuenta y por tarjeta. VIP no tiene prueba." if trial else None,
                all="Ver todos los planes y qué incluyen")

# ----------------------------------------------------------------- 84 · English / USD market version (precios finales)
def en_section(country="US"):
    tax_en = "plus any sales tax" if country == "US" else "plus applicable GST/HST (and QST in Quebec)"
    p, v = usd_annual("pro"), usd_annual("vip")
    best = best_pct(p, v)
    return dict(label="Pricing", title="Start free, grow with Pro",
      sub=f"Try Pro free for {TRIAL_DAYS} days. Cancel online anytime.",
      toggle=("Monthly", "Yearly", f"Save up to {best}%" if best else None), yearly=True,
      gratis=dict(id="gratis", name="Free", who="See what Chalyb can do", price="$0", renew="No card needed · Free forever",
                  cta="Create free account", fh="What you get:", no_label="Not included: ",
                  feats=["Test clips (SD, watermarked)", "7 days of history", "500 MB of storage", "!Clips from your live streams"]),
      pro=dict(id="pro", name="Pro", who="For creators who post every week", hi=True, badge="Most popular", primary=True,
               price=usd("pro_year"), unit="USD / year", renew="Renews every year",
               ref=f"or pay month to month: US{usd('pro_month')}/month (monthly plan)",
               value=f'<span class="pill acc">Save ${p["save"]:,} a year · {p["pct"]}%</span>' if p["save"] > 0 else "",
               chip=f"{TRIAL_DAYS} days free", cta=f"Start my {TRIAL_DAYS}-day free trial",
               note=f"<b>$0 today.</b> On {FECHA_EN} you’ll be charged US{usd('pro_year')} for the full year, {tax_en}, and it renews every year until you cancel. Cancel anytime.",
               fh="What you get:",
               feats=["Watermark-free clips in HD", "Clip up to 12 live streams a month", "90 days of history",
                      "5 GB of storage", "Cancel online anytime, no calls"]),
      vip=dict(id="vip", name="VIP", who="For daily streamers and multi-channel creators",
               price=usd("vip_year"), unit="USD / year", renew="Renews every year",
               ref=f"or pay month to month: US{usd('vip_month')}/month (monthly plan)",
               value=f'<span class="save-g">Save ${v["save"]:,} a year · {v["pct"]}%</span>' if v["save"] > 0 else "",
               cta="Choose VIP yearly", note=f"Charged today: US{usd('vip_year')} for the full year, {tax_en}. Renews every year. Cancel online anytime.",
               fh="Everything in Pro, plus:",
               feats=["4K clip exports", "Unlimited live streams to clip", "A full year of history", "50 GB of storage"]),
      tax=("Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay." if country == "US" else
           "Prices in US dollars (USD). GST/HST and, in Quebec, QST are added where applicable and shown before you pay."), foot=f"Free trial: {TRIAL_DAYS} days, Pro monthly or yearly, one per account and card. No trial on VIP.",
      all="Compare all plans")

# ----------------------------------------------------------------- pantallas
SCREENS = [
 ("80-precios-anual", "Precios · Anual · prueba disponible", lambda: es_section(True, True), "es-MX"),
 ("81-precios-mensual", "Precios · Mensual · SHOW_REFERENCE_PRICE encendido", lambda: es_section(False, True, show_ref=True), "es-MX"),
 ("82-precios-prueba-usada", "Precios · prueba ya usada (con sesión, plan Gratis)", lambda: es_section(True, False, gratis_current=True), "es-MX"),
 ("83-precios-movil", "Precios · móvil · Anual", lambda: es_section(True, True, mobile=True), "es-MX"),
 ("84-precios-en", "Pricing · EN/USD · US visitor", lambda: en_section("US"), "en"),
 ("84b-precios-en-ca", "Pricing · EN/USD · Canada visitor", lambda: en_section("CA"), "en"),
 # 85: flujo nuevo apagado ⇒ ningún plan anual (ni Pro ni VIP) se puede comprar ⇒ solo Mensual.
 ("85-precios-sin-prueba", "Precios · TRIAL_FLOW_ENABLED apagado · SHOW_REFERENCE_PRICE apagado", lambda: es_section(False, False, annual_offered=False, show_ref=False), "es-MX"),
]
only = [a for a in sys.argv[1:] if a[:2].isdigit()]
H_OUT = OUT
for name, title, build, lang in SCREENS:
    if only and not any(name.startswith(o) for o in only): continue
    s = build()
    if DUMMY: s["title"] = "PRUEBA DE LAYOUT · montos ficticios"
    H = H_OUT; page(name, title, s, lang=lang)
    print("built", name, "→", H_OUT)
