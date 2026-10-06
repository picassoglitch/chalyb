# Aceptación en el producto (UX, microcopy y registro de evidencia)

**Versión:** [VERSIÓN] · **Fecha:** [FECHA] · Documento interno para producto, diseño e ingeniería. No se publica.

> **Resumen en palabras simples**
>
> - Aceptar debe ser **fácil, claro y comprobable**: una línea al crear la cuenta, una casilla al activar la prueba o pagar, y una ventana cuando cambian los Términos.
> - Antes de pedir la tarjeta mostramos **"Hoy pagas $0"**, la **fecha** y el **monto exacto** del primer cobro y **cómo cancelar en 1 clic**.
> - Las promociones por correo van en una **casilla aparte y desmarcada**.
> - Guardamos un **registro de evidencia** de cada aceptación (quién, qué versión, cuándo, desde dónde y qué texto vio) para defendernos en contracargos y quejas.
> - **Cambio obligatorio frente al plan original:** el recordatorio previo al cobro debe enviarse **al menos 5 días naturales antes** (art. 76 Bis, fr. VIII, LFPC; reforma DOF 12-dic-2025, vigente desde el 13-dic-2025 — **verificado** en el texto publicado). La prueba dura **7 días** (Pro mensual y Pro anual) y el **aviso de cobro se envía el día 0, al activarla** (7 días antes del cobro); si no se entrega a más tardar 5 días antes del cobro, el cobro se retiene. Las renovaciones mensuales se avisan 7 días antes y las anuales 30 y 7 días antes. Una prueba de 3 días **no** permite el aviso de 5 días: descartada.
> - **Aumentos de precio:** solo con aceptación expresa; aviso exactamente 30 días antes. Sin aceptación, no se renueva.

---

## 1. Principios (estilo App Store / Google Play, pero claro)

1. **Clickwrap, no browsewrap.** La aceptación siempre ocurre con una acción del usuario (botón o casilla) junto a enlaces visibles a los documentos. Nunca "al navegar aceptas".
2. **Consentimiento expreso para cobros recurrentes.** El artículo 76 Bis, fracción VIII, de la LFPC (reforma DOF 12-dic-2025) exige informar de forma **clara, destacada y accesible** si hay cobros automáticos recurrentes, su **periodicidad, monto y fecha de cobro**, y obtener **consentimiento expreso e informado**. Por eso usamos una **casilla obligatoria desmarcada** junto al bloque de cobro (la opción más defendible). Ver 3.4 para la alternativa "botón como aceptación".
3. **Precio total.** Siempre en MXN con IVA incluido (art. 7 Bis LFPC), de forma notoria y visible. Cerca de la tarjeta se muestra el **total real** ($9,970 al año), nunca un equivalente mensual del plan anual. **Bloqueante:** confirmar con contador que los precios ya incluyen IVA; si no, el precio visible debe ser el total con IVA.
4. **Sin casillas premarcadas** para nada que no sea indispensable. Marketing siempre desmarcado.
5. **Mismo peso visual.** El texto de cobro no va en letra pequeña ni en gris claro: mínimo 14 px, contraste AA, y la fecha y el monto en **negritas**.
6. **Cancelación inmediata y sencilla** (art. 76 Bis, fracción IX, LFPC): Mi cuenta → Mi plan → Cancelar → 1 confirmación. Máximo una oferta de retención, que se pueda saltar y que **siempre muestre en la misma pantalla el botón para terminar la cancelación** (requisito de California, B&P Code §17602(e)(2)).
7. **Versiones con URL fija.** Cada documento publicado tiene versión y URL permanente (ej. `chalyb.com/terminos/v1-3`) y un hash SHA-256 de su contenido.
8. **Fechas en lenguaje natural** y en la zona horaria del usuario: "30 de octubre de 2026". Guardar siempre en UTC.
9. **Datos del proveedor antes de pagar** (art. 76 Bis, fr. III, LFPC): razón social, domicilio físico, teléfono y correo visibles en el checkout (pie de página o enlace "Quién vende").
10. **Revisar y corregir.** Antes del botón final, el usuario puede volver y cambiar plan o datos (Ontario/Quebec: oportunidad de corregir errores antes de aceptar contratos por internet).

## 2. Registro (crear cuenta)

**Ubicación:** debajo del botón principal de registro (correo o "Continuar con Google").

**Microcopy (clickwrap):**

> Al crear tu cuenta aceptas los [Términos y Condiciones](/terminos) y la [Política de Uso Aceptable](/uso-aceptable), y confirmas que leíste el [Aviso de Privacidad](/privacidad). Debes tener 18 años o más.

- Botón: **Crear cuenta** · Botón alterno: **Continuar con Google**
- Los enlaces abren en una ventana nueva o en un panel, sin perder lo capturado.

**Casilla de marketing (separada, desmarcada, opcional):**

> ☐ Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera.

**Evidencia a guardar:** evento `signup_terms_accepted` (y `marketing_opt_in` solo si se marca) — ver sección 10.

## 3. Pantalla "Tu prueba" (antes de pedir la tarjeta)

### 3.1. Título y selector de plan

**Título:** Prueba Pro gratis de 7 días
**Subtítulo:** Todas las herramientas incluidas. Cancela cuando quieras.

**Pregunta:** ¿Qué plan quieres cuando terminen tus 7 días gratis?

- ○ **Pro mensual — $997 MXN al mes**
- ○ **Pro anual — $9,970 MXN al año** (un solo cobro al año) · Ahorras $1,994 al año frente a 12 meses de Pro mensual

