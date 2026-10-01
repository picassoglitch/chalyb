# Aceptación en el producto (UX, microcopy y registro de evidencia)

**Versión:** [VERSIÓN] · **Fecha:** [FECHA] · Documento interno para producto, diseño e ingeniería. No se publica.

> **Resumen en palabras simples**
>
> - Aceptar debe ser **fácil, claro y comprobable**: una línea al crear la cuenta, una casilla al activar la prueba o pagar, y una ventana cuando cambian los Términos.
> - Antes de pedir la tarjeta mostramos **"Hoy pagas $0"**, la **fecha** y el **monto exacto** del primer cobro y **cómo cancelar en 1 clic**.
> - Las promociones por correo van en una **casilla aparte y desmarcada**.
> - Guardamos un **registro de evidencia** de cada aceptación (quién, qué versión, cuándo, desde dónde y qué texto vio) para defendernos en contracargos y quejas.
> - **Cambio obligatorio frente al plan original:** el recordatorio previo al cobro debe enviarse **al menos 5 días naturales antes** (art. 76 Bis, fr. VIII, LFPC; reforma DOF 12-dic-2025, vigente desde el 13-dic-2025 — **verificado** en el texto publicado). Usamos **7 días antes** (día 23 de la prueba) para el fin de prueba **y también para las renovaciones mensuales**, no 3 ni 5.
> - **Aumentos de precio:** solo con aceptación expresa; aviso exactamente 30 días antes. Sin aceptación, no se renueva.

---

## 1. Principios (estilo App Store / Google Play, pero claro)

1. **Clickwrap, no browsewrap.** La aceptación siempre ocurre con una acción del usuario (botón o casilla) junto a enlaces visibles a los documentos. Nunca "al navegar aceptas".
2. **Consentimiento expreso para cobros recurrentes.** El artículo 76 Bis, fracción VIII, de la LFPC (reforma DOF 12-dic-2025) exige informar de forma **clara, destacada y accesible** si hay cobros automáticos recurrentes, su **periodicidad, monto y fecha de cobro**, y obtener **consentimiento expreso e informado**. Por eso usamos una **casilla obligatoria desmarcada** junto al bloque de cobro (la opción más defendible). Ver 3.4 para la alternativa "botón como aceptación".
3. **Precio total.** Siempre en MXN con IVA incluido (art. 7 Bis LFPC), de forma notoria y visible. Cerca de la tarjeta se muestra el **total real** ($7,490), nunca solo "$624/mes". **Bloqueante:** confirmar con contador que los precios ya incluyen IVA; si no, el precio visible debe ser el total con IVA.
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

**Título:** Prueba Pro gratis 1 mes
**Subtítulo:** Todas las herramientas incluidas. Cancela cuando quieras.

**Pregunta:** ¿Qué plan quieres cuando termine tu mes gratis?

- ◉ **Pro anual — $7,490 MXN al año** (equivale a $624/mes) · Ahorras $1,498 al año · *Recomendado*
- ○ **Pro mensual — $749 MXN al mes**

> Nota de diseño: el plan anual aparece preseleccionado, pero en la opción seleccionada el monto principal visible es **$7,490 MXN al año**, no $624. El usuario puede cambiar a mensual con 1 toque. El bloque de cobro (3.2) se actualiza en vivo según la opción. **No usar "2 meses gratis"** junto a una prueba de "1 mes gratis": confunde sobre cuánto dura la prueba (riesgo de publicidad engañosa, art. 32 LFPC). Si se usa precio tachado, rotularlo: "$8,988 si pagas 12 meses de Pro mensual".

### 3.2. Bloque de cobro (aparece junto al botón, siempre visible)

**Plantilla:**

> **Hoy pagas $0.**
> Tu mes gratis termina el **{fecha_fin_prueba}**.
> Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** {periodicidad} a tu tarjeta terminación **{ultimos4}**, y se renovará automáticamente {renovacion} hasta que canceles.
> Te avisaremos por correo el **{fecha_recordatorio}** (7 días antes).
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el {fecha_fin_prueba} y no se te cobra nada.

