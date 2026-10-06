# ===== Shared helpers for screens 09-30 (exec'd inside build.py namespace) =====
P.update({
 "bot":'<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="14" r="1.3" fill="currentColor"/><circle cx="15" cy="14" r="1.3" fill="currentColor"/>',
 "target":'<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
 "house":'<path d="M3 11 12 4l9 7"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
 "chart":'<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>',
 "search":'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 "info":'<circle cx="12" cy="12" r="9.5"/><path d="M12 11v6M12 7.5v.01"/>',
 "alert":'<path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/>',
 "mic":'<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
 "cam":'<path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
 "refresh":'<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/>',
 "dots":'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
 "users":'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4.5-6.5"/>',
 "money":'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v.01M18 14.5v.01"/>',
 "gauge":'<path d="M12 14 15.5 9"/><path d="M3.3 17a9.5 9.5 0 1 1 17.4 0"/><circle cx="12" cy="14" r="1.6" fill="currentColor"/>',
 "activity":'<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
 "gear":'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
 "bulb":'<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>',
 "eye":'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 "cal":'<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
 "up":'<path d="M7 17 17 7M8 7h9v9"/>', "down":'<path d="M7 7l10 10M17 8v9H8"/>', "pause":'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
 "gift":'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
 "phone":'<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
 "logout":'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
 "receipt":'<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
 "menu":'<path d="M4 7h16M4 12h16M4 17h16"/>',
 "swap":'<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>',
})
TOOLS = [  # (name, icon, one-liner, color)
 ("Clips","scissors","Convierte tu stream en clips cortos para TikTok, Reels y Shorts.","#5B4BFF"),
 ("Señales","trend","Te avisamos cuándo es buen momento para comprar o vender cripto.","#FF9F0A"),
 ("En vivo","live","Maneja tu transmisión y tus escenas de OBS con botones grandes.","#FF375F"),
 ("Asistente","bot","Un bot que contesta a tus clientes y seguidores, de día y de noche.","#30B0C7"),
 ("Pronósticos","target","Los pronósticos deportivos del día, explicados en simple.","#34A853"),
 ("Inmuebles","house","Publica tus propiedades y atiende a interesados sin perder tiempo.","#0A84FF"),
 ("Inversiones","chart","Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero.","#AF52DE"),
]
SIG,WIFI,BAT = sig, wifi, bat
def statusbar(): return f'<div class="status"><span>9:41</span><span class="r">{SIG}{WIFI}{BAT}</span></div>'
def logo(size=""):
    return f'<div class="logo {size}"><div class="mark">{LOGO_MARK}</div><div class="word">Chalyb</div></div>'

SH = '''
:root{--warn:#A65A00;--warn-tint:#FFF3DF;--warn-line:#FFD999;--bad:#D70015;--bad-tint:#FFEDEE;--bad-line:#FFC9CD}
.label.ink{color:var(--ink3)}
.tag-ej{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#8E6A00;background:#FFF6D6;border:1px dashed #E8C55A;padding:2px 8px;border-radius:7px;white-space:nowrap}
.chip{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1.5px #E1E1E8;font-size:18px;font-weight:600;color:var(--ink);white-space:nowrap}
.chip.on{background:var(--ink);color:#fff;box-shadow:none}
.chip svg.i{width:20px;height:20px}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:700;padding:4px 11px;border-radius:999px;white-space:nowrap}
.pill svg.i{width:14px;height:14px;stroke-width:3}
.pill.ok{background:var(--ok-tint);color:var(--ok)} .pill.acc{background:var(--tint);color:var(--accent)}
.pill.warn{background:var(--warn-tint);color:var(--warn)} .pill.bad{background:var(--bad-tint);color:var(--bad)}
.pill.gray{background:#EEEEF2;color:var(--ink2)} .pill.dark{background:var(--ink);color:#fff}
.btn-danger{background:#fff;color:var(--bad);box-shadow:inset 0 0 0 1.5px var(--bad-line)}
.btn-ok{background:var(--ok);color:#fff;box-shadow:0 6px 18px rgba(31,168,85,.28)}
.btn-white{background:#fff;color:var(--accent)}
.lnk{color:var(--accent);font-weight:600;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1.5px}
.field{margin-top:16px}
.field label{display:block;font-size:17px;font-weight:600;margin-bottom:8px}
.field .in{height:62px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 1.5px #DCDCE3;display:flex;align-items:center;padding:0 20px;font-size:19px;color:#A8A8B0;gap:12px}
.field .in.val{color:var(--ink)}
.field .in.focus{box-shadow:inset 0 0 0 2px var(--accent),0 0 0 5px rgba(91,75,255,.12)}
.field .in svg.i{color:var(--ink3)}
.cbx{display:flex;gap:14px;align-items:flex-start;font-size:17px;color:var(--ink2);line-height:1.4}
.cbx .b{width:28px;height:28px;border-radius:8px;box-shadow:inset 0 0 0 2px #C9C9D2;background:#fff;flex:none;margin-top:-1px}
.disc{border-radius:20px;background:#fff;box-shadow:inset 0 0 0 1.5px #E4E0FF;padding:22px 24px 22px 24px;display:flex;gap:16px;font-size:18px;line-height:1.5;color:var(--ink)}
.disc .di{width:40px;height:40px;border-radius:12px;background:var(--tint);color:var(--accent);display:grid;place-items:center;flex:none}
.disc p + p{margin-top:8px}
.disc b{font-weight:700}
.dim{position:absolute;inset:0;background:rgba(20,20,30,.38)}
.sheetc{background:#fff;border-radius:28px;box-shadow:0 30px 80px rgba(10,10,30,.30);padding:34px}
/* banners */
.bnr{display:flex;align-items:center;gap:14px;min-height:64px;padding:10px 12px 10px 22px;font-size:18px;line-height:1.35}
.bnr .bi{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none}
.bnr .bi svg.i{width:19px;height:19px}
.bnr .bt{flex:1}
.bnr .btn{height:46px;font-size:17px;padding:0 20px;border-radius:13px;box-shadow:none}
.bnr.trial{background:var(--tint2);border-bottom:1px solid #E4E0FF;color:var(--ink)} .bnr.trial .bi{background:var(--tint);color:var(--accent)} .bnr.trial .btn{background:#fff;color:var(--accent);box-shadow:inset 0 0 0 1.5px #DAD6FF}
.bnr.warn{background:var(--warn-tint);border-bottom:1px solid var(--warn-line)} .bnr.warn .bi{background:#FFE2B0;color:var(--warn)} .bnr.warn .btn{background:var(--ink);color:#fff}
.bnr.gray{background:#EEEEF2;border-bottom:1px solid #DEDEE4} .bnr.gray .bi{background:#fff;color:var(--ink2)} .bnr.gray .btn{background:var(--accent);color:#fff}
.bnr.bad{background:var(--bad-tint);border-bottom:1px solid var(--bad-line)} .bnr.bad .bi{background:var(--bad);color:#fff} .bnr.bad .btn{background:var(--bad);color:#fff}
/* public nav */
.pnav{height:84px;display:flex;align-items:center;padding:0 56px;gap:40px;background:rgba(245,245,247,.9);border-bottom:1px solid var(--line)}
.pnav .logo{padding:0}
.pnav .links{display:flex;gap:34px;font-size:18px;font-weight:550;color:var(--ink2)}
.pnav .links a.on{color:var(--ink)}
.pnav .r{margin-left:auto;display:flex;align-items:center;gap:14px}
.pnav .r .in{font-size:18px;font-weight:600;color:var(--ink);padding:0 14px}
.pnav .btn{height:50px;font-size:17px;padding:0 22px;border-radius:14px}
/* generic coin dot */
.coin{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px;flex:none;letter-spacing:-.02em}
.tico{display:grid;place-items:center;color:#fff;flex:none}
'''
def page2(title, body, css=""): return page(title, body, SH + css)