> Nota de diseño: el bloque de cobro (3.2) se actualiza en vivo según la opción. En la opción anual el monto principal visible es **$9,970 MXN al año**; la línea "o $997 MXN al mes en plan mensual" solo puede aparecer en la tarjeta de precios, como precio de *otro plan*, nunca dentro del bloque de cobro ni junto a la casilla (ver `PRICING-2026-10-03-REVISION.md`, Q5). [DECISIÓN DEL DUEÑO: si se preselecciona una opción, preferir Pro mensual; preseleccionar el cobro anual de $9,970 tras solo 7 días aumenta el riesgo de contracargos.] **No usar** "mes gratis", "1 mes" ni "3 días". VIP y VIP anual: sin prueba.

### 3.2. Bloque de cobro (aparece junto al botón, siempre visible)

**Plantilla:**

> **Hoy pagas $0.**
> Tu prueba gratis de 7 días termina el **{fecha_fin_prueba}**.
> Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** {periodicidad} a tu tarjeta terminación **{ultimos4}**, y se renovará automáticamente {renovacion} hasta que canceles.
> Hoy mismo te enviamos por correo el aviso de cobro con esta fecha y este monto.
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el {fecha_fin_prueba} y no se te cobra nada.

Variables:
- `{periodicidad}`: anual → "por 1 año de Pro" · mensual → "por tu primer mes de Pro"
- `{renovacion}`: anual → "cada año ($9,970 MXN)" · mensual → "cada mes ($997 MXN)"
- `{ultimos4}`: si aún no hay tarjeta en esta pantalla, usar "a la tarjeta que registres" y mostrar los 4 dígitos en la pantalla de confirmación.

**Ejemplo renderizado (anual, prueba iniciada el 3 de octubre de 2026):**

> **Hoy pagas $0.**
> Tu prueba gratis de 7 días termina el **10 de octubre de 2026**.
> Si no cancelas antes, el **10 de octubre de 2026** se cobrarán **$9,970 MXN** por 1 año de Pro a tu tarjeta terminación **4821**, y se renovará automáticamente cada año ($9,970 MXN) hasta que canceles.
> Hoy mismo te enviamos por correo el aviso de cobro con esta fecha y este monto.
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el 10 de octubre de 2026 y no se te cobra nada.

**Ejemplo renderizado (mensual):**

> **Hoy pagas $0.**
> Tu prueba gratis de 7 días termina el **10 de octubre de 2026**.
> Si no cancelas antes, el **10 de octubre de 2026** se cobrarán **$997 MXN** por tu primer mes de Pro a tu tarjeta terminación **4821**, y se renovará automáticamente cada mes ($997 MXN) hasta que canceles.
> Hoy mismo te enviamos por correo el aviso de cobro con esta fecha y este monto.
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el 10 de octubre de 2026 y no se te cobra nada.

**Versión EE. UU. (USD, inglés):**

> **$0 today.** Your 7-day free trial ends on **{trial_end_date}**. Unless you cancel before then, on **{charge_date}** we'll charge **US${amount}** {for_one_year|for your first month} to your card ending **{last4}**, plus any sales tax shown below, and it will **renew automatically every {year|month} at US${amount}** until you cancel. We'll email you a charge notice today. Cancel online in 1 click from **My account → My plan**; if you cancel, you keep Pro until {trial_end_date} and pay nothing.

### 3.3. Casilla de consentimiento (obligatoria, desmarcada) y botón

> ☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {renovacion_corta} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion).

- `{renovacion_corta}`: anual → "y cada año después" · mensual → "y cada mes después"
- Botón (deshabilitado hasta marcar la casilla): **Empezar mis 7 días gratis**
- Si el usuario intenta continuar sin marcar: "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."
- EE. UU.: "☐ I agree that unless I cancel before **{charge_date}**, Chalyb will automatically charge **US${amount}** {and every year after|and every month after} (plus applicable sales tax) to my card, and I accept the [Subscription Terms](/subscription)." Botón: **Start my 7-day free trial**.

### 3.4. Alternativa "botón como aceptación" (solo si el abogado la aprueba)

Sin casilla; el botón dice **Empezar mis 7 días gratis y aceptar el cobro automático** y debajo:

> Al tocar el botón aceptas el cobro automático descrito arriba y los [Términos de Suscripción](/suscripcion).

Es más fluida, pero la casilla genera **mejor evidencia de consentimiento expreso** para contracargos y PROFECO. Recomendación: casilla.

### 3.5. Pantalla de tarjeta (Mercado Pago)

Encima del formulario (Brick de Mercado Pago), repetir en 1 línea:

> Hoy pagas **$0**. Primer cobro: **${monto} MXN** {cada mes|por 1 año} el **{fecha_cobro}**, salvo que canceles antes.

Debajo del formulario: "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta."

### 3.6. Confirmación en pantalla y aviso de cobro del día 0 (obligatorio)

**Pantalla:**
> **¡Listo, {nombre}! Tus 7 días de Pro gratis ya empezaron.**
> Terminan el {fecha_fin_prueba}. Primer cobro: **${monto} MXN** el {fecha_cobro} a tu tarjeta ••{ultimos4}. Te enviamos el aviso de cobro a {correo}.
> [Hacer mis primeros clips] · [Ver mi plan]

**Correo "Aviso de cobro" (enviar de inmediato al activar la prueba; es el aviso obligatorio de ≥5 días y además la confirmación/acuse; no mezclar con bienvenida ni marketing):**
- Asunto: **Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas**
- Cuerpo:
> Hola {nombre}:
> Tu prueba gratis de 7 días de Chalyb Pro empezó el {fecha_inicio} y termina el **{fecha_fin_prueba}**.
> **Hoy pagaste $0.** Si no cancelas antes, el **{fecha_cobro}** cobraremos **${monto} MXN** ({plan}) a tu tarjeta ••{ultimos4}, y después **{renovacion}** hasta que canceles.
> Faltan **7 días** para el cobro.
> {solo anual:} ¿Prefieres pagar mes a mes? [Cambiar a Pro mensual: $997 MXN al mes]
> **Cancelar es 1 clic:** [Cancelar mi prueba] (Mi cuenta → Mi plan). Si cancelas antes del {fecha_cobro}, no pagas nada y sigues con Pro hasta esa fecha.
> Documentos que aceptaste: [Términos y Condiciones v{version_tyc}] · [Términos de Suscripción v{version_sus}] · [Aviso de Privacidad v{version_priv}].
> Folio de tu aceptación: {consent_id}