Variables:
- `{periodicidad}`: anual → "por 1 año de Pro" · mensual → "por tu primer mes de Pro"
- `{renovacion}`: anual → "cada año ($7,490 MXN)" · mensual → "cada mes ($749 MXN)"
- `{ultimos4}`: si aún no hay tarjeta en esta pantalla, usar "a la tarjeta que registres" y mostrar los 4 dígitos en la pantalla de confirmación.

**Ejemplo renderizado (anual, prueba iniciada el 30 de septiembre de 2026):**

> **Hoy pagas $0.**
> Tu mes gratis termina el **30 de octubre de 2026**.
> Si no cancelas antes, el **30 de octubre de 2026** se cobrarán **$7,490 MXN** por 1 año de Pro a tu tarjeta terminación **4821**, y se renovará automáticamente cada año ($7,490 MXN) hasta que canceles.
> Te avisaremos por correo el **23 de octubre de 2026** (7 días antes).
> Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el 30 de octubre de 2026 y no se te cobra nada.

### 3.3. Casilla de consentimiento (obligatoria, desmarcada) y botón

> ☐ Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {renovacion_corta} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion).

- `{renovacion_corta}`: anual → "y cada año después" · mensual → "y cada mes después"
- Botón (deshabilitado hasta marcar la casilla): **Empezar mi mes gratis**
- Si el usuario intenta continuar sin marcar: "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."

### 3.4. Alternativa "botón como aceptación" (solo si el abogado la aprueba)

Sin casilla; el botón dice **Empezar mi mes gratis y aceptar el cobro automático** y debajo:

> Al tocar el botón aceptas el cobro automático descrito arriba y los [Términos de Suscripción](/suscripcion).

Es más fluida, pero la casilla genera **mejor evidencia de consentimiento expreso** para contracargos y PROFECO. Recomendación: casilla.

### 3.5. Pantalla de tarjeta (Mercado Pago)

Encima del formulario (Brick de Mercado Pago), repetir en 1 línea:

> Hoy pagas **$0**. Primer cobro: **${monto} MXN** el **{fecha_cobro}**, salvo que canceles antes.

Debajo del formulario: "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta."

### 3.6. Confirmación (pantalla + correo de confirmación)

**Pantalla:**
> **¡Listo, {nombre}! Tu mes de Pro gratis ya empezó.**
> Termina el {fecha_fin_prueba}. Primer cobro: **${monto} MXN** el {fecha_cobro} a tu tarjeta ••{ultimos4}.
> [Hacer mis primeros clips] · [Ver mi plan]

**Correo de confirmación (enviar de inmediato; es evidencia):**
- Asunto: **Tu mes de Pro gratis ya empezó: esto es lo que debes saber**
- Cuerpo:
> Hola {nombre}:
> Tu prueba gratis de Chalyb Pro empezó el {fecha_inicio} y termina el {fecha_fin_prueba}.
> **Hoy pagaste $0.** Si no cancelas antes, el **{fecha_cobro}** cobraremos **${monto} MXN** ({plan}) a tu tarjeta ••{ultimos4}, y después **{renovacion}** hasta que canceles.
> Te avisaremos el {fecha_recordatorio}.
> **Cancelar es 1 clic:** [Cancelar mi prueba] (Mi cuenta → Mi plan).
> Documentos que aceptaste: [Términos y Condiciones v{version_tyc}] · [Términos de Suscripción v{version_sus}] · [Aviso de Privacidad v{version_priv}].
> Folio de tu aceptación: {consent_id}

## 4. Recordatorios y avisos de cobro

