# Revisión legal de las decisiones de precio, 3 de octubre de 2026

**Alcance:** las cinco decisiones de precio del dueño (Q1–Q5), con dos actualizaciones del mismo día: (1) $1,662 MXN **sí fue un precio real**, cobrado en otro sitio; (2) la prueba será de **7 días** (solo Pro, mensual y anual), en lugar de 3 días. El texto para clientes está en español; las notas internas, en inglés. Esto **no es asesoría legal formal**: un abogado mexicano debe aprobarlo antes del lanzamiento (y un abogado local para EE. UU. y Canadá).

**Archivos modificados:** `terminos-de-suscripcion.md`, `aceptacion-ux.md`, `../trial-to-paid-path.md`.

**Addendum (09:50): renombre.** El dueño nombró el plan **Pro Lealtad** (en: Pro Loyalty; antes "Pro Reducto"). Producto reemplazó el nombre en este archivo, `terminos-de-suscripcion.md` y `aceptacion-ux.md` (solo el nombre, claves y eventos; ningún otro texto legal cambió). Respaldos con sufijo `.bak-2026-10-03c`.

**Addendum (09:10): sección R, Pro Lealtad.** Archivos modificados: `terminos-de-suscripcion.md` (nueva sección 4 bis y cambios en tabla, 3.1, 3.3 y 8.2) y `aceptacion-ux.md` (nueva sección 4.2, tabla de avisos, eventos y checklist). Respaldos con sufijo `.bak-2026-10-03b`. Los respaldos tienen el sufijo `.bak-2026-10-03`. No se modificó código y no se regeneró el PDF.

**Precios finales usados en todo el documento (IVA incluido en MXN):**
- Pro: $997 al mes. Pro anual: $9,970 al año.
- VIP: $3,799 al mes. VIP anual: $36,325 al año.
- USD: $50 al mes / $500 al año (Pro) y $200 al mes / $2,000 al año (VIP).
- Ahorro de Pro anual: $11,964 − $9,970 = $1,994, es decir 16.67%, que se muestra como "16%".
- Ahorro de VIP anual: $45,588 − $36,325 = $9,263, es decir 20.32%, que se muestra como "20%".

## Verdicts at a glance

| # | Decision | Verdict | Risk if done as recommended |
|---|---|---|---|
| Q1 | Raise existing subscribers ($749→$997, $2,499→$3,799); USD tax display | **Allowed:** 30-day notice plus express acceptance; nobody pays the new price without accepting. USD prices may show tax at checkout if a note says so. | Low |
| Q2 | Struck $1,662 + "40% de descuento" (and US$84 "40% off") | **$1,662: allowed only with documentation, and only if labeled with the other site and the date.** Do not show a bare "40% de descuento" on chalyb.com. **US$84: drop it** unless US$84 was actually offered to US/Canada customers. | Low with label + evidence; **high** as currently mocked |
| Q3 | 7-day trial, Pro monthly + annual | **Compliant as designed:** unchecked checkbox, charge notice on day 0 (7 days before the charge), hold the charge if the notice isn't delivered by day 2. | Low (legal); medium commercial chargeback risk on the $9,970 annual |
| Q4 | VIP anual $36,325 | **Allowed:** clause added (Términos §4). Needs its own checkout consent and a UI_VERSION bump. | Low |
| Q5 | "o $997 MXN al mes en plan mensual" under the annual price | **Allowed** as the price of another plan, on the pricing card only, never in the charge block or next to the checkbox. | Low |

---

## Q1. Price increase for existing subscribers + USD tax display

### Facts
- Production (`main`) charges $749 (Pro) and $2,499 (VIP) per month. New prices are $997 (+33.1%) and $3,799 (+52.0%).
- The production terms existing subscribers accepted (`chalyb-src/src/content/legal/terms.es.tsx` l.149–150) say: "Los precios pueden cambiar — te avisamos por correo al menos 30 días naturales antes de aplicar el nuevo precio a tu suscripción activa. Si no estás de acuerdo, puedes cancelar…". This is a tacit-acceptance model (notice plus a right to cancel).

### Legal basis
- **LFPC art. 76 Bis VIII** (DOF 12-12-2025) requires express, informed consent to recurring charges, including the amount. A higher amount is a charge the consumer did not consent to. **Art. 10:** no charges without prior consent. **Art. 90 fr. I:** clauses allowing unilateral modification of adhesion contracts are void.
  - The tacit model in the old terms is therefore weak in Mexico. Use express acceptance. Source: LFPC, https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
- **California B&P §17602(g)(2):** notice of a price change 7–30 days before it takes effect. https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602
- **New York GBL §527-a(1)(g):** notice of a material change, including a price increase, at least 5 business days and at most 30 days before. **(1)(b-1):** for an increase, affirmative consent, or else cancellation within ≥14 days after the charge with a pro-rata refund. https://www.nysenate.gov/legislation/laws/GBS/527-A
- **Quebec CPA s.11.2:** unilateral amendment needs 30 days' written notice, and price can be changed unilaterally only in indeterminate-term service contracts. https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1
- **One window satisfies all of them:** notice exactly 30 days before the renewal where the new price applies, plus express acceptance.

### How to do it (compliant design)
1. **Per-subscriber timing.** For each subscriber, send the notice **exactly 30 days before the first renewal that falls ≥30 days from today**. Notices are staggered by renewal date; never send one 31+ days ahead (CA/NY maximum).
2. Notify by email and with an in-app modal. Include the old price, new price, % increase, effective date, an "Acepto el nuevo precio" button, and a cancel link.
3. **No acceptance means no charge at the new price.** The owner picks one of two options:
   - **(a)** the plan does not renew; access continues to the end of the paid period, then Gratis (current Términos §5.3); or
   - **(b)** keep charging the old price (grandfathering).
   - Both comply. (b) keeps more revenue and avoids silent downgrades; it is the bracketed alternative in §5.3.
4. If no response, send a reminder 7 days before.
5. Record `price_change_notice_sent`, then `price_change_accepted` or `price_change_declined` (aceptacion-ux §4.1, §10).
6. A renewal may use the new amount **only** if `price_change_accepted` exists. If it is charged by mistake, refund it (Términos §7.3).

### Customer copy (Spanish)
**Correo**
- **Asunto:** Tu plan Pro cambia de precio: acepta o decide antes del {fecha_aplicacion}
- **Cuerpo:**
> Hola {nombre}:
> El precio de Pro sube de **$749 MXN** a **$997 MXN al mes** (IVA incluido), un aumento de 33%.
> **Solo se te cobrará el nuevo precio si lo aceptas.** Si lo aceptas, se aplicará a partir de tu renovación del **{fecha_aplicacion}**.
> Si no lo aceptas antes de esa fecha, tu plan no se renovará al nuevo precio: conservas Pro hasta el {fecha_fin_periodo} y después pasas al plan Gratis, sin ningún cobro.
> [Acepto el nuevo precio] · [Cancelar sin costo] · [Ver mi plan]

(VIP: "de **$2,499 MXN** a **$3,799 MXN al mes** (IVA incluido), un aumento de 52%". Under option (b), replace the "Si no lo aceptas…" sentence with "Si no lo aceptas, seguirás pagando $749 MXN al mes.")

**Modal:** the full text is in `aceptacion-ux.md` §4.1.

### USD tax display
- **MXN footer:** "Precios en MXN, IVA incluido." (The accountant must confirm IVA is included, and the IVA treatment for foreign customers.)
- **USD footer for US customers:** "Prices in US dollars. Sales tax, if any, is added at checkout and shown before you pay."
- **USD footer for Canadian customers:** "Prices in US dollars (USD). GST/HST and, in Quebec, QST are added where applicable and shown before you pay."
- **Basis:**
  - Canada: Competition Act s.74.01(1.1) (drip pricing) exempts amounts imposed under federal or provincial law, so adding taxes at checkout is OK. https://laws-lois.justice.gc.ca/eng/acts/C-34/section-74.01.html
  - Quebec: CPA s.54.4(e), (g), (h) require itemized prices including taxes, the total, and the currency if not CAD, before the contract.
  - US: no federal rule requires tax-inclusive SaaS prices.
- **Fix mockup 84:** its footer "Prices in US dollars." lacks the tax note.
- **Terms:** Términos §11.1 bis and §1.1 now say USD prices exclude tax and that tax is shown before payment.
- **Verdict:** Allowed.