**Versión EE. UU. (inglés):** Subject: **Charge notice: you'll be charged US${amount} on {charge_date} unless you cancel** · Body: trial start and end dates; "$0 today"; amount, frequency ("every month" / "every year"), first charge date, card ending; "To avoid being charged, cancel before {charge_date}: [Cancel my trial]"; link to the terms; consent ID. (Cumple el acuse de CA B&P §17602(a)(3) y el aviso de NY GBL §527-a(1)(c)).

**Regla de entrega:** el aviso debe constar como **entregado** a más tardar **5 días naturales antes** del cobro (día 2). Si rebota o no hay confirmación, mostrar banner en la app, intentar otro medio y **retener el cobro hasta 5 días naturales después de una notificación efectiva** (Términos de Suscripción 2.7 bis), conservando Pro sin costo.

## 4. Recordatorios y avisos de cobro

| Momento | Canal | Asunto / texto |
|---|---|---|
| **Día 0 de la prueba (al activarla = 7 días antes del cobro)** — **obligatorio (≥5 días naturales, art. 76 Bis fr. VIII LFPC; también cumple Quebec: 2–10 días; acuse de CA y aviso de NY)** | Correo + banner | Ver 3.6: **Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas** · [Cambiar a Pro mensual] (si eligió anual) · [Cancelar en 1 clic] |
| Banner durante la prueba (días 0–7) | Banner en Mi cuenta | "Tu prueba termina el {fecha_fin_prueba}. El {fecha_cobro} se cobrarán ${monto} MXN. [Cancelar]" |
| **1 día antes** (día 6) — recomendado; **muy recomendado si eligió Pro anual** | Correo + banner ámbar | **Mañana termina tu prueba gratis** · "Mañana, {fecha_cobro}, se cobrarán ${monto} MXN. [Ver mi plan] · [Cancelar]" |
| Día del cobro | Correo | **Recibimos tu pago de ${monto} MXN** · comprobante, plan, próxima renovación, enlace a cancelar y a factura |
| Renovación anual (Pro anual y VIP anual): 30 días antes y **7 días antes (obligatorio)** | Correo | **Tu plan {plan} anual se renueva el {fecha_renovacion} por ${monto} MXN** · [Cambiar a mensual] · [Cancelar renovación] |
| Renovación mensual: **7 días antes** — **obligatorio (≥5 días)** | Correo + banner | **Tu plan {plan} se renueva el {fecha_renovacion} por ${monto} MXN** · [Ver mi plan] · [Cancelar] |
| Pro Lealtad: **7 días antes de cada cobro** — **obligatorio**, con el monto exacto de ese mes (también cubre California B&P §17602(g)(2): aviso 7–30 días antes de cada cambio de monto) | Correo + banner | Ver 4.2: **El {fecha_cobro} se cobran ${monto} MXN de tu Pro Lealtad (mes {n})** |
| Recordatorio anual para planes mensuales (una vez al año) | Correo | **Resumen anual de tu suscripción** · plan, monto, periodicidad, próxima fecha de cobro, [Cancelar] (California B&P §17602(h), lectura conservadora) |
| Cambio de precio: **exactamente 30 días antes** (ni menos de 30 por Quebec, ni más de 30 por California y Nueva York) | Correo + modal | Ver 4.1. **Sin aceptación expresa no se renueva** al nuevo precio; recordatorio 7 días antes de la fecha. |

Guardar evidencia de envío de cada aviso: `message_id` del proveedor de correo, plantilla y versión, fecha y hora UTC, estado de entrega (entregado/rebotado). Si el aviso obligatorio rebota o no se envía, mostrar banner en la app, intentar otro medio y **no cobrar hasta que hayan pasado al menos 5 días naturales desde una notificación efectiva** (regla obligatoria, recogida en la sección 2.7 bis de los Términos de Suscripción). Un cobro sin aviso previo es reembolsable (Términos de Suscripción 7.2(b)).

### 4.1. Aviso de aumento de precio (suscriptores actuales)

**Correo (30 días antes de la renovación en que aplicaría):**
- Asunto: **Tu plan {plan} cambia de precio: acepta o decide antes del {fecha_aplicacion}**
- Cuerpo:
> Hola {nombre}:
> El precio de {plan} sube de **${precio_anterior} MXN** a **${precio_nuevo} MXN al {mes|año}** (IVA incluido), un aumento de {porcentaje}%.
> **Solo se te cobrará el nuevo precio si lo aceptas.** Si lo aceptas, se aplicará a partir de tu renovación del **{fecha_aplicacion}**.
> Si no lo aceptas antes de esa fecha, **tu plan no se renovará al nuevo precio**: conservas {plan} hasta el {fecha_fin_periodo} y después pasas al plan Gratis, sin ningún cobro. [o, si el dueño decide mantener el precio anterior: "seguirás pagando ${precio_anterior} MXN".]
> [Acepto el nuevo precio] · [Cancelar sin costo] · [Ver mi plan]

**Modal en la app (hasta que acepte o decline):**
> **Cambia el precio de tu plan {plan}**
> Hoy pagas ${precio_anterior} MXN al {mes|año}. A partir del {fecha_aplicacion}: **${precio_nuevo} MXN al {mes|año}**, IVA incluido.
> Solo se te cobrará si lo aceptas. Si no, conservas {plan} hasta el {fecha_fin_periodo} y después pasas a Gratis, sin cobro.
> [Acepto el nuevo precio] · [No, gracias] · [Cancelar mi plan]