| Momento | Canal | Asunto / texto |
|---|---|---|
| **7 días antes** del fin de la prueba (día 23) — **obligatorio (≥5 días naturales, art. 76 Bis fr. VIII LFPC; también cumple Quebec: 2–10 días)** | Correo + banner | **Tu prueba gratis termina el {fecha_fin_prueba}** · "El {fecha_cobro} se cobrarán ${monto} MXN a tu tarjeta ••{ultimos4} por {plan}. ¿Prefieres pagar mes a mes? [Cambiar a $749/mes] · ¿No quieres seguir? [Cancelar en 1 clic]" |
| 1 día antes (recomendado) | Correo + banner ámbar | **Mañana termina tu prueba gratis** · "Mañana, {fecha_cobro}, se cobrarán ${monto} MXN. [Ver mi plan] · [Cancelar]" |
| Día del cobro | Correo | **Recibimos tu pago de ${monto} MXN** · comprobante, plan, próxima renovación, enlace a cancelar y a factura |
| Renovación anual: 30 días antes | Correo | **Tu plan Pro anual se renueva el {fecha_renovacion}** · monto, fecha, [Cambiar a mensual] · [Cancelar renovación] |
| Renovación mensual: **7 días antes** — **obligatorio (≥5 días)** | Correo + banner | **Tu plan {plan} se renueva el {fecha_renovacion} por ${monto} MXN** · [Ver mi plan] · [Cancelar] |
| Recordatorio anual para planes mensuales (una vez al año) | Correo | **Resumen anual de tu suscripción** · plan, monto, periodicidad, próxima fecha de cobro, [Cancelar] (California B&P §17602(h), lectura conservadora) |
| Cambio de precio: **exactamente 30 días antes** (ni menos de 30 por Quebec, ni más de 30 por California) | Correo + modal | **Cambia el precio de tu plan a partir del {fecha}** · precio anterior, nuevo, [Acepto el nuevo precio] · [Cancelar sin costo]. **Sin aceptación expresa no se renueva** al nuevo precio; enviar recordatorio 7 días antes de la fecha. |

Guardar evidencia de envío de cada aviso: `message_id` del proveedor de correo, plantilla y versión, fecha y hora UTC, estado de entrega (entregado/rebotado). Si el aviso obligatorio rebota o no se envía, mostrar banner en la app, intentar otro medio y **no cobrar hasta que hayan pasado al menos 5 días naturales desde una notificación efectiva** (regla obligatoria, recogida en la sección 2.7 bis de los Términos de Suscripción). Un cobro sin aviso previo es reembolsable (Términos de Suscripción 7.3).

## 5. Cancelación (1 clic + 1 confirmación)

**Mi cuenta → Mi plan:** botón visible **Cancelar prueba** / **Cancelar suscripción** (no escondido, no en "más opciones").

**Pantalla de confirmación:**
> **¿Cancelar tu {prueba|suscripción}?**
> Seguirás teniendo {plan} hasta el **{fecha_fin_acceso}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados.
> [Sí, cancelar] · [Seguir con {plan}]

(Opcional, una sola vez y saltable: "¿Prefieres pagar mes a mes? [Cambiar a $749/mes]". Si se muestra la oferta, el botón **[Sí, cancelar]** debe seguir visible en la misma pantalla y con el mismo peso visual.)

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

`signup_terms_accepted`, `marketing_opt_in`, `marketing_opt_out`, `trial_started` (con consentimiento de cobro), `subscription_started`, `plan_changed`, `charge_notice_sent`, `charge_succeeded`, `charge_failed`, `renewal_notice_sent`, `annual_reminder_sent`, `notice_bounced`, `price_change_notice_sent`, `price_change_accepted`, `price_change_declined`, `retention_offer_shown`, `automation_rule_activated`, `terms_reaccepted`, `terms_notice_shown`, `risk_ack_accepted`, `financial_data_consent`, `autopublish_enabled`, `cancellation_requested`, `refund_issued`, `arco_request_received`.

### 10.2. Campos obligatorios