---

## Q2. Struck reference price $1,662 MXN with "40% de descuento" (and US$84 "40% off")

### Arithmetic
- (1,662 − 997) / 1,662 = 665 / 1,662 = **40.01%**, so "40%" is accurate.
- (84 − 50) / 84 = **40.48%**, so "40%" is accurate.
- The math is fine. The open question is whether the reference price is legitimate.

### Facts that drive the analysis
- Owner (updated): Pro was actually **sold at $1,662 on another site**. Treated as a bona fide former price.
- Owner earlier (spec §0.1 #2): **$1,395 is the real former price**. Production chalyb.com charges $749 today.
- The spec records that $83 was rejected because it gave 39%, and $84 was chosen so the display reads "40%". $1,662 is also exactly the smallest whole peso amount that yields 40% off $997 (997 / 0.6 = 1,661.67). A regulator reviewing the claim will notice this. The documentation therefore has to show, from records dated **before** this pricing decision, that $1,662 was a real price.

### Legal basis
**Mexico**
- **LFPC art. 32:** information and advertising must be truthful and verifiable ("veraz, comprobable") and must not mislead, including through partial or tendentious information.
- **Art. 46:** an "oferta/descuento" means prices "rebajados o inferiores a los normales **del establecimiento**".
- **Art. 48 fr. I:** promotions must state their conditions and duration. With no duration stated, they are presumed indefinite until publicly revoked.
- **Art. 49:** no announced value notoriously higher than what is normally available in the market.
- **Art. 50:** if the offer is not honored, the consumer can demand the difference.
- **Art. 13 + PROFECO Lineamientos de publicidad (DOF 24-07-2012), Noveno:** PROFECO can require the documentation that proves a claim. https://www.profeco.gob.mx/juridico/txt/acuer_publici_Pfc_24julio2012.txt
- **PROFECO Acuerdo de publicidad comparativa en precios (DOF 19-10-2009):**
  - It applies to price comparisons of identical services sold by **different providers** (Primero).
  - The comparison must be in **absolute numbers, not percentages** (Tercero).
  - It must be backed by a purchase receipt or notarized proof displayed on the site (Cuarto).
  - It is valid for at most **5 days** (Séptimo).
  - It must state the comparison date and the legend "a la fecha, el precio que se compara pudo haber variado" (Octavo).
  - It allows internet-vs-other-channel comparisons with clear information (Quinto).
  - Source: https://www.profeco.gob.mx/juridico/txt/ACUERDO%20LINEAMIENTOS%20PFC19OCT09.txt
- **NOM-174-SCFI-2007** does not apply to SaaS (its scope is a closed list of services).

**US**
- **FTC 16 CFR 233.1:** the former price must be the advertiser's own actual, bona fide price, offered to the public openly, on a regular basis, for a reasonably substantial period, in the recent, regular course of business.
  - Sales are not required, but "formerly sold at" requires substantial sales (233.1(b)).
  - A price not openly offered, or not maintained, is fictitious (233.1(d)).
  - https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-233/section-233.1
- **California B&P §17501:** no former-price claim unless it was the prevailing market price within the **3 months** immediately before, or the date it prevailed is clearly stated. https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17501

**Canada**
- **Competition Act s.74.01(3):** an "ordinary price" claim is reviewable unless, **in the relevant geographic market**, either a substantial volume was sold at that price or higher within a reasonable period, or it was offered at that price in good faith for a substantial period recently.

### Analysis
1. **Same product?** The plan sold at $1,662 must be the same Pro: same tools, same credits/limits, same billing period (monthly), same currency, IVA included. If the other site's $1,662 excluded IVA, or bundled extras, or was a different period, it is not comparable.
2. **Same provider or a different one?** This decides which rule applies.
   - **Different provider** (another company or reseller): the 2009 PROFECO comparative-price acuerdo applies. It bans percentages, needs receipts displayed on the site, and lasts at most 5 days. "40% de descuento" would be prohibited. **Do not use $1,662 in this case.**
   - **Same provider** (same razón social / RFC, another site or brand): this is the provider's own former price.
     - Art. 46 speaks of prices "normales del establecimiento", and chalyb.com's own normal prices were $1,395 (owner) and $749 (production). A bare "40% de descuento" on chalyb.com tells the visitor that chalyb.com normally charges $1,662, which is not true. That is misleading under art. 32.
     - Solution: **say where and when** the $1,662 price applied (2009 acuerdo Quinto by analogy; CA §17501 date option).
3. **Existing subscribers.** Users paying $749 will receive a "your price goes up 33%" email while the website shows "40% de descuento". This is the strongest misleading-impression argument (art. 32, "parcial o tendenciosa"). The label below reduces it. Consider not showing the struck price to logged-in grandfathered users.
4. **How long?** The reference must be recent.
   - CA: within 3 months, or state the date.
   - FTC: recent, regular course of business.
   - Art. 48 I: state the offer's duration, or it is presumed indefinite.
   - If $997 is shown with a strike indefinitely, it becomes the regular price and the reference goes stale. **Show it for a limited, stated period** (e.g., up to 90 days after the $1,662 price ended), then remove the strike.
5. **US$84.** Nothing in the code, the spec or the owner's update says Pro was ever offered or sold at US$84; the spec says $84 was chosen to make the display read 40%. Mexican peso sales at $1,662 do not establish a US-dollar price for US or Canadian buyers (FTC: the advertiser's own price to the public; Canada: the relevant geographic market). **Unless the owner has records of US$84 offers or charges to US/Canada customers, remove the struck US$84** and show "Launch price" without a strike.

### Customer copy (Spanish), by evidence level
- **A. Same provider + same product + documented + recent (recommended form if $1,662 is kept):**
  > **$997 MXN al mes**
  > ~~$1,662~~ Precio anterior en [nombre del sitio] hasta el [fecha]. Aquí pagas 40% menos.
  > *Precio de lanzamiento vigente hasta el [fecha de fin de la promoción].*
  - On mobile, at minimum: "~~$1,662~~ en [sitio] hasta [mes año] · 40% menos".
  - Do not use the bare "40% de descuento" (mockups 81, 83, 85).
- **B. If the only defensible reference is chalyb.com's own former price ($1,395, owner 08:46):**
  > ~~$1,395~~ **28% de descuento** · Precio anterior en chalyb.com hasta el [fecha].
  - (1,395 − 997) / 1,395 = 28.53%, floored to 28%.
- **C. Without enough evidence (safest):**
  > **Precio de lanzamiento: $997 MXN al mes** (no strike, no %)
- **USD:** "**Launch price: US$50/month**" (no strike) unless US$84 is documented. If documented: "~~US$84~~ Our previous price on [site] until [date] · 40% less".

### Evidence the owner must keep
Keep this for at least 10 years (Código de Comercio, as in aceptacion-ux §10.4) and be ready to show it to PROFECO (art. 13) or the FTC.
1. **Price page captures** of the other site showing Pro at $1,662, with dates:
   - Wayback Machine snapshots (web.archive.org) if they exist;
   - otherwise dated screenshots plus the HTML/CMS revision history;
   - ideally a constancia NOM-151 or notarial fe de hechos for the current capture.
2. **Sales records at $1,662:**
   - payment-processor exports (Mercado Pago/Stripe/etc.) with date, amount and currency;
   - CFDI invoices issued at $1,662;
   - number of sales and their dates, enough to show a "substantial" volume over a "substantial" period;
   - first and last date the price was offered.
3. **Identity of the seller:** razón social/RFC of the other site, matching Chalyb's. If it doesn't match, do not use the price (2009 acuerdo).
4. **Same product:** the other site's plan description (tools, credits, limits, billing period, IVA included or not) next to chalyb.com Pro's.
5. **Open offer:** proof the price was publicly listed (not a private quote or a single invoice) and maintained in good faith (FTC 233.1(d)).
6. **Offer period on chalyb.com:** the dates the strike is shown, and the date it will be removed.
7. **For US$84:** the same items 1–5 in USD, for US/Canada customers. If they don't exist, drop US$84.
8. **Pricing-decision record:** keep spec D19 with a note that the owner's $1,662 sales predate the decision. Attach the sales records.

