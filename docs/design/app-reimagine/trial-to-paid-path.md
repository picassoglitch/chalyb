# Chalyb: Prueba Pro gratis → Pro anual (UX + copy)
Naming: brand "Chalyb" only as logo. Tools in plain Spanish: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones (no ChalyClip/ChalybClip prefixes in UI).

## 0. Recommended guardrail (important)
Auto-converting a free month into a $7,490 annual charge is the #1 refund/chargeback + PROFECO complaint trigger. Fix without losing the conversion: on the trial screen the user PICKS the plan that starts after the trial, with **Anual preselected** ("Recomendado · Ahorras $1,498 al año"; do NOT say "2 meses gratis" next to a "1 mes gratis" trial — confusing/misleading, art. 32 LFPC) and Mensual $749 as the second option. Same flow, same clicks, but the charge is one they chose. If owner insists on annual-only, keep everything below and make the $7,490 total impossible to miss.

## 1. Path (fewest clicks)
1. **Landing** → CTA "Prueba Pro gratis 1 mes" (1 click)
2. **Crear cuenta**: Google button or email+contraseña (1 step). No extra profile questions.
3. **Tu prueba** (one screen): plan choice (Anual preselected / Mensual) + disclosure block + **mandatory unchecked consent checkbox** + button "Continuar al pago" (disabled until checked). User can go back and change plan before paying. Seller name, address, phone visible (footer/"Quién vende") — art. 76 Bis III LFPC.
4. **Mercado Pago card** (embedded/brick, not a redirect if possible). Above the form repeat 1-line disclosure. Button "Empezar mi mes gratis".
5. **Confirmación**: "¡Listo! Tu mes gratis ya empezó" + dates/price recap + big primary "Hacer mis primeros clips" (goes straight to Clips paso 1). Email #1 sent.
6. **First clip** (3-step Clips wizard: pegar enlace → formato → listos). Trial banner visible but quiet.
7. **Day 23 (7 days before charge)**: email #2 + in-app banner (reminder state). **Mandatory.** If the email bounces/fails: banner + other channel, and do NOT charge until ≥5 calendar days after an effective notice (Suscripción 2.7 bis). Optional extra reminder on day 29.
8. **Day 30**: charge → email #3 (cobro) + Pro continues. OR user canceled → access until end date, then Gratis.
Cancel: Mi cuenta → Mi plan → "Cancelar prueba" → 1 confirm screen → done (2 clicks, no retention maze; 1 optional offer max, and the "Sí, cancelar" button must stay visible on the same screen as the offer — California B&P §17602(e)(2)).
After conversion: monthly renewals get a reminder **7 days before** each charge (same as trial); annual renewals 30 days before; one annual summary email for monthly plans; price increases only with express acceptance, notice exactly 30 days before.

## 2. Copy
**CTA (landing/home):** "Prueba Pro gratis 1 mes" · sub: "Todas las herramientas incluidas. Cancela cuando quieras."

**Plan picker (screen 3):**
- ◉ Anual — **$7,490 MXN al año** · equivale a $624/mes · Ahorras $1,498 vs. 12 meses de Pro mensual ($8,988) · Recomendado
- ○ Mensual — $749/mes

**Disclosure block (screen 3, above card, and on confirmation):**
"Hoy pagas **$0**. Tu mes gratis termina el **{fecha_fin}**.
Si no cancelas, el **{fecha_cobro}** se cobrarán **${monto} MXN** ({anual: 'por 1 año de Pro' | mensual: 'por tu primer mes de Pro'}) a tu tarjeta terminación {••1234}, y se renovará automáticamente {anual: 'cada año ($7,490 MXN)' | mensual: 'cada mes ($749 MXN)'} hasta que canceles.
Te avisamos por correo el {fecha_recordatorio} (7 días antes). Puedes cancelar en 1 clic desde Mi cuenta, sin llamadas."
**Checkbox REQUIRED (unchecked, mandatory)** — art. 76 Bis fr. VIII LFPC requires *consentimiento expreso e informado* for recurring charges; a checkbox is the strongest evidence (also satisfies ROSCA / California "express affirmative consent"). Use the exact copy in `legal/aceptacion-ux.md` §3.3:
"☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {y cada año después | y cada mes después} a mi tarjeta, y acepto los [Términos de Suscripción]." Button "Empezar mi mes gratis" disabled until checked. (Button-only acceptance only if the Mexican attorney approves — see aceptacion-ux §3.4.)

**Confirmación:** "¡Listo, {nombre}! Tu mes de Pro gratis ya empezó." / "Termina el {fecha_fin}. Primer cobro: ${monto} MXN el {fecha_cobro}." / [Hacer mis primeros clips] · link "Ver mi plan".