Registrar `price_change_notice_sent`, `price_change_accepted` (texto exacto, monto anterior y nuevo, fecha) o `price_change_declined`. Sin `price_change_accepted`, el cobro de renovación no puede usar el monto nuevo.

### 4.2. Pro Lealtad: tarjeta, checkout, consentimiento y avisos

Razonamiento legal y pruebas: `PRICING-2026-10-03-REVISION.md`, sección R. Nombre del plan: **Pro Lealtad** (dueño, 3-oct 09:50).

**Tarjeta / panel de precios (todo visible antes de pagar, sin desplegar nada):**
> **Pro Lealtad** · Se renueva cada mes · Sin prueba gratis
> **$1,662 MXN el primer mes.** Cada mes que sigues pagando, tu precio baja 10% del precio del mes 1, hasta **$664 MXN al mes desde el mes 7** (60% menos).
> Mes 1: $1,662 · Mes 2: $1,495 · Mes 3: $1,329 · Mes 4: $1,163 · Mes 5: $997 · Mes 6: $831 · Mes 7 en adelante: $664 MXN al mes. IVA incluido; montos redondeados hacia abajo al peso.
> Del mes 1 al 4 pagas más que en Pro mensual ($997); desde el mes 6 pagas menos. En el primer año, Pro anual ($9,970) es lo más barato.
> **Se cobra hoy $1,662 MXN.** Después se cobra automáticamente cada mes el monto del calendario, hasta que canceles.
> ⓘ **Tu precio vuelve a $1,662 si** cancelas (al terminar tu mes pagado), cambias a otro plan o un pago queda sin cubrir 7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician.

Reglas de diseño:
- Las barras muestran el **mes** y el **monto**. La etiqueta de % dice "10% menos que el mes 1", no "−10%" a secas.
- **Quitar "Precio regular" del mes 1** (mockups 86 y 88): es el primer escalón de este plan, no el precio normal de Pro.
- La regla de reinicio va junto al botón, con el mismo tamaño de letra que el resto del bloque (≥14 px), no en un acordeón.

**Checkout (bloque junto al botón, con fechas reales):**
> **Hoy, {fecha_hoy}, se cobran $1,662 MXN** a tu tarjeta terminación **{ultimos4}** (mes 1 de Pro Lealtad).
> Después, cada mes, automáticamente y hasta que canceles:
> {fecha_2}: $1,495 · {fecha_3}: $1,329 · {fecha_4}: $1,163 · {fecha_5}: $997 · {fecha_6}: $831 · desde {fecha_7}: $664 MXN cada mes.
> Te avisamos por correo 7 días antes de cada cobro, con su monto.
> Si cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar, tu precio vuelve a empezar en $1,662.
> Cancela en 1 clic desde **Mi cuenta → Mi plan**; conservas Pro hasta el final del mes pagado.

Ejemplo de fechas, si se contrata el 3 de octubre de 2026: 3 de noviembre de 2026 · 3 de diciembre de 2026 · 3 de enero de 2027 · 3 de febrero de 2027 · 3 de marzo de 2027 · desde el 3 de abril de 2027. Si el día no existe en un mes, se cobra el último día de ese mes (Términos de Suscripción 3.2).

**Casilla (obligatoria, desmarcada):**
> ☐ Acepto que Chalyb cobre **hoy $1,662 MXN** a mi tarjeta y después, **automáticamente cada mes**, $1,495, $1,329, $1,163, $997 y $831 MXN, y luego **$664 MXN al mes** mientras siga suscrito, hasta que cancele. Entiendo que **mi precio vuelve a empezar en $1,662** si cancelo, cambio de plan o un pago queda sin cubrir 7 días después de fallar, y acepto los [Términos de Suscripción](/suscripcion).

- Botón (deshabilitado hasta marcar): **Pagar $1,662 y empezar Pro Lealtad**
- Desde Pro mensual o Pro anual, en la pantalla de confirmación: "Pro Lealtad empieza en el mes 1 ($1,662) al terminar tu periodo actual; tus meses en otro plan no cuentan."

**Mi plan (mockup 87):** mantener el aviso "Si cancelas o cambias de plan, pierdes tu descuento…" y añadir: "Un reembolso o contracargo no lo reinicia."

**Cambiar de plan:** cada fila de "Cambiar de plan" muestra "Tu precio vuelve a empezar en $1,662", y la pantalla de confirmación lo repite con el monto: "Si vuelves a Pro Lealtad, empezarás en $1,662."

**Cancelación:** una sola línea informativa, sin pasos extra y con [Sí, cancelar] visible:
> Sigues con Pro hasta el {fecha_fin}. No habrá más cobros. Si vuelves después, Pro Lealtad empieza otra vez en $1,662. [OPCIONAL: "Si vuelves antes del {fecha_fin + 30 días}, retomas tu mes {n}."]

**Correo de confirmación (inmediato; incluye todo lo anterior):**
- **Asunto:** Tu Pro Lealtad empezó: tu calendario de cobros
- **Cuerpo:**
> Hola {nombre}: hoy, {fecha_hoy}, cobramos **$1,662 MXN** (IVA incluido) a tu tarjeta ••{ultimos4} por el mes 1.
> Tu calendario: {tabla fecha → monto, mes 2 a 7+}.
> Tu precio vuelve a empezar en $1,662 si cancelas, cambias de plan o un pago queda sin cubrir 7 días después de fallar. Cambiar de tarjeta, un reembolso o un contracargo no lo reinician.
> Te avisaremos 7 días antes de cada cobro. Cancela en 1 clic: [Mi plan].
> Folio de tu aceptación: {consent_id} · [Términos de Suscripción v{version_sus}]