### Related claims (L3)
- **"Mejor oferta" on Pro anual:** it saves 16%, while VIP anual saves 20%. An unexplained superlative is risky (art. 32). Use **"Más popular"** or **"Recomendado"**. Same for USD "Best value" → "Most popular".
- **"Ahorra hasta 20%" pill:** true as a maximum (VIP anual 20.32%), so it is OK.
- **"Ahorras $1,994 al año · 16%":** true (16.67%, floored).
- **D20 still open:** if $9,970 is a first-year promo, the card and the checkout must say "$9,970 MXN el primer año; después $11,964 MXN al año" (art. 48 I; CA §17602(a)(1)).

**Verdict:**
- **$1,662: conditionally allowed.** Use label A plus the evidence above, a limited period, and the same provider and product. Otherwise use option B or C.
- **US$84: not allowed** without proof of real US/Canada offers or charges.

---

## Q3. 7-day free trial (Pro mensual and Pro anual)

### Does the 5-day notice of LFPC 76 Bis VIII apply to the trial-to-paid charge?
- The notice sentence applies "en los casos en los que, de acuerdo al contrato, proceda la **renovación automática** del servicio".
- **Narrow reading:** the first charge after a free trial is the initial, expressly consented charge, not a renewal.
- **Broad reading (consumer-protective, the likely PROFECO view):** the free period renews automatically into a paid one.
- **The 7-day trial makes this question irrelevant.** Notice is sent on day 0 = 7 days before the charge, which is ≥5 days under either reading.
- For the record, the rejected **3-day** trial could not give a 5-day notice: **high risk** under the broad reading, **medium** under the narrow one, and it would have needed attorney sign-off.

### Design
1. **Checkout disclosure** next to the button: $0 today, trial end date, charge date, exact amount, frequency, automatic renewal, card last 4, when the notice is sent, how to cancel.
   - Plus an **unchecked, mandatory checkbox** naming the date and amount.
   - Basis: LFPC 76 Bis VIII (express, informed consent); CA §17602(a)(1) (clear and conspicuous, near the consent; post-trial price explained) and (a)(4); NY §527-a(1)(a)–(b) (amount, frequency, cancellation deadline and mechanism, before billing).
   - Copy: aceptacion-ux §3.2–3.3.
2. **Day 0 "Aviso de cobro" email**, sent the moment the trial starts and separate from welcome or marketing mail.
   - Contents: trial end date, charge date, amount, frequency, card, one-click cancel link, accepted documents, consent ID.
   - It serves as all of these at once:
     - the LFPC ≥5-day notice;
     - the CA §17602(a)(3) acknowledgment, which must tell free-trial users how to cancel before they pay;
     - the NY §527-a(1)(c) post-consent notice;
     - the Quebec CPA s.187.29 notice (2–10 days before the free period ends; reg. 79.6.9.1), if Quebec is ever unblocked.
3. **Delivery rule:** the notice must be confirmed **delivered by day 2** (charge − 5 calendar days).
   - If it bounces or isn't confirmed: show a red in-app banner, try other channels, and **do not charge until 5 calendar days after an effective notice**. The user keeps Pro for free meanwhile (Términos §2.7 bis).
   - **Unverified:** that Mercado Pago lets us postpone or pause a preapproval before its first charge. If it can't, create the preapproval only after delivery is confirmed, or start it with a future start date that can be moved.