| Campo | Tipo | Ejemplo / nota |
|---|---|---|
| `consent_id` | UUID | Folio que se muestra al usuario |
| `event_type` | texto | `trial_started` |
| `user_id` | UUID | Id interno |
| `account_email_hash` | texto | SHA-256 del correo en el momento del evento (el correo en claro vive en la tabla de usuarios) |
| `documents` | lista | `[{"doc":"terminos","version":"1.3","url":"https://chalyb.com/terminos/v1-3","sha256":"…"}, {"doc":"suscripcion",…}, {"doc":"privacidad",…}]` |
| `timestamp_utc` | ISO 8601 UTC | `2026-10-01T02:51:07.412Z` (hora del servidor, no del cliente) |
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
| `button_label` | texto | `Empezar mi mes gratis` |
| `plan_id` | texto | `pro_annual` |
| `amount_mxn` | decimal | `7490.00` |
| `currency` | texto | `MXN` |
| `tax_included` | booleano | `true` |
| `billing_interval` | texto | `year` / `month` |
| `trial_end_utc` | ISO 8601 | Fecha y hora exacta de fin de prueba |
| `charge_date_utc` | ISO 8601 | Fecha del primer cobro |
| `reminder_date_utc` | ISO 8601 | Fecha programada del aviso |
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
  "timestamp_utc": "2026-10-01T02:51:07.412Z",
  "client_timezone": "America/Mexico_City",
  "ip_address": "201.141.xx.xx",
  "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) …",
  "surface": "web_checkout_trial",
  "disclosure_text": "Hoy pagas $0. Tu mes gratis termina el 30 de octubre de 2026. Si no cancelas antes, el 30 de octubre de 2026 se cobrarán $7,490 MXN por 1 año de Pro …",
  "checkbox_text": "Acepto que, si no cancelo antes del 30 de octubre de 2026, Chalyb cobre automáticamente $7,490 MXN y cada año después a mi tarjeta, y acepto los Términos de Suscripción.",
  "checkbox_checked": true,
  "button_label": "Empezar mi mes gratis",
  "plan_id": "pro_annual",
  "amount_mxn": 7490.00,
  "currency": "MXN",
  "tax_included": true,
  "billing_interval": "year",
  "trial_end_utc": "2026-10-31T02:51:07Z",
  "charge_date_utc": "2026-10-31T02:51:07Z",
  "reminder_date_utc": "2026-10-23T15:00:00Z",
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

### 10.5. Paquete de evidencia para contracargos (Mercado Pago)

Para cada disputa, generar automáticamente un PDF con:
1. Registro `trial_started` / `subscription_started` (texto exacto, casilla, fecha/hora, IP, dispositivo, versión de Términos).
2. Captura del componente de cobro tal como se veía en esa versión de UI.
3. Correo de confirmación y **aviso previo al cobro** (con `message_id` y estado "entregado").
4. Historial de uso de la cuenta después del cobro (inicios de sesión, clips generados).
5. Ausencia de solicitud de cancelación antes del cobro (o fecha de cancelación, si la hubo).
6. Enlace a Términos de Suscripción y política de cancelación y reembolsos vigentes.

## 11. Lista de verificación antes de publicar

- [ ] Recordatorio previo al cobro configurado a **7 días** (mínimo legal 5) para fin de prueba **y renovaciones mensuales**; aviso de renovación anual a 30 días; recordatorio anual para planes mensuales.
- [ ] Rebote de aviso obligatorio → no se cobra hasta notificar por otro medio (≥5 días).
- [ ] Casilla de consentimiento de cobro desmarcada y obligatoria (también en `trial-to-paid-path.md`).
- [ ] Monto total con IVA visible junto a la tarjeta; nunca solo "$624/mes". **IVA confirmado por contador.**
- [ ] Razón social, domicilio, teléfono y correo visibles antes de pagar.
- [ ] Botón "Cancelar" visible en Mi cuenta → Mi plan; flujo de 1 confirmación; correo con folio; oferta de retención siempre con botón de cancelar visible.
- [ ] Aumento de precio: aviso exactamente 30 días antes + aceptación expresa; sin aceptación no se renueva.
- [ ] Marketing desmarcado; baja en 1 clic en cada correo.
- [ ] Documentos versionados con URL fija y hash.
- [ ] Registro de evidencia append-only en producción y probado con un contracargo simulado.
- [ ] Modal de riesgo en Señales, Pronósticos e Inversiones.
- [ ] Inversiones: solo reglas definidas por el usuario; sin copiado automático de señales; claves con permiso de retiro rechazadas.
- [ ] Pronósticos: sin apuestas, concursos con premio ni sorteos; enlaces solo a operadores con permiso SEGOB.
- [ ] Aviso y retirada: formulario, medidas contra re-subida (huellas/hashes), política de reincidencia publicada.
- [ ] Quebec: versión en francés antes de vender, o bloqueo de planes de pago para residentes de Quebec.
- [ ] Revisión de un abogado mexicano (y, para EE. UU./Canadá, abogado local: leyes estatales de renovación automática). Ver `REVISION-LEGAL.md`.