**Aviso antes de cada cobro (obligatorio; 7 días antes; regla de entrega de 2.7 bis):**
- **Asunto:** El {fecha_cobro} se cobran ${monto} MXN de tu Pro Lealtad (mes {n})
- **Cuerpo:**
> Hola {nombre}: el **{fecha_cobro}** cobraremos **${monto} MXN** (IVA incluido) a tu tarjeta ••{ultimos4} por el **mes {n}** de Pro Lealtad, {pct}% menos que tu mes 1. El mes pasado pagaste ${monto_anterior}.
> {si n < 7:} Después: {siguientes montos}, y desde el mes 7, $664 MXN al mes. {si n ≥ 7:} Ya estás en tu precio más bajo: $664 MXN al mes mientras sigas.
> Si cancelas o cambias de plan, tu precio vuelve a empezar en $1,662.
> ¿No quieres seguir? [Cancelar en 1 clic] antes del {fecha_cobro} y no se te cobra.
> [Ver mi plan]

**Pago fallido (día 0 y día 5 del periodo de gracia):**
- **Asunto:** No pudimos cobrar tu Pro Lealtad: tienes hasta el {fecha_limite} para conservar tu precio
- **Cuerpo:**
> Hola {nombre}: el cobro de ${monto} MXN del {fecha} no pasó. Actualiza tu tarjeta antes del **{fecha_limite}** (7 días) y conservas tu mes {n} del calendario. Si no se cubre, tu suscripción termina y, si vuelves, empiezas en $1,662. [Actualizar tarjeta]

## 5. Cancelación (1 clic + 1 confirmación)

**Mi cuenta → Mi plan:** botón visible **Cancelar prueba** / **Cancelar suscripción** (no escondido, no en "más opciones").

**Pantalla de confirmación:**
> **¿Cancelar tu {prueba|suscripción}?**
> Seguirás teniendo {plan} hasta el **{fecha_fin_acceso}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados.
> [Sí, cancelar] · [Seguir con {plan}]

(Opcional, una sola vez y saltable: "¿Prefieres pagar mes a mes? [Cambiar a $997 MXN al mes]". Si se muestra la oferta, el botón **[Sí, cancelar]** debe seguir visible en la misma pantalla y con el mismo peso visual.)

**Hecho:**
> **Listo, cancelaste.** No se te volverá a cobrar. Tienes {plan} hasta el {fecha_fin_acceso}. Folio: {folio_cancelacion}. Te enviamos la confirmación a {correo}.

**Correo:** "Confirmamos tu cancelación (folio {folio_cancelacion}) el {fecha_hora_cancelacion}. Tu acceso de pago termina el {fecha_fin_acceso}. No habrá más cobros."

## 6. Aviso de riesgo: Señales, Pronósticos, Inversiones (primera activación)

**Modal (bloquea la herramienta hasta aceptar, una vez por herramienta y por versión):**