4. **Day 6 reminder:** recommended; strongly recommended when the plan chosen is Pro anual ($9,970).
5. **Annual-charge mitigations** (commercial risk, not a legal requirement):
   - no preselection of annual (or preselect monthly);
   - a "Cambiar a Pro mensual" link in the day-0 and day-6 emails;
   - ~~courtesy full refund within [7] days of the first annual charge~~ (dropped by the owner's no-courtesy-refund policy, section S; keep the switch-to-monthly link).
6. **Cancellation:** online, one confirmation screen, with any retention offer always showing the cancel button (CA §17602(d)(1), (e)(2); NY §527-a(1)(d); Quebec CPA s.187.28; LFPC 76 Bis IX).
7. **Other jurisdictions:**
   - **California:** the trial reminder (b)(1) applies only to trials over 31 days. **New York:** the trial notice (1)(h) applies only to trials over 1 month. A 7-day trial is exempt from both; the day-0 notice is kept anyway.
   - **Quebec:** remains blocked (`quebecBlocked`) until the French version exists. If unblocked, day 0 = 7 days before the end, inside the 2–10-day window. Bill 10's rules do not apply to contracts already in progress on 12-09-2026.
8. **Consent log:** keep for 3 years or 1 year after termination, whichever is longer (CA §17602(a)(6)). We keep 10 years.

### Customer copy (Spanish)
- **Pricing card chip:** "7 días gratis" · **CTA:** "Prueba Pro gratis 7 días".
- **Under the CTA on the card (monthly):** "**Hoy pagas $0.** El {fecha_cobro} se cobran $997 MXN y después cada mes, automáticamente. Cancela cuando quieras."
- **Under the CTA on the card (annual):** "**Hoy pagas $0.** El {fecha_cobro} se cobran $9,970 MXN por el año completo y se renueva cada año, automáticamente. Cancela cuando quieras."
- **Fix in the current mockups:**
  - Mensual lacks the frequency ("y después cada mes").
  - Anual lacks "se renueva".
  - EN mockup 84 lacks "for the full year" and "renews every year".
  - English fix: "**$0 today.** On {charge_date} you'll be charged US$500 for the full year, plus any sales tax, and it renews every year until you cancel. Cancel anytime."
- **Charge block, checkbox, button, confirmation screen and day-0 email:** aceptacion-ux §3.2–3.6. Button: "**Empezar mis 7 días gratis**".
- **Checkbox:** "☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {y cada mes después | y cada año después} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion)."
- **Day-0 email subject:** "Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas".

### Risk levels
| Scenario | Mexico | CA / NY | Quebec |
|---|---|---|---|
| 7 days + checkbox + day-0 notice delivered + hold rule | **Low** | **Low** | Low (if unblocked + French) |
| Residual: day-0 notice argued to be "part of the contract, not a notice" | Low–medium (mitigate: separate email titled "Aviso de cobro", tracked delivery, day-6 reminder) | n/a | n/a |
| Charging although the notice was never delivered | **High** (blocked by the hold rule) | Medium | High |
| $9,970 annual auto-charge after only 7 days | Commercial: medium (chargebacks, PROFECO complaints); mitigations in item 5 | same | same |
| Rejected 3-day trial without a 5-day notice | High (broad reading) / medium (narrow reading) | Low | Compliant only if notice sent 2–3 days before the end |

**Terms updated:** Términos §2 (7 days, Pro mensual and Pro anual, day-0 notice, §2.7 bis hold), §14.2 (Quebec); aceptacion-ux §3–4, §10, §11; `trial-to-paid-path.md`.

**Verdict:** Compliant as designed.

---

## Q4. VIP anual clause

**Clause added (Términos §4, summary, table §1.1, §3.1, §3.3):**
- **Price and charge:** $36,325 MXN (US$2,000) per year, paid in advance in a single charge, for 12 months, with no trial; the charge is made on the day of purchase.
- **Renewal:** auto-renews every 12 months at the informed price; renewal notices 30 and 7 days before (7 days mandatory).
- **Cancellation and refunds:** cancel anytime, effective at the end of the paid year. No pro-rata refund except the §7.3 cases.
- **Plan changes:**
  - VIP → VIP anual: immediate, with credit for the unused month.
  - VIP anual → VIP: at the end of the paid year.
  - Pro ↔ VIP: upgrades are immediate with proration; downgrades take effect at period end.
- **Price changes:** §5 (30 days + acceptance).
- **Basis:**
  - LFPC art. 43: each plan's characteristics, conditions and total cost must be stated.
  - Arts. 7 Bis and 76 Bis VIII: total price, recurring charge, consent.
  - CA §17602(b)(2) and NY §527-a(1)(f): reminder before the renewal of an annual initial term (CA 15–45 days; NY 15–45 days). The 30-day notice satisfies both.

**Checkout copy (Spanish):**
> **Hoy se cobran $36,325 MXN** (IVA incluido) por 1 año de VIP a tu tarjeta terminación **{ultimos4}**. Se renovará automáticamente el **{fecha_renovacion}** y cada año después por $36,325 MXN hasta que canceles. Te avisaremos 30 y 7 días antes. Cancela en 1 clic desde Mi cuenta → Mi plan; conservas VIP hasta el final del año pagado.
> ☐ Acepto el cobro de $36,325 MXN hoy y su renovación automática cada año, y acepto los [Términos de Suscripción](/suscripcion).

**Card copy:** "VIP anual · **$36,325 MXN al año** · Se renueva cada año · o $3,799 MXN al mes en plan mensual · Ahorras $9,263 al año · 20%".

**L4:** new `plan_id` (`vip_year`), consent record with the exact text, and a `UI_VERSION` bump.

**Verdict:** Allowed.

---

## Q5. "o $997 MXN al mes en plan mensual" under the annual price

- **Why it is allowed:**
  - $997/month is the real price of a different plan (Pro mensual), not a monthly equivalent of the annual price.
  - LFPC art. 43 actually requires informing the cost of each plan when several are offered.
  - The annual total stays dominant ($9,970 al año, big), as required by arts. 7 Bis and 76 Bis VIII.
- **Conditions:**
  1. It appears only on the pricing card, below "Se renueva cada año". Never in the charge block, the Mercado Pago screen or the checkbox text, where only the amount actually charged may appear.
  2. Never present it as "equivale a" or as a price of the annual plan.
  3. Keep the line "Se renueva cada año" and the annual total visible.
- **Suggested wording (clearer, optional):** "**o paga mes a mes: $997 MXN al mes** (plan mensual)". The current wording is acceptable.
- **Verdict:** Allowed.

---

## What the P5 test suite should check

These are recommendations only; no code was changed (`/workspace/chalyb-p5`, commit c163dfd).

**Config (`src/config/pricing.ts`)**
1. `PRICING.trial.days === 7` (today 30).
2. `planHasTrial('pro_month') === true` and `planHasTrial('pro_year') === true`. Today only `pro_year` returns true. `planHasTrial('vip_month')` and `planHasTrial('vip_year')` must both be `false`.
3. `PRICING.trial.reminderDaysBefore === 7`, so the notice is due at trial start.
   - Add the invariant `5 <= trial.reminderDaysBefore <= trial.days` to `assertReminderWindows()`.
   - Add a test that a `{days: 3, reminderDaysBefore: 3}` config **throws**: a trial too short for a 5-day notice can never ship.
4. Renewal windows unchanged: `reminders.monthDaysBefore === 7`, `reminders.yearDaysBefore` = `[30, 7]`, all ≥5.

**Dates and notices**
5. `trialDates(start)`: `trialEndsAt = chargeAt = start + 7d`; `reminderAt = start`.
6. `dueNotices()` for a trialing subscription at `now = start`:
   - returns the mandatory trial notice (kind `trial_7d`, `dueAt = start`);
   - the optional `trial_1d` is due at `chargeAt − 1d`;
   - nothing else is due.
7. `holdDecision()` with `nextChargeAt = start + 7d`:
   - (a) delivered at `start + 1h` → `none`;
   - (b) delivered exactly at `charge − 5d` → `none`;
   - (c) delivered at `start + 3d` → `hold` until delivered + 5d;
   - (d) never delivered, `now = charge − 2d` (`HOLD_LOOKAHEAD_MS`) → `hold` until now + 5d;
   - (e) after delivered + 5d → `resume`.
   - Make sure the cron that calls `holdDecision` runs at least daily, so it always lands inside the 2-day lookahead window.

**Copy and consent**
8. **Day-0 email template:** the subject starts with "Aviso de cobro". The body contains the charge date, amount, "cada mes"/"cada año", the last 4 digits, the cancel link and the consent ID. It is not combined with marketing content.
9. **Disclosure and checkbox strings** contain "7 días", the amount of the chosen plan, "se renovará automáticamente", and "cada mes"/"cada año".
   - The USD version contains "every month"/"every year", "renews" and "sales tax".
   - Banned in trial copy: "mes gratis", "1 mes", "3 días", "3 days", "30 días", "equivale".
10. Update the existing tests that assume a 30-day trial: `tests/billing-core.test.ts` ~l.201 `'Empezar mi mes gratis'` and ~l.244 `'Tu mes gratis termina el 30 de octubre de 2026'`. New button label: "Empezar mis 7 días gratis".
11. `UI_VERSION` bumped from `'rebuild-p2'`. The consent record stores the exact disclosure text, the checkbox text, the 7-day trial, the plan (`pro_month` / `pro_year`) and the amount.

**Prices**
12. **Grandfathering:** renewals for subscribers on the `[74_900, 86_884]` (Pro) or `[249_900, 289_884]` (VIP) amounts keep the old amount unless `price_change_accepted` exists.
    - The price-change notice is scheduled exactly 30 days before the applicable renewal (assert 30, not 29 or 31).
    - The reminder goes out 7 days before.
    - Without acceptance: no charge at the new amount; then downgrade at period end, or keep the old price, per the owner's choice in §5.3.
13. **Reference price:** `REFERENCE_CENTS.pro_month` is shown only behind a flag that defaults to off until the evidence in Q2 exists.
    - The rendered label includes the site name and date.
    - No USD reference (8_400) unless documented.
    - Keep `discountPct(99_700, 166_200) === 40` and the guard `discountPct(5_000, 8_300) === 39`.
14. **VIP anual:** no trial; the checkout disclosure shows $36,325 and "cada año".
15. **Quebec:** `quebecBlocked` still blocks the trial and paid plans.

---

## Not verified (open items)
- Reglamento de la LFPC: download failed, not reviewed. There is no federal "ley de promociones".
- Whether the other site that sold Pro at $1,662 is the same legal entity, sold the same product, and for how long. Owner documentation is pending.
- Whether US$84 was ever offered or charged to US/Canada customers. Nothing found.
- FTC 16 CFR 233.2–233.3 (comparable-value comparisons) not read.
- Canada Competition Bureau guidance on ordinary-price tests (volume/time thresholds) not read; only the statute.
- California SB 478 / Civ. Code §1770(a)(29) (tax exclusion) and the scope of the FTC fees rule (16 CFR 464): from memory, not re-verified.
- US sales-tax nexus and Canadian GST/HST/QST registration for a non-resident seller: accountant.
- IVA included in the MXN prices, and IVA on foreign customers: accountant.
- Effective dates of the latest NY GBL §527-a amendments, and Quebec CPA s.224(c): not re-verified.
- Whether Mercado Pago can (a) charge in USD, and (b) pause or postpone a preapproval before its first charge (needed for the hold rule).
- D20: whether $9,970 is a first-year promo or the standing price.

---

# R. Pro Lealtad (loyalty step-down plan), owner decision Oct 3, 2026 09:02

Inputs: `PRICING-CARDS-SPEC.md` §15 and mockups 86–88. Name: **Pro Lealtad** (en "Pro Loyalty"), chosen by the owner on Oct 3, 09:50; working name was "Pro Reducto". Monthly, Pro only, no trial. The spec gives **no USD amounts** for Pro Lealtad (only English strings with placeholders).

## Verdicts at a glance

| Item | Verdict |
|---|---|
| Plan itself (variable monthly amounts, all disclosed) | **Allowed** with the full schedule, today's charge, monthly renewal and reset rule shown before payment, and one checkbox (R.2) |
| Rounding | Amounts are **truncated (floored) to the whole peso**. Say so: "montos redondeados hacia abajo al peso" |
| Notice for each charge | **Yes:** a notice before every monthly charge, stating that month's amount. Use 7 days (R.3) |
| Reset: cancel | **Allowed** (disclosed, no fee, access to period end, undo keeps the step). Low risk; optional 30-day return window |
| Reset: plan switch / upgrade | **Allowed**, user's choice, warned on the confirm page. Low risk |
| Reset: failed payment unpaid after 7-day grace | **Allowed** with failure notices, 7 days to pay, no reset when the cause is Chalyb/MP or a notice hold. Low–medium risk |
| Reset: refund | **Not as written.** Medium–high risk (penalizes exercising rights). Fix: refunds don't reset (R.4) |
| Reset: chargeback | **Not as written.** Medium–high risk. Fix: no automatic reset; only if the dispute is decided for Chalyb and the amount stays unpaid, then the normal 7-day failed-payment rule (R.4) |
| Return after cancelling starts at $1,662 | **Allowed:** new contract at the published price with fresh consent |
| Does Pro Lealtad's $1,662 support the struck $1,662 on Pro mensual? | **No.** It doesn't help, and using it that way adds risk (R.5) |

## R.1 Amounts: truncated, not rounded

The rule is 10% of the month-1 price ($166.20) per paid month, capped at 60%. It is **not** 10% of the previous month (compounding would give $1,346 in month 3).

| Month | Exact (1,662 × (1 − k×10%)) | Charged (floor) | Nearest-peso rounding would be | Real % off month 1 |
|---|---|---|---|---|
| 1 | 1,662.00 | **1,662** | 1,662 | 0.00 |
| 2 | 1,495.80 | **1,495** | 1,496 | 10.05 |
| 3 | 1,329.60 | **1,329** | 1,330 | 20.04 |
| 4 | 1,163.40 | **1,163** | 1,163 | 30.02 |
| 5 | 997.20 | **997** | 997 | 40.01 |
| 6 | 831.00 | **831** | 831 | 50.00 |
| 7+ | 664.80 | **664** | 665 (only 59.99% off) | 60.05 |

- **Convention to state:** "Montos con IVA incluido, redondeados hacia abajo al peso entero; el descuento real es igual o mayor al indicado."
- Truncation is the right convention: every advertised % is met or beaten, which matters for art. 32 truthfulness and FTC "real %".
- **Totals:**
  - Year 1: $11,461 (vs Pro mensual $11,964 and Pro anual $9,970).
  - Year 2: $7,968.
  - Monthly bill below Pro mensual from month 6. Running total below Pro mensual from month 11.
  - Months 1–4 cost **more** than Pro mensual. Disclose this (art. 32: information must not be partial). The mockup's compare line only says "cuesta menos… desde el mes 6".
- **USD (not in spec; derived only if the config base is US$84):** $84, $75, $67, $58, $50, $42, then $33. Year 1 $574, year 2 $396. Each is ≥ the advertised % (60% → $33 = 60.71%). Don't offer Pro Lealtad in USD until the owner fixes these amounts and the US/Canada items in R.2 are done.

## R.2 Pre-payment disclosure and consent

**Legal basis**
- LFPC **art. 7 Bis:** total amount, notorious and visible, including taxes. For a variable plan that means every amount.
- **Art. 76 Bis VIII:** clear, prominent, accessible information on the recurring charges, their **periodicity, amount and date**, plus express, informed consent.
- **Art. 32:** truthful, not misleading.
- **Art. 43:** each plan's conditions and cost.
- **CA B&P §17601(a)(2)(C)** (verified): the automatic-renewal offer terms must include "the recurring charges… and that the amount of the charge may change, if that is the case, and the amount to which the charge will change, if known". **§17602(a)(1)** requires clear and conspicuous display near the consent; (a)(3) an acknowledgment; (a)(4) express consent.
- **ROSCA, 15 U.S.C. §8403** (verified): all material terms disclosed clearly and conspicuously before billing information is collected; express informed consent; a simple way to stop charges.
- **NY GBL §527-a(1)(a)–(c):** material terms, consent, post-consent notice.
- **Quebec CPA s.54.4:** itemized price and total before the contract. Quebec stays blocked until the French version exists.
- **Canada Competition Act s.74.01:** general misleading-representation rules. The "Precio regular" label is an ordinary-price claim under s.74.01(3).

**Pricing panel copy (Spanish)** (also in aceptacion-ux §4.2):
> **Pro Lealtad** · Se renueva cada mes · Sin prueba gratis
> **$1,662 MXN el primer mes.** Cada mes que sigues pagando, tu precio baja 10% del precio del mes 1, hasta **$664 MXN al mes desde el mes 7** (60% menos).
> Mes 1: $1,662 · Mes 2: $1,495 · Mes 3: $1,329 · Mes 4: $1,163 · Mes 5: $997 · Mes 6: $831 · Mes 7 en adelante: $664 MXN al mes. IVA incluido; montos redondeados hacia abajo al peso.
> Del mes 1 al 4 pagas más que en Pro mensual ($997); desde el mes 6 pagas menos. En el primer año, Pro anual ($9,970) es lo más barato.
> **Se cobra hoy $1,662 MXN.** Después se cobra automáticamente cada mes el monto del calendario, hasta que canceles.
> ⓘ **Tu precio vuelve a $1,662 si** cancelas (al terminar tu mes pagado), cambias a otro plan o un pago queda sin cubrir 7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician.

**Checkout block, with real dates** (example: signup on Oct 3, 2026):
> **Hoy, 3 de octubre de 2026, se cobran $1,662 MXN** a tu tarjeta terminación **4821** (mes 1 de Pro Lealtad).
> Después, cada mes, automáticamente y hasta que canceles: 3 de noviembre de 2026: $1,495 · 3 de diciembre de 2026: $1,329 · 3 de enero de 2027: $1,163 · 3 de febrero de 2027: $997 · 3 de marzo de 2027: $831 · desde el 3 de abril de 2027: $664 MXN cada mes.
> Te avisamos por correo 7 días antes de cada cobro, con su monto.
> Si cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar, tu precio vuelve a empezar en $1,662.
> Cancela en 1 clic desde **Mi cuenta → Mi plan**; conservas Pro hasta el final del mes pagado.

**Checkbox (mandatory, unchecked):**
> ☐ Acepto que Chalyb cobre **hoy $1,662 MXN** a mi tarjeta y después, **automáticamente cada mes**, $1,495, $1,329, $1,163, $997 y $831 MXN, y luego **$664 MXN al mes** mientras siga suscrito, hasta que cancele. Entiendo que **mi precio vuelve a empezar en $1,662** si cancelo, cambio de plan o un pago queda sin cubrir 7 días después de fallar, y acepto los [Términos de Suscripción](/suscripcion).

- **Button:** "Pagar $1,662 y empezar Pro Lealtad".
- This replaces spec string `checkout.lealtad.consent`, which omitted the renewal frequency wording, dates and failed-payment trigger.
- Also update `plans.lealtad.reset` and `billing.lealtad.warn` to the reset rule above. Their current wording ("si cancelas o cambias de plan") omits the failed-payment trigger.

**Mockup fixes (86/88)**
1. Remove "**Precio regular**" under the month-1 bar.
2. Label the percentages "10% menos que el mes 1" (or put a legend "vs. mes 1").
3. Add the months 1–4 sentence.
4. Add the failed-payment trigger and the "no reinician" line to the reset box.
5. Keep the reset box at body-text size next to the CTA (CA "clear and conspicuous" = contrasting type/box; the amber box qualifies).

## R.3 Notices for each step

- **Mexico:** every monthly charge is an automatic renewal, so LFPC 76 Bis VIII requires notice **≥5 calendar days before each one**, "permitiendo su cancelación sin penalización". The notice must carry **that month's amount**:
  - the amount differs every month, and the first paragraph requires informing the amount and date of each recurring charge;
  - a notice with a stale amount would not be the "informed" notice the consumer needs to decide whether to cancel.
- **California:** §17602(g)(2) (verified) requires notice of "a change in the fee charged… **including changes the consumer affirmatively consented to**" **7–30 days before** each fee change, with cancellation information the consumer can keep. Each step (months 2–7) is a fee change.
- **New York:** §527-a(1)(g) requires notice of material changes "including any price increases" 5 business days to 30 days before. Step-downs are decreases, but the monthly notice covers them anyway.
- **Recommended cadence:**
  - **Confirmation at signup:** full schedule with dates, reset rule, how to cancel. This is the CA (a)(3) acknowledgment and the NY (1)(c) notice.
  - **Before every charge (months 2, 3, …, forever): email + banner 7 days before**, with the exact amount, the step, the following amounts and a cancel link.
    - 7 days is ≥5 (Mexico) and within CA's 7–30.
    - If Pro Lealtad is ever sold in the US, send it **10 days** before, so 5 business days are always covered across holidays.
  - **Delivery rule (Términos 2.7 bis):** notice not delivered by charge − 5 days → hold the charge until 5 days after an effective notice. **The hold never breaks the streak.**
  - **Month 7:** the notice says "ya estás en tu precio más bajo".
  - **Annual summary** for monthly plans (existing).
  - **Failed payment:** notices on day 0 and day 5 of the 7-day grace, stating the reset consequence.
- **Templates:** aceptacion-ux §4.2 (confirmation, step notice, failed payment).

**Step notice:**
- **Asunto:** El {fecha_cobro} se cobran ${monto} MXN de tu Pro Lealtad (mes {n})
- **Cuerpo:**
> Hola {nombre}: el **{fecha_cobro}** cobraremos **${monto} MXN** (IVA incluido) a tu tarjeta ••{ultimos4} por el **mes {n}** de Pro Lealtad, {pct}% menos que tu mes 1. El mes pasado pagaste ${monto_anterior}.
> Después: {siguientes montos}, y desde el mes 7, $664 MXN al mes. [o: Ya estás en tu precio más bajo: $664 MXN al mes mientras sigas.]
> Si cancelas o cambias de plan, tu precio vuelve a empezar en $1,662.
> ¿No quieres seguir? [Cancelar en 1 clic] antes del {fecha_cobro} y no se te cobra.
> [Ver mi plan]

## R.4 The reset: disclosure and lawfulness per trigger

**Framework**
- LFPC **art. 1:** consumer rights cannot be waived; no agreement can override them.
- **Art. 10:** no abusive clauses or coercive practices; no charges without prior consent.
- **Art. 85:** adhesion contracts may not impose disproportionate, inequitable or abusive obligations.
- **Art. 90:** a closed list of void clauses. Most relevant: fr. I (unilateral modification) and fr. VI (waiving protection).
- **Art. 76 Bis VIII:** each renewal notice must allow cancellation "**sin penalización**". **Art. 76 Bis IX:** immediate cancellation.
- A reset is lawful when it is the disclosed consequence of the consumer leaving the plan or not paying. It is **not** lawful when it punishes the consumer for exercising a right (refund, dispute, cancellation) in a way that charges them more or deters the exercise.

**Two structural rules that make the design safe:**
1. **Every reset is a new subscription with fresh consent**, never a higher charge on a running preapproval. This matches spec §15.6. A higher charge on a running preapproval would be an unconsented increase (art. 10, 76 Bis VIII; NY §527-a(1)(b-1) requires affirmative consent or a 14-day cancel + pro-rata refund).
2. **Chalyb-side causes never reset:** holds, Mercado Pago errors, a failed amount update, plan withdrawal or a forced plan change.

| Trigger | Verdict | Why / conditions |
|---|---|---|
| **Cancel** | **Lawful, low risk** | Cancelling costs nothing: no fee, no more charges, access to period end, undo before period end keeps the step. The lost future discount applies only if the consumer later signs a new contract, at the published price. That is the nature of a loyalty plan, not a "penalización" on cancelling. Keep the cancel flow to one factual line, with no extra step or repeated warnings (76 Bis IX; CA §17602(d), (e)(2)). **Safer option:** a [30]-day return window that keeps the step. It removes most of the "deters cancellation" argument |
| **Switch plans / upgrade to VIP / switch to Pro mensual or anual** | **Lawful, low risk** | The consumer's choice to leave the plan; warned on each row and the confirm page with the amount. Effective at period end (spec). Not lawful if Chalyb forces the change |
| **Failed payment unpaid after 7-day grace** | **Lawful, low–medium risk** | Termination for non-payment after notice and a reasonable chance to pay. Conditions: notices on day 0 and day 5 stating the consequence; no reset if the failure stems from Chalyb/MP or a 2.7 bis hold; paid within grace = month counts (spec). Terms §8.2 now sets 7 days for Pro Lealtad |
| **Refund** | **As written: not lawful, medium–high risk.** Fixed: refunds never reset | Refunds are often a legal right (Términos §7.2–7.3: Chalyb error, service failure, uninformed or unauthorized charges, unaccepted increases; LFPC arts. 92, 92 Ter where applicable; revocation art. 56 where applicable). Resetting the loyalty step because the consumer got a refund imposes a cost on exercising an irrenunciable right (art. 1, art. 10, art. 85) and chills it. **Fix (Términos 4 bis.5):** a refund doesn't reset and the month still counts. If the consumer asks for a refund **and** cancels, the cancel rule applies. That is lawful because the cause is the cancellation |
| **Chargeback** | **As written: not lawful, medium–high risk.** Fixed: no automatic reset | Disputing a charge with the bank is a consumer right (Términos §10.4); resetting on filing deters it. **Fix:** no reset when filed. If decided for the consumer, the step is kept. If decided for Chalyb and the amount stays unpaid, treat it as a failed payment (notice + 7 days to pay), then the non-payment rule. §10.2 (temporary suspension of payment features during the dispute) stays |
| **Return after cancelling starts at $1,662** | **Lawful, low risk** | A new contract at the published Pro Lealtad price with a new disclosure and checkbox (Términos 4 bis.4, last paragraph). The consumer can also pick Pro mensual at $997. Optional 30-day return window as above |
| **Pause** (none today; spec says reset if added) | **Lawful if disclosed in the pause dialog** | Same reasoning as cancel |
| **Chalyb withdraws Pro Lealtad** | Must **not** reset or raise the schedule for current subscribers (art. 90 fr. I) | Términos 4 bis.3 guarantees the schedule |

**Disclosure of the reset:** pricing panel, checkout block, checkbox, confirmation email, every step notice, Mi plan, each "Cambiar de plan" row and confirm page, the cancel screen and the failed-payment emails. Exact copy in aceptacion-ux §4.2.

## R.5 Does Pro Lealtad's real $1,662 month-1 charge support the struck $1,662 on Pro mensual?

**Verdict: No.** It does not substantiate the Pro mensual reference price, and pairing them makes the reference look more fictitious, not less. Keep the Q2 rule: the struck $1,662 on Pro mensual needs its own evidence (the other site, same seller, same product, recent; label A), or it goes.

**Reasons**
1. **Different product and offer.**
   - FTC 16 CFR 233.1(a) (verified) compares against "the advertiser's own former price **for an article**": the price at which *that article* was offered regularly for a reasonably substantial period.
   - Pro Lealtad's $1,662 is the entry step of a seven-step schedule whose year-1 average is $955/month. It is not the price at which Pro mensual (a flat $997/month plan) was offered.
   - Canada s.74.01(3) likewise looks at the ordinary price of "the product".
2. **Concurrent, not former.**
   - Pro Lealtad was created on Oct 3, 2026 (09:02), minutes after the strike decision (08:55).
   - A price offered *at the same time* as the "reduced" price is not a *former* price "in the recent, regular course of business" (233.1(b), (d)). CA §17501 asks whether it was the prevailing market price within the prior 3 months; it was not.
3. **Built-in reason nobody pays it for Pro.**
   - For months 1–4 Pro Lealtad costs more than Pro mensual for the same Pro features. Its $1,662 sales are sales of a staircase, not evidence that Pro is worth $1,662.
   - 233.1(a) warns against "an artificial, inflated price… established for the purpose of enabling the subsequent offer of a large reduction". 233.1(c)'s example is a seller who knows he "will be able to sell no, or very few" at the inflated price.
   - Using Pro Lealtad to prop up the strike would invite exactly that reading. The spec's own L12 note ("may help substantiate") is the kind of record a regulator would cite.
4. **LFPC art. 46 "precios… normales del establecimiento".**
   - The normal price of Pro mensual on chalyb.com is the price it is actually sold at: $997 today ($749 to grandfathered users; $1,395 earlier, per the owner).
   - A higher, concurrent price on a different plan doesn't make $1,662 the establishment's normal price for Pro mensual.
   - Art. 32: a partial or tendentious comparison that can mislead is prohibited. The month-1 bar labeled "**Precio regular**" compounds this; remove it (R.2).
5. **Circularity.** Pro Lealtad month 5 is "$997 = 40% menos" and Pro mensual is "$997, 40% de descuento" off $1,662. Each plan's "discount" leans on the other's base. Present Pro Lealtad's percentages as "menos que tu mes 1", never as a discount off a regular price.

**Compliant side-by-side presentation (Spanish)**
- Toggle **Mensual / Anual / Lealtad**, as in the spec. Each plan shows only **its own actual prices**.
- **Pro mensual:** "**$997 MXN al mes** · Se renueva cada mes".
  - No strike. Or, only if Q2's evidence exists: "~~$1,662~~ Precio anterior en [sitio] hasta el [fecha]".
  - Never "precio regular" or a bare "40% de descuento".
- **Pro Lealtad:** the R.2 panel. "$1,662 MXN el primer mes", the full schedule, "menos que el mes 1", **no "Precio regular"**.
- **Neutral comparison** (keep the spec's 3-box comparison, fix the wording):
  > **Primer año:** Pro anual $9,970 · Pro Lealtad $11,461 · Pro mensual $11,964.
  > **Segundo año, si sigues:** Pro Lealtad $7,968 · Pro anual $9,970 [si se renueva a $9,970; ver D20/D21] · Pro mensual $11,964.
  > Del mes 1 al 4, Pro Lealtad cuesta más que Pro mensual; desde el mes 6 cuesta menos.
- **D21:** if Pro anual keeps renewing at $9,970, don't claim Pro anual is "siempre" the best deal. The current "en el primer año" wording is correct.
- "Mejor oferta" stays off (Q2/L3).

## R.6 What the P5 tests should check (Pro Lealtad)

No code was changed. These extend spec §15.9.

**Pricing math**
1. `lealtadPriceCents(0..6)` = 166_200, 149_500, 132_900, 116_300, 99_700, 83_100, 66_400.
   - `step > 6` stays at 66_400.
   - Floor, not round: assert `lealtadPriceCents(1) !== 149_600` and `lealtadPriceCents(6) !== 66_500`.
   - Each step's real % ≥ advertised.
   - Steps are linear off the base, not compounding (`lealtadPriceCents(2) === 132_900`, not 134_600).
2. Totals: months 1–12 = 1_146_100; months 13–24 = 796_800.

**Disclosure and consent**
3. The Pro Lealtad panel, checkout block, checkbox and confirmation email each contain:
   - all seven amounts;
   - "hoy" + $1,662;
   - a renewal phrase ("cada mes" / "automáticamente");
   - the three reset triggers;
   - "redondeados hacia abajo";
   - and in the checkout block, a date per step.
   - Strings are built from `lealtadSchedule()`, never typed.
   - Banned in Pro Lealtad strings: "gratis" except "Sin prueba gratis", "Precio regular", "descuento" without "mes 1".
4. Consent record `lealtad_started` stores the rendered schedule with dates, the checkbox text and the `UI_VERSION` (bumped).
5. `planHasTrial('pro_lealtad') === false`.

**Notices**
6. `dueNotices()` for `pro_lealtad`: a mandatory notice 7 days before **every** charge, carrying `lealtadPriceCents(loyalty_step)` (next step's amount) and the step number. Month 7+ notices still fire, with the floor text.
7. `holdDecision()` applies to Pro Lealtad. **A hold never changes `loyalty_step`** and never counts as a missed month.

**Reset logic**
8. Reset triggers → a **new** subscription/preapproval at 166_200 **only after new consent**:
   - cancel at period end → reset;
   - undo-cancel → no reset;
   - plan change → reset;
   - unpaid after 7-day grace → reset;
   - paid within grace → no reset, month counts.
   - There must be no code path that raises `transaction_amount` on an existing preapproval.
9. **Refund** (any type, without cancellation) → `loyalty_step` unchanged; the refunded month still counts. Refund + cancel → cancel rule.
10. **Chargeback** filed → no reset. Resolved for the user → no reset. Resolved for Chalyb with the amount unpaid → failed-payment flow (day-0 and day-5 notices, 7 days) → reset only after that.
11. Chalyb/MP-side failure (PUT failed, processor error, hold) → no reset.

**Mercado Pago and catalog**
12. MP amount gate (spec §15.6): accept expected or step − 1 within 48 h; never above the base; overcharge → access + automatic refund of the difference, with **no** effect on the step.
13. Plan withdrawal flag (`lealtadOpenToNewCustomers = false`) hides Pro Lealtad for new users but keeps existing schedules and steps.

## R.7 Not verified (Pro Lealtad)

- That a Mercado Pago preapproval amount can be lowered by `PUT /preapproval/{id}` without payer re-authorization, and whether MP emails the payer (spec §15.6 says to verify in the sandbox).
- USD amounts: not in the spec. The derived figures above assume a US$84 base; the owner must decide.
- Whether PROFECO would treat the loss of an accrued loyalty step as a "penalización" under 76 Bis VIII. No guidance or precedent found. The analysis above is an interpretation; the optional 30-day return window reduces the risk.
- Reglamento LFPC (not reviewed); Quebec CPA rules on variable-price contracts beyond s.54.4 (not reviewed; Quebec blocked); NY §527-a amendment dates.

---

# S. Refunds and chargebacks policy (owner-approved, Oct 3, 2026 ~09:53)

**Files changed:**
- `terminos-de-suscripcion.md`: summary bullet; §2.2; §4 bis.5; §7 rewritten; §10 rewritten.
- `terminos-y-condiciones.md`: §13.2(c); new §15.5.
- `uso-aceptable-y-contenido.md`: §3, last paragraph.
- `aceptacion-ux.md`: §4 cross-reference; §10.1 events; §10.5 rewritten; checklist.

**Backups:**
- `.bak-2026-10-03c` already existed for three files, made by Producto before the rename. Those were left untouched; my pre-edit copies of those three files are `.bak-2026-10-03c-legal`.
- `terminos-y-condiciones.md` and `uso-aceptable-y-contenido.md`: `.bak-2026-10-03c`.

## S.1 Legal frame
- **LFPC art. 1:** consumer rights cannot be waived.
- **Art. 10:** no abusive clauses or coercive practices; no charges without consent or not derived from the contract.
- **Art. 85:** no disproportionate, inequitable or abusive obligations.
- **Art. 90:** fr. I (unilateral modification), fr. V (formalities as a condition for actions against the provider), fr. VI (waiver).
- **Art. 7:** honor offered conditions; services shall not be denied to anyone.
- **Art. 50:** an offer not honored means paying the difference.
- **Art. 56:** revocation, where applicable.
- **Art. 58:** no denying or conditioning services, no "selección de clientela… reserva del derecho de admisión", except causes affecting the security of the establishment or its clients.
- **Art. 76 Bis VIII–IX:** consent; 5-day notice; cancellation without penalty; immediate cancellation.
- **Art. 91:** excess payments recoverable; 5 business days after the claim, otherwise interest.
- **Art. 92 Bis:** bonificación/compensación when a service is deficient or not provided for the provider's reasons.
- **Art. 92 Ter:** bonificación of at least 20% of the price paid, without prejudice to damages.
- All quoted from the LFPC text current to the DOF 12-12-2025 reform.

**Design principles:**
1. Refunds are limited to the legal cases, listed precisely.
2. Exercising a right (refund, dispute, cancellation, PROFECO complaint) never triggers a penalty, ban or price reset.
3. Measures apply only to a narrowly defined **bad-faith chargeback** (fraud/abuse), after notice and 10 business days.
4. "Escríbenos primero" is optional. Making it mandatory would be a formality barred by art. 90 fr. V.

## S.2 Clause text (as added)

**Términos de Suscripción §7.1:**
> **Regla general: no hay reembolsos, salvo los que exige la ley.** Fuera de los casos de la sección 7.2, los pagos no son reembolsables y no hay reembolsos proporcionales por periodos ya iniciados, por meses no usados de un plan anual, por créditos no usados ni por no haber usado el Servicio. Esta regla no limita ningún derecho que te otorgue la Ley Federal de Protección al Consumidor (LFPC) u otra ley aplicable, que son irrenunciables.

**§7.2, the cases where the law requires a refund:**
- (a) cobro no autorizado o sin consentimiento expreso (arts. 10, 76 Bis VIII): total;
- (b) cobro de fin de Prueba o renovación sin el aviso entregado con ≥5 días naturales (76 Bis VIII; §§2.7, 2.7 bis, 3.3): total, si se pide;
- (c) cobro después de cancelar (76 Bis IX): total;
- (d) duplicados, errores, montos mayores a lo informado o convenido, incluido un aumento no aceptado o un monto distinto al calendario de Pro Lealtad (arts. 7, 91): el excedente dentro de los 5 días hábiles siguientes a la reclamación;
- (e) servicio no prestado (reembolso del periodo no prestado) o deficiente por causas de Chalyb (bonificación o compensación ≥20% del precio pagado del periodo afectado, sin perjuicio de daños) (arts. 92 Bis, 92 Ter);
- (f) oferta o condiciones no respetadas: cumplimiento o rescisión, más la diferencia y la bonificación (arts. 7, 50);
- (g) cierre sin causa, retiro de una función esencial o cambio relevante perjudicial no aceptado: reembolso proporcional (art. 90 I; T&C 13.3, 14.3);
- (h) revocación del art. 56, cuando resulte aplicable;
- (i) cualquier otro caso que ordene la ley, la PROFECO, un tribunal o autoridad, o las leyes imperativas del país del usuario.

**§7.3:**
> **Pedir un reembolso nunca te perjudica.** Solicitar o recibir un reembolso, bonificación o compensación **nunca** da lugar a una penalización, cargo adicional, suspensión, cierre o bloqueo de tu cuenta, pérdida de beneficios ni cambio o reinicio de tu precio (incluido tu calendario de Pro Lealtad, sección 4 bis.5). Solo si tú decides cancelar se aplica lo que corresponde a una cancelación.

**§7.4–7.5:**
- No courtesy refunds. Owner note: this drops the recommended courtesy refund of the first annual charge after the trial.
- The request needs only email, date and amount; written answer in ≤5 business days, with reasons; refund to the same payment method; PROFECO available.

**§10.2:**
> **Presentar una disputa no tiene consecuencias por sí solo.** Mientras tu disputa se resuelve, tu cuenta y tu plan siguen funcionando normalmente. Presentar una disputa **nunca**, por sí solo, da lugar a una suspensión, cierre o bloqueo de tu cuenta, a un cargo adicional ni a un cambio o reinicio de tu precio (incluido tu calendario de Pro Lealtad). Tampoco tiene consecuencias una disputa por un **cargo no autorizado** o por un cobro que, conforme a la sección 7.2, debíamos devolverte […].

The old §10.2(a), which suspended paid features as soon as a dispute was filed, was removed.

**§10.4, definition of a bad-faith chargeback (all four conditions must be met):**
- (a) a disputed charge the customer **authorized** (consent on record) that is not a §7.2 case;
- (b) the service was **provided and used** in that period, and not cancelled before the charge;
- (c) the dispute was **resolved for Chalyb**, or resolved for the customer and the customer **does not pay** after the notice;
- (d) the §10.5 notice was sent and the customer neither paid nor showed, within the deadline, that the charge wasn't theirs.

**§10.5, notice and chance to respond:**
- The email states the charge, the evidence summary, the possible measure, and the options: pay, or respond.
- The customer has **10 días hábiles** from sending.
- Chalyb gives a written decision with reasons.
- If the customer pays or shows the charge wasn't owed, the case is closed with no measure.

**§10.6, proportional measures:**
- (a) suspend paid features until paid; or
- (b) close the account if the amount is still unpaid [30] days after suspension, or if it is a repeat bad-faith chargeback.
- Content download is always kept; no fee, interest or penalty.
- [Owner/attorney: if Chalyb won and nothing is unpaid, recommend no suspension/closure on a first case, only §10.8.]

**§10.7, evidence:**
- consent log (exact text, checkbox, timestamp, IP, device, terms version);
- notices and their delivery;
- charge receipt;
- cancellation status;
- usage in the disputed period;
- used only for this purpose (Aviso de Privacidad).

**§10.8, after a bad-faith chargeback:**
> […] para contratar de nuevo un plan de pago podemos pedirte el **pago por adelantado** de cada periodo antes de activarlo, sin Prueba gratis, o, en casos reiterados o de fraude (por ejemplo, tarjetas de terceros o identidad falsa), **negarte nuevas suscripciones** de pago. Siempre podrás usar el plan Gratis, salvo que tu cuenta se haya cerrado conforme a la sección 10.6. Estas medidas nunca se aplican por pedir un reembolso ni por una disputa que no sea de mala fe.

**Pro Lealtad, §4 bis.5:** refunds and disputes keep the month counting. Consequences arise only from a bad-faith chargeback left unpaid after the 10-business-day notice, in which case the subscription can end for non-payment, and §10.8 applies on return.

**T&C §15.5 (new):**
> **Ejercer tus derechos no te perjudica.** Pedir o recibir un reembolso, bonificación o compensación, disputar un cargo ante tu banco o Mercado Pago, cancelar tu suscripción o presentar una queja ante la PROFECO **nunca** da lugar a una penalización, cargo adicional, suspensión, cierre o bloqueo de tu cuenta, ni a un cambio o reinicio de tu precio. La única excepción es un contracargo de mala fe, que es un fraude y no el ejercicio de un derecho, y solo en los términos de la sección 10 de los Términos de Suscripción.

**Other changes:**
- T&C §13.2(c): "contracargos sin fundamento" → "un contracargo de mala fe (… sección 10.4 … aviso y plazo de 10 días hábiles de su sección 10.5)".
- AUP §3: payment fraud (third-party cards, bad-faith chargebacks) falls under Suscripción §10; requesting a refund, disputing or cancelling is never a violation.

## S.3 Needs attorney sign-off
1. **§10.8 refusal of new subscriptions** against art. 7 ("bajo ninguna circunstancia serán negados… a persona alguna") and art. 58 ("selección de clientela… reserva del derecho de admisión", with an exception for causes affecting the security of the establishment or its clients). Advance payment without a trial is lower risk than refusal, but arguably still "condicionamiento". Highest-risk item.
2. **§10.6 measures when Chalyb won the dispute and nothing is unpaid.** Suspending or closing for a dispute the customer lost, with no money owed, is the point most open to the reading "penalty for exercising a right" (arts. 1, 10, 85). Recommendation: on a first case, only §10.8.
3. **Account closure without refunding the remaining prepaid period** (T&C 13.2, last sentence) for an annual plan closed under §10.6.
4. **§7.2(b) as a legal entitlement.** 76 Bis VIII requires the notice but doesn't spell out the remedy. A full refund is our reading, combined with art. 10 (charges not derived from the contract as agreed).
5. **§7.2(e) 20% bonificación** scope for a SaaS outage (art. 92 Ter applies to arts. 92 and 92 Bis), and what counts as a "significant period".
6. **§7.2(h) art. 56 revocation** applicability to online SaaS. Art. 56's last sentence excludes services whose provision date is within 10 business days of the order.
7. **Removing courtesy refunds (§7.4):** a commercial risk for the $9,970 annual auto-charge after a 7-day trial (more disputes), not a legal defect.
8. **The 10 business days and the [30]-day closure period** are policy choices (reasonable), not statutory figures. US/Canada/Quebec rules on account termination and chargebacks were not reviewed.
9. **Mercado Pago's dispute-response deadline** and evidence format: not verified.

## S.4 What the P5 tests should check
No code was changed.

**Refunds**
1. `refund_issued` never changes `loyalty_step`, plan, price or account status, and never creates `account_restricted`, `prepayment_required` or `trial_blocked`. A refund + cancel follows the cancel path only.
2. Refund reasons are restricted to `legal_7_2_a` … `legal_7_2_i`; no `courtesy`. The over-charge path (Lealtad amount gate, duplicates) refunds automatically and records `legal_7_2_d` within 5 business days.

**Chargebacks**
3. `chargeback_opened` causes **no** change to access, plan, price, `loyalty_step` or the trial eligibility.
4. `chargeback_triaged = legal_refund` → refund/accept, close, no notice, no measure. That covers no consent record, no delivered notice ≥5 days, a charge after cancellation, or an amount mismatch.
5. The bad-faith predicate returns true only if all of these hold:
   - consent record exists;
   - not a §7.2 case;
   - usage in the period;
   - not cancelled before the charge;
   - (resolved `won`) or (resolved `lost` and unpaid);
   - notice sent;
   - `now ≥ deadline`;
   - no payment and no accepted response.
6. The deadline is **10 business days** after `chargeback_notice_sent`, skipping weekends and Mexican official holidays (holiday calendar to be provided). A test pins one date.
7. Payment or an accepted response before the deadline → `chargeback_bad_faith_decided = none`; any suspension is lifted on payment.
8. `account_closed` only if unpaid ≥[30] days after `account_restricted`, or repeat bad faith. Content download stays available.
9. `prepayment_required` is set only after `chargeback_bad_faith_decided = bad_faith`. It blocks the trial and requires payment before activation, and it never fires for refunds or non-bad-faith disputes.

**Evidence and copy**
10. The evidence PDF contains:
    - consent text, checkbox, timestamp, IP, UA, terms version/hash;
    - the notice for that charge, with its delivered status;
    - payment id;
    - cancellation status;
    - usage summary;
    - never the full card number.
11. Copy: the dispute notice includes the amount, the date, the 10-business-day deadline date, the pay and respond options, and the sentence that refunds and unauthorized-charge disputes never have consequences.