**Cancel screen:**
Title: "¿Cancelar tu prueba?"
Body: "Seguirás teniendo Pro hasta el **{fecha_fin}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados."
(Optional offer, once: "¿Prefieres pagar mes a mes? [Cambiar a $749/mes]" — with [Sí, cancelar] still visible on the same screen.)
Buttons: [Sí, cancelar] (secondary/danger) · [Seguir con Pro] (primary)
Done: "Listo, cancelaste. No se te cobrará nada. Tienes Pro hasta el {fecha_fin}. Folio: {folio_cancelacion}. Si cambias de opinión, puedes volver a activar Pro en cualquier momento." + confirmation email with folio.

**Email 1 – Bienvenida (día 0)**
Asunto: "Tu mes de Pro gratis ya empezó 🎉"
"Hola {nombre}, ya tienes Chalyb Pro completo: Clips, Señales, En vivo y todo lo demás. Empieza en 1 minuto: pega el enlace de tu stream y te damos tus clips. [Hacer mis primeros clips]
Tu prueba termina el {fecha_fin}. Si no cancelas, el {fecha_cobro} se cobrarán ${monto} MXN ({plan}) a tu tarjeta ••{1234}, y después {renovacion} hasta que canceles. Te avisaremos el {fecha_recordatorio}. Cancela en 1 clic: [Mi plan].
Documentos que aceptaste: [Términos v{x}] · [Suscripción v{x}] · [Privacidad v{x}] · Folio: {consent_id}"
(Email 1 is evidence + the confirmation/copy required by California ARL, Ontario/Quebec distance-contract rules. Send immediately. "Chalyb Pro" is OK as plan/product name.)

**Email 2 – Recordatorio (día 23, 7 días antes del cobro) — VALIDATED: art. 76 Bis fr. VIII LFPC (reforma DOF 12-dic-2025, vigente 13-dic-2025) requires ≥5 días naturales; 7 days complies with margin. Also fits Quebec (2–10 days before free period ends, in force 12-sep-2026). Must be delivered; see bounce rule above.**
Asunto: "Tu prueba gratis termina en 7 días"
"Hola {nombre}, tu mes de Pro gratis termina el {fecha_fin}. El {fecha_cobro} se cobrarán ${monto} MXN ({anual: 'por 1 año de Pro' | mensual: 'por tu primer mes de Pro'}) a tu tarjeta ••{1234} para seguir con Pro, y se renovará automáticamente hasta que canceles. Este mes hiciste {n_clips} clips. [Seguir con Pro] — no tienes que hacer nada.
¿No quieres seguir? [Cancelar en 1 clic]."
(If annual: add "Prefieres pagar mes a mes? [Cambiar a $749/mes]" — big chargeback reducer.)

**Email 3 – Cobro realizado (día 30)**
Asunto: "Bienvenido a Chalyb Pro"
"Hola {nombre}, cobramos ${monto} MXN (IVA incluido) a tu tarjeta ••{1234}. Tu plan Pro está activo hasta el {fecha_renovacion}; se renovará automáticamente por ${monto} MXN salvo que canceles. Cancela en 1 clic: [Mi plan]. [Ver factura] · [Ir a Chalyb]."
(Failed charge variant — Asunto: "No pudimos cobrar tu plan Pro" · "Actualiza tu tarjeta para no perder Pro. Tienes hasta el {fecha_gracia}. [Actualizar tarjeta]")

**Banners (in-app, top, one line + one button):**
- Prueba activa (quiet, gray/brand): "Prueba Pro gratis · te quedan {n} días" [Ver mi plan]
- Últimos 7 días (amber): "Tu prueba termina el {fecha_fin}. Se cobrarán ${monto} MXN el {fecha_cobro}." [Ver mi plan]
- Prueba terminada / cancelada (neutral): "Tu prueba terminó. Estás en el plan Gratis." [Volver a Pro]
- Pago pendiente / past-due (red): "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del {fecha_gracia} para no perder Pro." [Actualizar tarjeta]

## 3. Price display
- **Lead with the real total: "$7,490 MXN al año"** (big). "$624/mes" only as secondary text ("equivale a $624/mes"). Changed for compliance: art. 7 Bis LFPC (total price, notorio y visible) + art. 76 Bis VIII (amount and periodicity clear and prominent); aligned with `legal/aceptacion-ux.md` §1.3/§3.1.
- Savings badge: **"Ahorras $1,498 al año"**. If a strikethrough is used, label it: "$8,988 si pagas 12 meses de Pro mensual" (it is a comparison, not a former price). No "2 meses gratis" badge.
- Never show $624 alone anywhere near the card form or disclosure: there show the real total $7,490 MXN.
- Show Mensual $749 next to it so the annual looks like the deal (anchor effect) and gives a non-scary exit.
- All prices "MXN, IVA incluido" — **launch blocker:** confirm with the accountant; if current prices are before IVA, displayed totals would be $868.84 / $8,688.40 / $2,898.84.
- Dates in plain format: "30 de octubre de 2026", never 30/10/26.
