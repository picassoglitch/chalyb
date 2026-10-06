# Chalyb: Prueba Pro gratis de 7 días → Pro mensual o Pro anual (UX + copy)
Naming: brand "Chalyb" only as logo. Tools in plain Spanish: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones (no ChalyClip/ChalybClip prefixes in UI).

> **Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Amounts below are examples of the current values; code reads them from `PRICING`.
> Updated 2026-10-03: owner chose a **7-day trial, Pro only, for both Pro mensual ($997/mes) and Pro anual ($9,970/año)**. Replaces the 1-month and 3-day designs. Legal reasoning: `legal/PRICING-2026-10-03-REVISION.md` Q3. Previous version: `trial-to-paid-path.md.bak-2026-10-03`.

## 0. Guardrails
- The user PICKS the plan that starts after the trial: Pro mensual $997/mes or Pro anual $9,970/año. If anything is preselected, prefer Mensual; a $9,970 charge after only 7 days is the main refund/chargeback/PROFECO risk. Never say "mes gratis", "1 mes" or "3 días".
- VIP and VIP anual: no trial.
- **Charge notice on day 0** (the moment the trial starts = 7 days before the charge; Mexican minimum is 5 calendar days, art. 76 Bis VIII LFPC). It must be **delivered by day 2** (charge − 5 days); otherwise **hold the charge** until 5 days after an effective notice (Suscripción 2.7 bis).

## 1. Path (fewest clicks)
1. **Landing** → CTA "Prueba Pro gratis 7 días" (1 click)
2. **Crear cuenta**: Google button or email+contraseña (1 step).
3. **Tu prueba** (one screen): plan choice (Mensual / Anual) + disclosure block + **mandatory unchecked consent checkbox** + button "Continuar al pago" (disabled until checked). User can go back and change plan. Seller name, address, phone visible (footer/"Quién vende"), art. 76 Bis III LFPC.
4. **Mercado Pago card** (brick). Above the form repeat the 1-line disclosure. Button "Empezar mis 7 días gratis".
5. **Confirmación** on screen + **Email 1 "Aviso de cobro" sent immediately (mandatory notice + acknowledgment)**.
6. **First clip** (3-step Clips wizard). Trial banner visible.
7. **Day 6 (1 day before)**: Email 2 reminder: **OFF** (owner); optional config flip `TRIAL_DAY6_REMINDER`. Law recommends it, strongly for Pro anual.
8. **Day 7**: charge → Email 3 (cobro) + Pro continues. OR user canceled → access until end date, then Gratis. If the notice was never delivered → no charge, Pro continues free until 5 days after an effective notice.
Cancel: Mi cuenta → Mi plan → "Cancelar prueba" → 1 confirm screen → done (1 optional offer max, with "Sí, cancelar" visible on the same screen; California B&P §17602(e)(2)).
After conversion: monthly renewals: notice 7 days before each charge; annual renewals: 30 and 7 days before; one annual summary email for monthly plans; price increases only with express acceptance, notice exactly 30 days before.

## 2. Copy
**CTA (landing/home):** "Prueba Pro gratis 7 días" · sub: "Todas las herramientas incluidas. Cancela cuando quieras."

**Plan picker (screen 3):**
- ○ Mensual: **$997 MXN al mes**
- ○ Anual: **$9,970 MXN al año** (un solo cobro al año) · Ahorras $1,994 vs. 12 meses de Pro mensual ($11,964)

**Disclosure block (screen 3, above card, and on confirmation):**
"Hoy pagas **$0**. Tu prueba gratis de 7 días termina el **{fecha_fin}**.
Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** ({anual: 'por 1 año de Pro' | mensual: 'por tu primer mes de Pro'}) a tu tarjeta terminación {••1234}, y se renovará automáticamente {anual: 'cada año ($9,970 MXN)' | mensual: 'cada mes ($997 MXN)'} hasta que canceles.
Hoy mismo te enviamos por correo el aviso de cobro con esta fecha y este monto. Cancela en 1 clic desde Mi cuenta → Mi plan, sin llamadas."

**Checkbox REQUIRED (unchecked)**, exact copy in `legal/aceptacion-ux.md` §3.3:
"☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {y cada año después | y cada mes después} a mi tarjeta, y acepto los [Términos de Suscripción]." Button "Empezar mis 7 días gratis" disabled until checked.

**Confirmación:** "¡Listo, {nombre}! Tus 7 días de Pro gratis ya empezaron." / "Terminan el {fecha_fin}. Primer cobro: ${monto} MXN el {fecha_cobro}. Te enviamos el aviso de cobro a {correo}." / [Hacer mis primeros clips] · "Ver mi plan".