> **Antes de empezar**
> {Herramienta} da **información general** generada con IA, igual para todos los usuarios de tu plan. **No es asesoría financiera, de inversión ni de apuestas**, no es una recomendación personal para ti y no toma en cuenta tus saldos, posiciones ni objetivos. No garantizamos resultados y **puedes perder todo tu dinero**. Chalyb no es asesor en inversiones registrado ante la CNBV, ni casa de bolsa, exchange o casa de apuestas.
> [Leer aviso completo](/uso-aceptable#avisos)
> ☐ Entiendo y acepto que las decisiones y los riesgos son míos.
> [Entendido, continuar]

## 7. Conectar cuentas y datos financieros

**Conectar red social (antes de OAuth):**
> Vas a conectar tu cuenta de {plataforma}. Chalyb podrá ver tus videos y **publicar solo cuando tú lo indiques** o actives la publicación automática. No vemos tu contraseña. Puedes desconectarla cuando quieras.
> [Conectar {plataforma}]

**Activar publicación automática:**
> ☐ Entiendo que Chalyb publicará clips en **{cuenta}** según las reglas que configuré y que **soy responsable** de lo que se publique.
> [Activar publicación automática]

**Conectar exchange o bróker (datos patrimoniales; consentimiento expreso LFPDPPP):**
> Para conectar {exchange}, Chalyb tratará tus claves de API y datos de tu cuenta (saldos, posiciones, operaciones) solo para mostrártelos y ejecutar las reglas que tú configures, como explica el [Aviso de Privacidad](/privacidad). Recomendamos claves **solo de lectura** (y de operación solo si usarás automatizaciones). **Rechazamos claves con permiso de retiro.**
> ☐ Doy mi consentimiento expreso para que Chalyb trate estos datos financieros.
> [Conectar]

**Activar una automatización (Inversiones):** la regla la escribe el usuario (activo, condición, monto máximo, horario). Antes de activarla:
> Esta automatización enviará órdenes a tu cuenta de {exchange} **solo según la regla que tú definiste**: {resumen_regla}. Chalyb no elige activos, montos ni momentos por ti. Puedes pausarla cuando quieras.
> ☐ Revisé la regla y acepto que las órdenes y sus riesgos son míos.
> [Activar]

**Prohibido sin validación de abogado/CNBV:** botones tipo "Copiar esta señal automáticamente", carteras modelo que se ejecuten solas, o recomendaciones generadas a partir de los saldos, posiciones o perfil de riesgo del usuario (ver REVISION-LEGAL.md, hallazgo C1).

## 8. Cambios a los Términos (re-aceptación)

**Cambio relevante** (afecta derechos, pagos o datos): avisar por correo **≥30 días antes** (Quebec exige 30 días para modificaciones unilaterales) y, al entrar después de la fecha de vigencia, mostrar modal:

> **Actualizamos nuestros Términos**
> A partir del **{fecha_vigencia}** cambian algunos puntos:
> • {cambio_1_en_una_línea}
> • {cambio_2_en_una_línea}
> • {cambio_3_en_una_línea}
> [Ver todos los cambios](/terminos/cambios/{version})
> Si no estás de acuerdo, puedes cancelar tu plan sin costo.
> [Aceptar y continuar] · [No acepto, ver opciones]

- "No acepto, ver opciones" → pantalla con: cancelar suscripción sin penalización, solicitar reembolso proporcional (si plan anual y el cambio lo perjudica), descargar contenido, cerrar cuenta.
- Mientras no acepte: no se le aplica la nueva versión a ningún cobro; se le puede limitar el uso de funciones nuevas, pero **no** bloquear la cancelación ni la descarga de su contenido.
- **Cambio menor** (redacción, nuevas funciones sin perjuicio): banner no bloqueante "Actualizamos los Términos. [Ver cambios]" + registro del evento `terms_notice_shown`.

## 9. Banner de cookies

> Usamos cookies necesarias para que Chalyb funcione y, si aceptas, cookies de analítica y publicidad para mejorar y medir campañas. [Aceptar todas] [Solo necesarias] [Configurar]

Analítica y publicidad **desactivadas** hasta que el usuario acepte.

## 10. Especificación del registro de evidencia (consent log)

### 10.1. Qué eventos se registran

`signup_terms_accepted`, `marketing_opt_in`, `marketing_opt_out`, `trial_started` (con consentimiento de cobro), `subscription_started`, `plan_changed`, `charge_notice_sent`, `charge_succeeded`, `charge_failed`, `renewal_notice_sent`, `annual_reminder_sent`, `notice_bounced`, `price_change_notice_sent`, `price_change_accepted`, `price_change_declined`, `lealtad_started` (con el calendario y las fechas mostradas), `lealtad_step_notice_sent`, `lealtad_step_advanced`, `lealtad_reset` (con su causa: `cancel`, `plan_change`, `unpaid_after_grace`), `retention_offer_shown`, `automation_rule_activated`, `terms_reaccepted`, `terms_notice_shown`, `risk_ack_accepted`, `financial_data_consent`, `autopublish_enabled`, `cancellation_requested`, `refund_issued` (con motivo: `legal_7_2_a` … `legal_7_2_i`), `chargeback_opened`, `chargeback_triaged`, `chargeback_evidence_submitted`, `chargeback_resolved`, `chargeback_notice_sent`, `chargeback_response_received`, `chargeback_bad_faith_decided`, `account_restricted`, `account_closed`, `prepayment_required`, `arco_request_received`.

### 10.2. Campos obligatorios

| Campo | Tipo | Ejemplo / nota |
|---|---|---|
| `consent_id` | UUID | Folio que se muestra al usuario |
| `event_type` | texto | `trial_started` |
| `user_id` | UUID | Id interno |
| `account_email_hash` | texto | SHA-256 del correo en el momento del evento (el correo en claro vive en la tabla de usuarios) |
| `documents` | lista | `[{"doc":"terminos","version":"1.3","url":"https://chalyb.com/terminos/v1-3","sha256":"…"}, {"doc":"suscripcion",…}, {"doc":"privacidad",…}]` |
| `timestamp_utc` | ISO 8601 UTC | `2026-10-04T02:51:07.412Z` (hora del servidor, no del cliente) |
| `client_timezone` | texto | `America/Mexico_City` |
| `ip_address` | texto | IPv4/IPv6 completa (dato personal: acceso restringido) |
| `user_agent` | texto | Cadena completa del navegador |
| `locale` | texto | `es-MX` |
| `surface` | texto | `web_checkout_trial`, `ios_web`, `modal_reacceptance` |
| `ui_version` | texto | Versión del frontend / id del experimento A/B |
| `disclosure_text` | texto | **Texto exacto renderizado** que vio el usuario (con variables ya sustituidas) |
| `disclosure_sha256` | texto | Hash del texto anterior |
| `checkbox_text` | texto | Texto exacto de la casilla marcada (o `null` si fue botón) |
| `checkbox_checked` | booleano | `true` |
| `button_label` | texto | `Empezar mis 7 días gratis` |
| `plan_id` | texto | `pro_annual` |
| `amount_mxn` | decimal | `9970.00` (en USD usar `amount` + `currency`) |
| `currency` | texto | `MXN` |
| `tax_included` | booleano | `true` |
| `billing_interval` | texto | `year` / `month` |
| `trial_end_utc` | ISO 8601 | Fecha y hora exacta de fin de prueba |
| `charge_date_utc` | ISO 8601 | Fecha del primer cobro |
| `reminder_date_utc` | ISO 8601 | Fecha del aviso de cobro (prueba de 7 días: igual al inicio) |
| `payment_method` | objeto | `{"processor":"mercadopago","brand":"visa","last4":"4821","mp_customer_id":"…","mp_preapproval_id":"…"}` (**nunca** número completo ni CVV) |
| `marketing_opt_in` | booleano | `false` por defecto |
| `screenshot_ref` | texto | Opcional: id de captura del componente renderizado |
| `prev_event_hash` | texto | Hash del evento anterior (cadena a prueba de alteraciones) |
| `event_hash` | texto | SHA-256 de todo el registro |

### 10.3. Ejemplo (JSON)

```json
{
  "consent_id": "8f3c2a1e-6b7d-4f0a-9e21-2c5d7a9b1f44",
  "event_type": "trial_started",
  "user_id": "u_01J9ZK…",
  "documents": [
    {"doc": "terminos", "version": "1.0", "url": "https://chalyb.com/terminos/v1-0", "sha256": "…"},
    {"doc": "suscripcion", "version": "1.0", "url": "https://chalyb.com/suscripcion/v1-0", "sha256": "…"},
    {"doc": "privacidad", "version": "1.0", "url": "https://chalyb.com/privacidad/v1-0", "sha256": "…"}
  ],
  "timestamp_utc": "2026-10-04T02:51:07.412Z",
  "client_timezone": "America/Mexico_City",
  "ip_address": "201.141.xx.xx",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) …",
  "surface": "web_checkout_trial",
  "disclosure_text": "Hoy pagas $0. Tu prueba gratis de 7 días termina el 10 de octubre de 2026. Si no cancelas antes, el 10 de octubre de 2026 se cobrarán $9,970 MXN por 1 año de Pro …",
  "checkbox_text": "Acepto que, si no cancelo antes del 10 de octubre de 2026, Chalyb cobre automáticamente $9,970 MXN y cada año después a mi tarjeta, y acepto los Términos de Suscripción.",
  "checkbox_checked": true,
  "button_label": "Empezar mis 7 días gratis",
  "plan_id": "pro_annual",
  "amount_mxn": 9970.00,
  "currency": "MXN",
  "tax_included": true,
  "billing_interval": "year",
  "trial_end_utc": "2026-10-11T02:51:07Z",
  "charge_date_utc": "2026-10-11T02:51:07Z",
  "reminder_date_utc": "2026-10-04T02:51:07Z",
  "payment_method": {"processor": "mercadopago", "brand": "visa", "last4": "4821", "mp_preapproval_id": "…"},
  "marketing_opt_in": false,
  "prev_event_hash": "…",
  "event_hash": "…"
}
```

### 10.4. Reglas técnicas

1. **Solo agregar (append-only):** sin UPDATE ni DELETE desde la aplicación; correcciones como eventos nuevos. Respaldo diario en almacenamiento inmutable (bloqueo de objetos/WORM).
2. **Hora del servidor** sincronizada (NTP) y en UTC; mostrar al usuario en su zona.
3. **Archivar cada versión** de cada documento (HTML + PDF + hash) y de cada plantilla de bloque de cobro y de correo.
4. **NOM-151-SCFI-2016 (recomendado):** obtener una **constancia de conservación** de un Prestador de Servicios de Certificación acreditado para los eventos de cobro (`trial_started`, `subscription_started`, `price_change_accepted`, `terms_reaccepted`), o al menos un sellado diario del lote de hashes. Fortalece el valor probatorio de los mensajes de datos conforme al Código de Comercio.
5. **Conservación:** al menos **10 años** para evidencia de contratos y cobros (arts. 38 y 49 del Código de Comercio; también cubre el mínimo de California: 3 años o 1 año después de terminado el contrato, lo que sea mayor, B&P §17602(a)(6)); acceso restringido a soporte/legal; tratamiento descrito en el Aviso de Privacidad (finalidad primaria 7). **Excepción:** marcas de incumplimiento (contracargos, abuso de prueba, adeudos) se eliminan a los 72 meses (art. 10 LFPDPPP).
6. **Privacidad:** IP y user agent son datos personales; cifrar en reposo; no usarlos para marketing.

### 10.5. Disputas y contracargos de Mercado Pago: qué hacer y qué presentar

Política (Términos de Suscripción §7 y §10): no hay reembolsos salvo los que exige la ley; una disputa por sí sola nunca suspende, bloquea ni cambia el precio; solo un **contracargo de mala fe** permite medidas, siempre después del aviso con **10 días hábiles**. La casilla, los avisos y el registro de consentimiento se conservan precisamente para responder estas disputas.

**Paso 1: triage (antes de responder a Mercado Pago).** Revisar si el cargo es un caso de Términos de Suscripción §7.2:
- no autorizado o sin consentimiento registrado;
- sin aviso previo entregado con ≥5 días;
- posterior a una cancelación;
- duplicado, por error o por un monto distinto al informado o al calendario de Pro Lealtad;
- servicio no prestado o con fallas graves atribuibles a Chalyb.

Si lo es: **no impugnar**, aceptar la disputa o reembolsar, registrar `refund_issued` (motivo `legal_7_2_x`) y cerrar sin ninguna medida. Si el usuario ya recuperó el dinero por el banco, no volver a cobrar.

**Paso 2: si el cargo fue autorizado y el servicio se usó, responder con este paquete (PDF generado automáticamente):**
1. **Consentimiento:** registro `trial_started` / `subscription_started` / `lealtad_started` / `price_change_accepted`, con:
   - texto exacto del bloque de cobro y de la casilla;
   - `checkbox_checked: true`, fecha y hora UTC, IP, dispositivo;
   - versión y hash de los Términos;
   - `consent_id`, `event_hash` y, si existe, la constancia NOM-151.
2. **Captura del componente** de cobro tal como se veía en esa `ui_version`.
3. **Avisos:** el aviso de cobro (prueba) y el aviso de renovación o de mes de Pro Lealtad correspondientes a ese cargo, con `message_id`, fecha de envío, estado **entregado** y el monto que decía.
4. **Comprobante del cargo:** id de pago de Mercado Pago, `mp_preapproval_id`, monto, fecha y CFDI si se emitió.
5. **Cancelación:** prueba de que no hubo solicitud de cancelación antes del cargo (o su fecha, si la hubo), y de que el botón "Cancelar" estaba disponible (Términos de Suscripción §6.1).
6. **Uso:** inicios de sesión y uso de herramientas en el periodo cobrado (fechas, número de clips o consultas), sin contenido privado.
7. **Políticas:** enlaces a los Términos de Suscripción (cancelación, reembolsos) en la versión aceptada.

**Qué evidencia corresponde a cada motivo de disputa:**
- **"No reconozco el cargo / no autorizado":** 1, 2, 4 y 6, más coincidencia del correo y de la tarjeta (marca y últimos 4) con la cuenta. Si hay señales de tarjeta robada, **no impugnar**: es caso §7.2(a).
- **"Suscripción cancelada":** 5 y 3. Si sí canceló antes del cargo, reembolsar (§7.2(c)).
- **"No recibí el servicio":** 6, más el estado del servicio (sin incidentes atribuibles a Chalyb en ese periodo). Si hubo una falla grave, aplicar §7.2(e).
- **"Monto incorrecto":** 1 (monto o calendario aceptado), 3 (monto avisado) y 4. Si el monto difiere, devolver el excedente (§7.2(d)).

**Reglas:**
- Enviar solo los datos necesarios para la disputa (Aviso de Privacidad, finalidad 7). Nunca enviar el número completo de la tarjeta.
- Responder dentro del plazo que fije Mercado Pago en la notificación de la disputa [plazo de Mercado Pago: VERIFICAR en su documentación].
- **Durante la disputa no se cambia nada en la cuenta:** ni acceso, ni plan, ni precio, ni `loyalty_step`.

**Paso 3: solo si se cumple Términos de Suscripción §10.4 (mala fe).** Enviar el aviso de 10 días hábiles y esperar el plazo antes de cualquier medida.
- **Asunto:** Aviso sobre el contracargo del cargo de ${monto} MXN del {fecha}
- **Cuerpo:**
> Hola {nombre}: disputaste ante tu banco el cargo de **${monto} MXN** del **{fecha}** por {plan}. Según nuestros registros, lo autorizaste el {fecha_consentimiento} (folio {consent_id}), te enviamos el aviso de cobro el {fecha_aviso} y usaste Chalyb en ese periodo ({resumen_uso}).
> {si se resolvió a tu favor:} El monto de ${monto} MXN está pendiente de pago.
> Tienes **10 días hábiles, hasta el {fecha_limite}**, para: **(1)** [pagar el monto pendiente], o **(2)** [responder] y explicarnos por qué el cargo no te correspondía (por ejemplo, si no lo autorizaste).
> Si no pagas ni respondes en ese plazo, podríamos {medida: suspender las funciones de pago de tu cuenta hasta que se pague / cerrar tu cuenta}, y para volver a contratar un plan de pago te pediríamos el pago por adelantado, sin prueba gratis. Siempre podrás descargar tu contenido.
> Pedir un reembolso o disputar un cargo no autorizado nunca tiene consecuencias. Si crees que esto es un error, responde a este correo.

**Paso 4: decisión escrita** con motivos, registrada como `chargeback_bad_faith_decided`, con la medida aplicada o "sin medida".

**Eventos a registrar:**
- `chargeback_opened` y `chargeback_triaged`, con el resultado: `legal_refund` o `contest`;
- `chargeback_evidence_submitted`, con el hash del PDF;
- `chargeback_resolved` (`won` / `lost`);
- `chargeback_notice_sent`, con `deadline_utc`;
- `chargeback_response_received`;
- `chargeback_bad_faith_decided`;
- `account_restricted` / `account_closed`;
- `prepayment_required`.

## 11. Lista de verificación antes de publicar

- [ ] Prueba de **7 días** solo en Pro mensual y Pro anual (VIP sin prueba); aviso de cobro enviado **el día 0** (7 días antes; mínimo legal 5); renovaciones mensuales 7 días antes; anuales 30 y 7 días antes; recordatorio anual para planes mensuales.
- [ ] Aviso obligatorio no entregado a más tardar 5 días antes del cobro → no se cobra hasta 5 días después de notificar por otro medio (confirmar que Mercado Pago permite posponer el primer cobro de la preaprobación).
- [ ] Casilla de consentimiento de cobro desmarcada y obligatoria (también en `trial-to-paid-path.md`).
- [ ] Monto total con IVA visible junto a la tarjeta ($9,970 al año, no un equivalente mensual). USD: impuestos y moneda mostrados antes de pagar. **IVA confirmado por contador.**
- [ ] Razón social, domicilio, teléfono y correo visibles antes de pagar.
- [ ] Botón "Cancelar" visible en Mi cuenta → Mi plan; flujo de 1 confirmación; correo con folio; oferta de retención siempre con botón de cancelar visible.
- [ ] Aumento de precio a suscriptores actuales ($749→$997, $2,499→$3,799): aviso exactamente 30 días antes + aceptación expresa; sin aceptación no se cobra el nuevo precio.
- [ ] Precio tachado ($1,662 / US$84): solo con la evidencia de `PRICING-2026-10-03-REVISION.md` (Q2) y con la leyenda del sitio y la fecha.
- [ ] Pro Lealtad: calendario completo, cobro de hoy, renovación mensual y regla de reinicio visibles antes de pagar; casilla 4.2; sin "Precio regular" en el mes 1; aviso de 7 días con el monto de cada mes; reembolsos y contracargos **no** reinician el calendario; todo reinicio es una suscripción nueva con consentimiento nuevo.
- [ ] Reembolsos: solo los casos legales de Términos de Suscripción §7.2; un reembolso nunca genera penalización, bloqueo ni reinicio de precio. Contracargos: triage §10.5 (no impugnar casos legales), ningún cambio en la cuenta durante la disputa, medidas solo por mala fe y tras el aviso de 10 días hábiles.
- [ ] Marketing desmarcado; baja en 1 clic en cada correo.
- [ ] Documentos versionados con URL fija y hash.
- [ ] Registro de evidencia append-only en producción y probado con un contracargo simulado.
- [ ] Modal de riesgo en Señales, Pronósticos e Inversiones.
- [ ] Inversiones: solo reglas definidas por el usuario; sin copiado automático de señales; claves con permiso de retiro rechazadas.
- [ ] Pronósticos: sin apuestas, concursos con premio ni sorteos; enlaces solo a operadores con permiso SEGOB.
- [ ] Aviso y retirada: formulario, medidas contra re-subida (huellas/hashes), política de reincidencia publicada.
- [ ] Quebec: versión en francés antes de vender, o bloqueo de planes de pago para residentes de Quebec.
- [ ] Revisión de un abogado mexicano (y, para EE. UU./Canadá, abogado local: leyes estatales de renovación automática). Ver `REVISION-LEGAL.md`.