def wtop(back, title, icon, step=None, total=3):
    st = ""
    if step:
        bars = "".join(f'<i class="{"on" if k<step else ""}"></i>' for k in range(total))
        st = f'<div class="steps"><div class="bar">{bars}</div><div class="t">Paso {step} de {total}</div></div>'
    return f'''<header class="topbar" style="position:relative"><button class="back">{ic("chevl")}{back}</button>
<div class="toptitle"><span class="tmark">{ic(icon)}</span>{title}</div>
<button class="close">{ic("x")}</button></header>{st}'''

def sidebar2(active, plan="Plan Pro"):
    return sidebar(active).replace('<div class="p">Plan Pro</div>', f'<div class="p">{plan}</div>')

def pubnav(active=""):
    links = [("herr","Herramientas"),("como","Cómo funciona"),("planes","Planes"),("faq","Preguntas")]
    l = "".join(f'<a class="{"on" if k==active else ""}">{t}</a>' for k,t in links)
    return f'''<header class="pnav">{logo()}<nav class="links">{l}</nav>
<div class="r"><a class="in">Entrar</a><button class="btn btn-primary">Prueba Pro gratis</button></div></header>'''

def toolicon(icon, color, size=56, r=16, isz=28):
    return f'<div class="tico" style="width:{size}px;height:{size}px;border-radius:{r}px;background:{color}">{ic(icon,"i",f"width:{isz}px;height:{isz}px")}</div>'

def banner(kind, text, btn):
    icn = {"trial":"gift","warn":"clock","gray":"info","bad":"alert"}[kind]
    return f'<div class="bnr {kind}"><div class="bi">{ic(icn)}</div><div class="bt">{text}</div><button class="btn">{btn}</button></div>'

# Fixed demo values for trial copy (user María, trial of 7 days started TODAY, 3 oct 2026). Precios: ver PRICING-CARDS-SPEC.md (fuente única)
FIN = "10 de octubre de 2026"; COBRO = "10 de octubre de 2026"; RECORD = "3 de octubre de 2026"; GRACIA = "17 de octubre de 2026"
FIN_CORTO = "10 de octubre"
# Final prices, IVA included (PRICING-CARDS-SPEC.md §0.2). Never type them elsewhere in the mockups.
P_PRO_M, P_PRO_Y, P_VIP_M, P_VIP_Y = "$997", "$9,970", "$3,799", "$36,325"
P_SAVE_PRO, P_SAVE_VIP, P_PCT_PRO, P_PCT_VIP, P_PCT_MAX = "$1,994", "$9,263", 16, 20, 20
TRIAL_CTA = "Empezar mis 7 días gratis"
BADGE_PRO = "Más popular"
TRIAL_FOOT = "Prueba Pro gratis 7 días: mensual o anual, una vez por cuenta y por tarjeta. VIP no tiene prueba."