**Cancel screen:**
Title: "¿Cancelar tu prueba?"
Body: "Seguirás teniendo Pro hasta el **{fecha_fin}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados."
(Optional offer, once, annual only: "¿Prefieres pagar mes a mes? [Cambiar a $997 MXN al mes]", with [Sí, cancelar] still visible.)
Done: "Listo, cancelaste. No se te cobrará nada. Tienes Pro hasta el {fecha_fin}. Folio: {folio_cancelacion}." + confirmation email with folio.

**Email 1: Aviso de cobro (día 0, immediately; MANDATORY; separate from any welcome/marketing email)**
Asunto: "Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas"
"Hola {nombre}: tu prueba gratis de 7 días de Chalyb Pro empezó el {fecha_inicio} y termina el **{fecha_fin}**. **Hoy pagaste $0.** Si no cancelas antes, el **{fecha_cobro}** cobraremos **${monto} MXN** ({plan}) a tu tarjeta ••{1234}, y después {renovacion} hasta que canceles. Faltan 7 días para el cobro.
{anual:} ¿Prefieres pagar mes a mes? [Cambiar a Pro mensual: $997 MXN al mes]
**Cancelar es 1 clic:** [Cancelar mi prueba]. Si cancelas antes del {fecha_cobro}, no pagas nada.
Documentos que aceptaste: [Términos v{x}] · [Suscripción v{x}] · [Privacidad v{x}] · Folio: {consent_id}"
(Email 1 = the ≥5-day notice (LFPC 76 Bis VIII), the acknowledgment (CA B&P §17602(a)(3)), the post-consent notice (NY GBL §527-a(1)(c)) and the 2–10-day notice (Quebec CPA 187.29, if Quebec is ever unblocked). Track delivery; bounce → banner + other channel + hold.)
A separate welcome email with onboarding tips is fine, but it is not the notice.

**Email 2: Recordatorio (día 6, 1 día antes): OFF by owner decision** (`TRIAL_DAY6_REMINDER=false`, PRICING-CARDS-SPEC §16.4). Optional; Law recommends it, strongly for annual. If turned on, the same day-6 amber banner shows too.
Asunto: "Mañana termina tu prueba gratis"
"Hola {nombre}: mañana, {fecha_cobro}, se cobrarán ${monto} MXN ({plan}) a tu tarjeta ••{1234}. Esta semana hiciste {n_clips} clips. [Seguir con Pro]: no tienes que hacer nada. ¿No quieres seguir? [Cancelar en 1 clic]." (If annual: "¿Prefieres pagar mes a mes? [Cambiar a $997 MXN al mes]".)

**Email 3: Cobro realizado (día 7)**
Asunto: "Bienvenido a Chalyb Pro"
"Hola {nombre}, cobramos ${monto} MXN (IVA incluido) a tu tarjeta ••{1234}. Tu plan Pro está activo hasta el {fecha_renovacion}; se renovará automáticamente por ${monto} MXN salvo que canceles. Cancela en 1 clic: [Mi plan]. [Ver factura] · [Ir a Chalyb]."
(Failed charge variant: Asunto "No pudimos cobrar tu plan Pro" · "Actualiza tu tarjeta para no perder Pro. Tienes hasta el {fecha_gracia}. [Actualizar tarjeta]")

**Banners (in-app):**
- Prueba activa (amber from day 0, the trial is short): "Prueba Pro gratis · El {fecha_cobro} se cobrarán ${monto} MXN, salvo que canceles antes." [Ver mi plan] (mockup 17 #1)
- Aviso no entregado (amber, PRICING-CARDS-SPEC §16.3; mockup 17 #2; needs Law's OK): "No pudimos enviarte el aviso de cobro a {correo}. Confírmalo o actualízalo: no te cobraremos hasta 5 días después de avisarte." [Revisar correo]
- Prueba terminada / cancelada: "Tu prueba terminó. Estás en el plan Gratis." [Volver a Pro]
- Pago pendiente: "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del {fecha_gracia} para no perder Pro." [Actualizar tarjeta]

## 3. Price display
- **Lead with the real total: "$9,970 MXN al año"** (big). Do not show a monthly equivalent of the annual price. The line "o $997 MXN al mes en plan mensual" is the price of a different plan; allowed on the pricing card only, never in the disclosure block or near the checkbox (see revision Q5).
- Savings badge: "Ahorras $1,994 al año · 16%" (16.67%, floored). Do not put "Mejor oferta" on Pro while VIP anual saves 20%; use "Más popular" (or "Recomendado" if there is no data showing it is the most chosen; PRICING-CARDS-SPEC §16.6).
- Struck reference price ($1,662 / US$84): only with the documentation and label in revision Q2.
- MX footer: "Precios en MXN, IVA incluido." (`PRICES_INCLUDE_IVA=true`). USD: "Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay."
- Dates in plain format: "10 de octubre de 2026", never 10/10/26.
