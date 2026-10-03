# Chalyb · FIX-3: 3 páginas que siguen en el estilo viejo → sistema de diseño nuevo (prompt para Claude Code)

> **Páginas:** `/app/subscription` (Mi plan) · `/app/usage` (Mis créditos) · `/app/settings/perfil` (Mi perfil).
> **Mockups (nuevos, 1440×900 @2x, Inter):** `mockups/70-mi-plan-gratis.png` · `71-mi-plan-pro.png` · `72-creditos.png` · `72b-creditos-comprar.png` · `73-perfil.png` · `74-estados-fix3.png` (tablero de estados). HTML de referencia en `html/70-…74-*.html`.
> **Regenerar:** `python3 build_fix3.py && python3 render_fix3.py` (o `python3 render_fix3.py 72` para una sola). No toca `build.py`, `build_tools.py`, ni los mockups 00–62.
> **Manda:** `legal/aceptacion-ux.md` en lo legal · `BUILD-SPEC.md` en tokens, glosario (§3) y reglas (§0, §11) · `TOOLS-SPEC.md` en herramientas. Este documento solo agrega lo de estas 3 pantallas.
> **Código revisado para escribir esto:** clon local `/workspace/chalyb-p5` @ `c163dfd` (2 oct 2026, `main` de `picassoglitch/chalyb`). **Antes de empezar, verifica contra `main` actual**; si un nombre de archivo cambió, busca el equivalente y avisa en el PR.
> **Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Los mockups 70/71/74 ya usan los montos finales (Pro $997/mes, Pro anual $9,970, VIP $3,799; totales con IVA) y la prueba de 7 días (Pro mensual y anual). **En código nunca se escriben a mano.** Los paquetes de créditos (72b: $172.84 / $694.84 / $2,318.84) **no** están en PRICING-CARDS-SPEC y siguen como lista × 1.16 hasta que el dueño decida.

---

## 0. Qué está mal hoy y por qué se ve viejo

1. Las 3 rutas caen en el modo **`legacy`** de `src/components/app/shell-routes.ts` (no están en el set `MODERN`), así que `AppShell` las pinta dentro de `.cc-shell.ch-legacy`: **el panel negro redondeado** con el tema oscuro `cc-*` de `dashboard.css` (micro-etiquetas en mayúsculas, `--cc-mono`, ámbar `--cc-green`/`--cc-amber`, bordes finos, inputs oscuros, texto de 10–13 px con bajo contraste).
2. Las páginas usan clases `cc-mod-*` + estilos en línea. Nada de eso se reusa: se reemplaza por los componentes nuevos que ya usan Inicio, Mis resultados, Mi cuenta (`/app/settings`), Mi plan (`/app/billing`), Herramientas, Ayuda y Avisos.
3. Además del estilo hay **fallas funcionales** que este fix arregla (detalle en cada página): textos de desarrollo visibles ("motor de telemetry en el paso 05"), contadores que no son reales, interruptores que solo se guardan en el navegador y que nada lee, un interruptor de 2FA que no hace nada, el idioma que muestra "English" a una cuenta en español, y el bug conocido de **guardar idioma → te saca de la sesión**.

### 0.1 Cómo se arregla (orden de trabajo)
1. **Un PR por página** (A, B, C) + un PR chico de base (0.2). Cada PR trae sus pruebas (§4).
2. En cada PR: agregar la ruta a `MODERN` en `shell-routes.ts` (y su prueba unitaria), borrar el JSX `cc-*` de la página y armarla **solo** con los componentes existentes.
3. **No crear estilos nuevos.** Si falta algo, primero buscar en `src/components/ui/primitives.tsx`, `src/components/ui/*`, `src/styles/chalyb-tokens.css` y las páginas limpias (`/app/billing`, `/app/settings`, `/app/clips/formato`). Si de verdad no existe, se agrega **una** clase `ch-*` en `chalyb-tokens.css` con los tokens de abajo y se justifica en el PR.

### 0.2 Componentes y tokens a reusar (ya existen)
| Necesidad | Usar | Dónde está |
|---|---|---|
| Página dentro del shell | modo `modern` de `AppShell` (`.ch-content` + `.ch-wrap` 1040 px) | `components/app/app-shell.tsx`, `shell-routes.ts` |
| Migaja + título | `<p class="ch-muted">` "Mi cuenta ›" (link a `/app/settings`) + `h1.ch-h1` (40 px/700) | igual que `/app/billing` |
| Tarjeta "Tu plan" (degradado) | `.ch-plan`, `.ch-plan__k`, `.ch-plan__h`, `.ch-plan__foot`, `.ch-plan__all` | `/app/billing`, `/app/settings` |
| Tarjeta blanca | `Card` (`.ch-card`, radio `--r` 22 px, `--shadow`) | `primitives.tsx` |
| Lista iOS agrupada | `Group` (`.ch-group`, título `.ch-ghead`) + `Row` (`.ch-row`, ícono de color, título, `detail`, valor, chevron) | `primitives.tsx` |
| Botones | `Button` / `ButtonLink` `variant` primary · secondary · gray · dark · danger · ok · white, `size` xl · compact | `primitives.tsx` |
| Pills | `Pill kind` ok · acc · warn · bad · gray · dark | `primitives.tsx` |
| Banner de 1 línea | `Banner kind` trial · warn · gray · bad (+ `selectBanner()` para prioridad) | `primitives.tsx`, `lib/billing/banner.ts` |
| Bloque de cobro | `DisclosureBlock` (`.ch-disc`) | `primitives.tsx` |
| Vacío / error | `StateBlock` (`.ch-state`) | `primitives.tsx` |
| Cargando | `Skeleton` (`.ch-skel`) | `primitives.tsx` |
| Inputs | `Field` (`.ch-field` + `.ch-input`, 62 px, radio 16, foco con halo acento) · `.ch-select` | `components/ui/field.tsx`, `chalyb-tokens.css` |
| Interruptor | `Switch` (`role="switch"`, 56×34, `aria-checked`) | `components/ui/switch.tsx` |
| Hoja / modal | `Sheet` (radio 28) | `components/ui/sheet.tsx` |
| Opciones avanzadas | `<details class="ch-card ch-adv">` + `.ch-adv__body` (cerrado por defecto, recuerda estado por usuario) | `/app/clips/formato/page.tsx` |
| Aviso flotante | `showToast()` del store → `.ch-toast` (fondo `--ink`, 17 px, abajo al centro) | `lib/workspace/store.ts`, `app-shell.tsx` |
| Avatar | `Avatar` (iniciales con degradado; `large`) | `primitives.tsx` |
| Cancelar | `CancelSheet` | `components/app/billing/cancel-sheet.tsx` |
| Fechas y dinero | `formatFechaLarga()`, `formatFechaCorta()`, `formatMXN()` | `lib/billing/format.ts` |
| Precios | `planPrice('pro_month'\|'pro_year'\|'vip_month')`, `annualMath()`, `packPriceCents(id)`, `planHasTrial()`, `PRICING.trial`, `TOKEN_PACKS` | `config/pricing.ts`, `lib/payments/pricing.ts` |
| Plan y permisos | `getEntitlements(session)`, `loadBilling(userId)`, `proIncludesAllTools()`, `trialFlowEnabled()`, `cfdiEnabled()` | `lib/billing/*`, `lib/config/flags.ts` |

**Tokens (CSS vars de `.chalyb-app`):** `--bg #F5F5F7` · `--card #FFF` · `--ink #1D1D1F` · `--ink2 #5E5E66` · **`--ink3-text #6C6C74` (todo texto secundario; `--ink3` solo íconos/divisores)** · `--line #E6E6EB` · `--accent #5B4BFF` · `--tint #EFEDFF` · `--tint2 #F6F5FF` · **`--ok-text #167A3E` (texto verde; `--ok` solo íconos/fondos)** · `--warn #A65A00` / `--warn-tint` / `--warn-line` · `--bad #D70015` / `--bad-tint` / `--bad-line` · `--plan-grad` · `--shadow`, `--shadow-lg` · `--r 22px`.

**Mayúsculas permitidas (únicas):** `.ch-ghead` (15 px/600, `--ink3-text`, encabezado de grupo iOS) y `.ch-plan__k` ("Tu plan · Activo", 15 px sobre degradado, opacidad 1). Nada más en mayúsculas, nada de menos de 16 px salvo esos dos y las pills (16 px en estas pantallas).

---

## A. `/app/subscription` → **Mi plan** · mockups **70** (Gratis), **71** (Pro pagado), **74** §3

### A.1 Ruta
- **Se queda `/app/subscription`** (no se borra): es el `back_url` de Mercado Pago (`?status=…`, la sincronización `syncSubscription()` del render se conserva tal cual), el destino de "Método de pago" en Mi cuenta y el respaldo de `changeHref()` cuando `trialFlowEnabled()` es falso.
- **Una sola implementación de "Mi plan"**: extraer el contenido de `/app/billing/page.tsx` a un componente de servidor `MiPlanView` y agregarle el estado **Gratis** (mockup 70). Entonces:
  - Gratis (no admin) → `/app/subscription` y `/app/billing` muestran **70**.
  - Pro mensual / Pro anual / VIP / prueba / cancelado / pago pendiente → `/app/subscription` hace la sincronización de `?status` y luego `redirect('/app/billing')` (307, conserva `status` para mostrar el aviso "Listo, tu plan ya está activo."). `/app/billing` ya cubre esos 6 estados con la copia de BUILD-SPEC §6.10 (mockup 71 = Pro mensual, consistente con 30).
- Migaja "Mi cuenta ›" → `/app/settings`. Ítem activo de la barra lateral: **Mi cuenta** (ya lo resuelve `activeNavFor`).
- `metadata.title` = `myplan.title` "Mi plan" (hoy dice "Suscripción").

### A.2 Inventario de la pantalla vieja → nuevo (nada funcional se pierde)
Incluye lo que el código muestra en otros estados (admin, cancelado, pago fallido, pendiente, pagos sin configurar), aunque no salga en la captura.

| # | Elemento viejo (texto exacto) | Nuevo componente · copia | Nota |
|---|---|---|---|
| 1 | Franja de 4 KPI `cc-mod-statgrid` | **Se quita** como franja. Cada dato se mueve (filas 2–5) | Era la "tira de diagnóstico": mono, mayúsculas, ámbar |
| 2 | PLAN ACTUAL · **Free** · "Sin cargo · sin tarjeta" | Tarjeta `Card` "Tu plan" (70): `.ch-ghead`-estilo "Tu plan" · `h2` "Gratis" · "**$0** Sin tarjeta · Para siempre" (`myplan.heading.free`, `myplan.freeBody`) | "Free" → "Gratis" (glosario) |
| 3 | RENOVACIÓN · — · "Free nunca vence" / "se cobra solo cada mes" / "cancelado · después pasas a Free" / "cobro fallido · revisa tu tarjeta en Mercado Pago" / "esperando que autorices el cobro" / "sin renovación automática" | Gratis: no aplica (el "Para siempre" de la fila 2 lo dice). Pagado: grupo "Próximo cobro" de `/app/billing` (fecha larga + monto + "Aviso por correo 7 días antes"). Cancelado: "No habrá más cobros." Pago fallido: estado "Pago pendiente" + `Banner bad`. Pendiente: `Banner gray` "Estamos esperando que Mercado Pago confirme tu tarjeta. Esto tarda unos minutos." | Fechas siempre con `formatFechaLarga` (hoy usa `day:'2-digit', month:'short'`) |
| 4 | MÉTODO DE PAGO · — · "En Free no necesitas tarjeta" / "Mercado Pago · suscripción mensual con tarjeta" / "Pago único · sin suscripción activa" | `Row` "Método de pago" · valor "Sin tarjeta" · detalle "No la necesitas" (Gratis) · pagado: "Visa ••4821" · "Vence 08/29" + `myplan.methodChange` | "Pago único" (compras viejas sin suscripción): ver decisión **D-F3-9** |
| 5 | ENGINES EN VIVO · **0** · "solo en modo prueba" / "tú eliges cuáles" / "todos los engines" | **Se quita.** Lo que importa al cliente ya está en "Lo que Pro te agrega" ("Todas las herramientas") | "engines", "modo prueba" están prohibidos (BUILD-SPEC §0.3, §3). Con `proIncludesAllTools()=true` (default) el dato además es falso |
| 6 | Etiqueta "● CAMBIA TU PLAN" | Gratis: tarjeta de oferta (70). Pagado: grupo "Cambiar de plan" de `/app/billing` | |
| 7 | Tarjeta FREE · badge "TU PLAN" · "$0 /siempre" · "Crea tu cuenta y prueba toda la plataforma gratis." · ✓ "Clips incluido" · "50,000 créditos de regalo" · "Acceso a la comunidad" · "Clips con marca de agua · descarga manual" · botón deshabilitado "Plan actual" | Tarjeta "Tu plan · Gratis" con lista: "Clips con marca de agua" · "{creditos} créditos cada mes" · "Descargas tus clips a mano" · "Acceso a la comunidad". **Sin** botón "Plan actual" (la tarjeta ya dice que es tu plan) | "de regalo" contradice "al mes" de `/app/usage` (TIER_CAPS.FREE renueva cada mes) → se usa "cada mes". La frase "prueba toda la plataforma gratis" es falsa en Gratis → se quita |
| 8 | (pantalla vieja, montos viejos) Tarjeta PRO · badge "EL MÁS ELEGIDO" · "$868.84 MXN /mes" · "Usa la herramienta que quieras." · ✓ "Todo lo de Free" · "1 herramienta incluida · tú eliges cuál" · "1,000,000 de créditos al mes (se renuevan)" · "Clips sin marca de agua · ~12 streams al mes · 1 logo" · "Comunidad premium" · botón "Cambiar a Pro" | Tarjeta de oferta (70, `Card` con anillo acento como `.ch-task--first`): `Pill acc` "Incluido en Pro · Pruébalo gratis" · `h2` "Prueba Pro gratis 1 mes" · "Con el plan anual. Cancela cuando quieras." · "Lo que Pro te agrega" (2 columnas): "Todas las herramientas" · "{creditos} créditos al mes" · "Clips sin marca de agua" · "Tu logo en tus clips" · "Publica en tus redes" · "Comunidad premium" · bloque de precio · `btn-xl` "Prueba Pro gratis 1 mes" | "1 herramienta · tú eliges" **contradice** `proIncludesAllTools()` y toda la copia nueva → se quita (decisión **D-F3-1**). "EL MÁS ELEGIDO" es una afirmación sin dato → se quita (o "Recomendado", como en Planes). "~12 streams al mes" (`clipStreamsPerMonth`) → a "Opciones avanzadas · Límites de tu plan". Lista sale de `TIER_CAPS`/entitlements, no escrita a mano |
| 9 | (pantalla vieja, montos viejos) Tarjeta VIP · "$2,898.84 MXN /mes" · "Todas las herramientas, con los límites más altos." · ✓ "Todo lo de Pro" · "Todas las herramientas incluidas" · "5 veces los créditos de Pro (5,000,000 al mes)" · "Clips completo para streamers" · "Soporte prioritario · el equipo Chalyb te ayuda a construir tu idea" · botón "Cambiar a VIP" | Grupo "Otros planes" → `Row` ícono estrella `#AF52DE` "VIP" · detalle "Más créditos y ayuda prioritaria" · valor acento "{monto} al mes" · chevron → flujo VIP (A.5) | "te ayuda a construir tu idea" depende de las bases del programa (BUILD-SPEC D7) → no se promete aquí. "Clips completo" no se entiende → se quita. "Chalyb" solo como logo |
| 10 | (Partner, solo por invitación) tarjeta PARTNER | Sin cambio funcional: si el usuario es PARTNER, "Tu plan" dice "Socio" con la misma estructura de Pro. Sin tarjeta de venta | Verificar que `MiPlanView` no rompa con `tier='PARTNER'` |
| 11 | Botones "Procesando…", "Bajar a Free", "Cambiar a {plan}" | Pagado: filas de "Cambiar de plan" de `/app/billing` ("Pasar a Pro anual", "Subir a VIP", "Pasar a Gratis") con su paso de confirmación | "Bajar a Free" → "Pasar a Gratis" |
| 12 | "Cancelar suscripción" / "Cancelar plan" / "Ya cancelado" (1 clic, sin confirmación, texto de 12.5 px) | `Row` roja "Cancelar suscripción" · "1 clic, sin llamadas. Sigues con {plan} hasta el {fecha}." → `CancelSheet` (2 clics, mockup 18) | Siempre visible mientras haya cobros futuros (§11.3) |
| 13 | Etiqueta "● USO ESTE PERIODO · FREE" + 4 barras "Trabajos IA · este mes 0 / 100 trabajos 0%", "Tokens IA · este mes 0 / 50,000 tokens 0%", "Almacenamiento 0 / 500 MB 0%", "Engines en vivo 0 / 0 engine en vivo · solo simulación 0%" | En Mi plan queda **una** fila "Créditos de este mes" (número grande + barra + "Usaste {usados} de {total}" + link "Ver mis créditos ›" → `/app/usage`). Trabajos y espacio → `/app/usage` "Opciones avanzadas · Límites de tu plan". "Engines en vivo" → se quita | Los números salen de `getTokenBalance()` (real). Hoy `buildQuotaRows` muestra `used=0` fijo (no son contadores reales) → **prohibido mostrar un contador que no es real** |
| 14 | Nota mono "▸ Los contadores reales se conectan al motor de telemetry en el paso 05." | **Se quita** | Texto de desarrollo filtrado a clientes |
| 15 | Aviso admin "● Modo {rol} — tu rol manda sobre el plan guardado… `profiles.tier`…" y "▸ Modo admin — los cambios de plan se aplican al instante" | `Banner gray` "Eres administrador: tienes todo incluido, sin importar el plan." (74 §3). Las herramientas de admin ("plan guardado", cambiar plan sin pago para probar) van en `details.ch-adv` "Opciones avanzadas · Solo administradores" | Nunca `profiles.tier` ni nombres de columnas en la UI |
| 16 | Aviso "Pagos aún no disponibles" / admin "Mercado Pago no está configurado… `{VAR}` en Vercel…" | Cliente: `StateBlock` en lugar del bloque de precio: "Por ahora no podemos recibir pagos. Inténtalo en unas horas o habla con una persona." + [Hablar con una persona] (verde). Admin: mismo texto + lista de variables faltantes **dentro de Opciones avanzadas** | No mostrar el botón de prueba si no hay cómo pagar (nunca un botón sin acción) |
| 17 | Error "▸ No pudimos abrir el pago" + ✕ | `Banner bad` "No pudimos abrir el pago. Intenta otra vez en un momento." + [Intentar otra vez] | |
| 18 | Barra lateral, campana, tarjeta de usuario "Plan Gratis" | Sin cambios (ya es el `AppShell` nuevo) | |

### A.3 Diseño · estado Gratis (mockup 70)
Dos columnas (`.ch-acct`, izquierda 440 px, derecha flexible, gap 26):
- **Izquierda:** tarjeta "Tu plan · Gratis" → grupo "Tu cuenta Gratis" (`Row` créditos con barra · `Row` Método de pago "Sin tarjeta" · `Row` Facturas "Ninguna aún") → grupo "Otros planes" (`Row` VIP).
- **Derecha:** tarjeta de oferta, **única acción principal** de la pantalla (`btn-xl` 68 px).
- Bloque de precio dentro de la oferta (`.ch-disc` sobre `--tint2`): izquierda "Hoy pagas **$0**"; derecha "Después de tus 7 días" · **"{monto_mensual} MXN al mes"** (28 px/750, es el cobro real del plan que se preselecciona) · "Se renueva cada mes" · "o Pro anual: {monto_anual} MXN al año" + `Pill` "Ahorras {ahorro} al año · {pct}%". Debajo del botón "Empezar mis 7 días gratis": "Hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Cancela en 1 clic desde Mi plan, sin llamadas. Precios en MXN, IVA incluido." y "Eliges mensual o anual en el siguiente paso. VIP no tiene prueba."
- **La prueba de 7 días existe en Pro mensual y Pro anual** (`planHasTrial()` → `pro_month` y `pro_year`; PRICING-CARDS-SPEC §16.1). Se muestra el mensual como número grande porque el checkout **nunca preselecciona el anual** (§16.2). Montos: **Precios: ver PRICING-CARDS-SPEC.md (fuente única).**

### A.4 Copia exacta (llaves i18n; reusar las que ya existen)
| Llave | Texto |
|---|---|
| `myplan.title` (existe) | Mi plan |
| `myplan.crumb` (existe) | Mi cuenta |
| `myplan.status.free` (existe) | Tu plan |
| `myplan.heading.free` (existe) | Gratis |
| `myplan.freeBody` (existe) | Sin tarjeta · Para siempre |
| `freeplan.f.watermark` | Clips con marca de agua |
| `freeplan.f.credits` | {creditos} créditos cada mes |
| `freeplan.f.manual` | Descargas tus clips a mano |
| `freeplan.f.community` | Acceso a la comunidad |
| `freeplan.group` | Tu cuenta Gratis |
| `myplan.credits` (existe) | Créditos de este mes |
| `freeplan.credits.used` | Usaste {usados} de {total} |
| `freeplan.credits.link` | Ver mis créditos › |
| `myplan.method` (existe) | Método de pago |
| `freeplan.method.value` / `.sub` | Sin tarjeta / No la necesitas |
| `myplan.invoices` / `myplan.invoicesEmpty` (existen) | Facturas / Ninguna aún |
| `freeplan.other` | Otros planes |
| `freeplan.vip.title` / `.sub` / `.value` | VIP / Más créditos y ayuda prioritaria / {monto} al mes |
| `freeplan.offer.pill` | Incluido en Pro · Pruébalo gratis |
| `plans.pro.cta` (existe) | Empezar mis 7 días gratis |
| `freeplan.offer.title` | Prueba Pro gratis 7 días |
| `freeplan.offer.sub` | Mensual o anual. Cancela en 1 clic, sin llamadas. |
| `freeplan.offer.adds` | Lo que Pro te agrega |
| `freeplan.add.tools` | Todas las herramientas *(solo si `proIncludesAllTools()`; si no: "Tu plan Pro incluye {tools}." de la llave existente `included.single` en `messages/es.json`)* |
| `freeplan.add.credits` | {creditos} créditos al mes |
| `freeplan.add.noWatermark` / `.logo` / `.publish` / `.community` | Clips sin marca de agua / Tu logo en tus clips / Publica en tus redes / Comunidad premium |
| `freeplan.price.today` | Hoy pagas |
| `freeplan.price.after` | Después de tus 7 días |
| `price.pro.month.big` | {monto} MXN al mes |
| `freeplan.price.renew` | Se renueva cada mes |
| `freeplan.price.yearAlt` | o Pro anual: {monto_anual} MXN al año |
| `price.save.year` | Ahorras {ahorro} al año · {pct}% |
| `freeplan.legal` | Hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Cancela en 1 clic desde Mi plan, sin llamadas. Precios en MXN, IVA incluido. |
| `freeplan.choiceNote` | Eliges mensual o anual en el siguiente paso. VIP no tiene prueba. |
| `freeplan.used.title` (74 §3) | Elige tu plan Pro |
| `freeplan.used.today` | Hoy se cobran |
| `freeplan.used.renew` | Se renueva cada mes hasta que canceles. O {monto_anual} MXN al año. |
| `plans.pro.ctaNoTrial` (existe) | Elegir Pro |
| `banner.ended` / `plans.pro.ctaReturn` (existen) | Tu prueba terminó. Estás en el plan Gratis. / Volver a Pro |
| `freeplan.admin` | Eres administrador: tienes todo incluido, sin importar el plan. |
| `freeplan.payDown` | Por ahora no podemos recibir pagos. Inténtalo en unas horas o habla con una persona. |
| `freeplan.payError` | No pudimos abrir el pago. Intenta otra vez en un momento. |
| `freeplan.activated` (toast al volver de MP) | Listo, tu plan ya está activo. |

`{monto_*}`, `{ahorro}`, `{pct}` = `formatMXN(planPrice(...).totalCents)` y `annualMath()` (porcentaje redondeado hacia abajo). Precios: ver PRICING-CARDS-SPEC.md (fuente única). `{creditos}` = ver decisión **D-F3-2**.

### A.5 Botones, destinos y estados
| Botón | Destino |
|---|---|
| "Empezar mis 7 días gratis" | `trialFlowEnabled()` y la cuenta no usó su prueba → `/app/prueba` (paso 2 de 3, con **Pro mensual** preseleccionado; nunca el anual) · si no hay flujo de prueba → `/app/subscription/checkout?tier=PRO` y el botón dice "Elegir Pro" |
| Fila VIP | `trialFlowEnabled()` → `/app/billing/cambiar?plan=vip_month` · si no → `/app/subscription/checkout?tier=VIP` (con `ConfirmStep` + casilla de cobro recurrente, §11.2) |
| "Ver mis créditos ›" | `/app/usage` |

Estados: **cargando** (`Skeleton` de tarjeta + 3 filas; nunca girador de página completa) · **error al leer el plan** (`StateBlock` gris "No pudimos cargar tu plan." + [Intentar otra vez]) · **prueba ya usada** (74 §3: título "Elige tu plan Pro", "Hoy se cobran {monto} MXN al mes", sin la palabra "gratis") · **prueba terminada** (`Banner gray` + "Volver a Pro") · **pagos no configurados** (fila 16) · **volviendo de MP** (`?status=success` → toast `freeplan.activated`; `?status=failure` → `Banner bad` fila 17) · **admin** (fila 15).
Pagado (71): exactamente `/app/billing` + **`Banner warn` de renovación 7 días antes de cada cobro** (`banner.renew` "Tu plan {plan} se renueva el **{fecha}** por **{monto} MXN**."). En la propia página de Mi plan el banner va **sin botón** (ya estás en el destino) y agrega "Si quieres cambiar o cancelar, hazlo antes de esa fecha."

### A.6 Legal (BUILD-SPEC §6.2, §11)
- **Precios: ver PRICING-CARDS-SPEC.md (fuente única).** El número grande siempre es **el cobro real con su periodicidad** ("$997 MXN al mes", "$9,970 MXN al año"). Nunca "equivale", nunca "mes gratis", nunca "2 meses gratis", nunca "$X/mes" como número grande para el anual.
- "Precios en MXN, IVA incluido." visible en la oferta. Todo monto de `PRICING`; ningún número en JSX ni en `messages/*.json`.
- Junto al botón: el aviso de cobro sale **hoy** (día 0) por correo; cancelar en 1 clic. En pagado, "Cancelar suscripción" visible en la misma pantalla que cualquier oferta (cambio de plan).
- Subir a VIP = cobro hoy → `ConfirmStep` con monto + periodicidad + casilla desmarcada (§11.2). El servidor valida.

---

## B. `/app/usage` → **Mis créditos** · mockups **72**, **72b**, **74** §2

### B.1 Ruta
- **Se queda `/app/usage`** (y `/app/usage/checkout?pack=…` sin cambios de lógica). Agregar `/app/usage` a `MODERN`. Migaja "Mi cuenta ›". `metadata.title` "Mis créditos" (hoy "Uso").
- La fila "Créditos disponibles" de Mi cuenta y "Ver mis créditos ›" de Mi plan llevan aquí.

### B.2 Inventario viejo → nuevo
| # | Elemento viejo | Nuevo | Nota |
|---|---|---|---|
| 1 | Franja de 4 KPI (`cc-mod-statgrid`) | **Se quita** (era la tira técnica). Datos re-ubicados abajo | |
| 2 | PERIODO · "octubre de 2026" · "se renueva el 1° del próximo mes" | En la tarjeta grande: fila con ícono `refresh`: "Se renuevan el **{fecha_larga}**. Vuelves a tener {asignacion}." (`{fecha}` = día 1 del mes siguiente, `formatFechaLarga`) | Los créditos renuevan el día 1 (calendario), no en la fecha de cobro (ver **D-F3-3**) |
| 3 | BALANCE DISPONIBLE · **50,000** · "de 50,000 tokens este mes" | Tarjeta `Card` grande: "Te quedan" · **"{remaining} créditos"** (60 px/750) · barra 14 px · "Usaste {monthlyUsed} de {asignacion} este mes" | `getTokenBalance()`; "tokens" → "créditos" |
| 4 | TOKENS BONUS · 0 · "aún no compras tokens extra" / "tokens extra comprados · no caducan" | Fila con ícono `plus`: "Créditos extra comprados: **{bonus}**. Se usan después de los de tu plan." | "no caducan" → ver **D-F3-4** (choca con Términos de Suscripción §9.3) |
| 5 | PLAN · **FREE** · "incluye 50,000 tokens al mes" / "sin límite por tu rol" | Gratis/Pro/VIP: ya lo dice la fila 2 ("Vuelves a tener {asignacion}"); el nombre del plan está en la barra lateral. Admin (`unlimited`): la tarjeta dice "Sin límite de créditos" + "Eres administrador." | `tier.replace('_','-')` crudo ("FREE") → nunca |
| 6 | "● CONSUMO DEL MES" · "0 usados · 50,000 te quedan" · barra · "0.0% gastado" (mono) | Es la barra de la fila 3. **El % se quita de la vista** y pasa a Opciones avanzadas | |
| 7 | Aviso mono ámbar "▸ Ya casi llegas a tu límite. Compra tokens extra…" (>80 %) | `Banner warn` arriba: "Te queda poco: **{pct}%** de tus créditos. Se renuevan el {fecha}." + [Conseguir más] (74 §2) | Umbral igual (≥ 80 % usado) |
| 8 | "● COMPRAR TOKENS EXTRA" + párrafo "Los tokens que compras **nunca caducan** y se usan **después** de los tokens que ya trae tu plan cada mes. Sirven en todas tus herramientas. Comprar tokens **no cambia tu plan**: tus límites y tu fecha de renovación siguen igual — eso se gestiona en [Suscripción]." | Botón `btn-primary` (60 px, ancho completo) **"Conseguir más créditos"** en la tarjeta grande → abre `Sheet` 72b. El párrafo se reparte: subtítulo de la hoja "Se suman a los que ya tienes. Tu plan y tu fecha de cobro no cambian." + nota "Es un **pago único**, no una suscripción. Los créditos extra se usan después de los de tu plan y {vigencia}. Precios en MXN, IVA incluido." | "Suscripción" → "Mi plan". "Sirven en todas tus herramientas": verificar que es cierto antes de decirlo |
| 9 | 3 tarjetas de paquete: "+100k tokens" "$172.84 MXN, IVA INCLUIDO" "Top-up rápido · alcanza para varios trabajos pequeños" "100,000 tokens ≈ $1.73 MXN/1k tokens" [Comprar +100k tokens →] · "+500k" "$694.84" "Mejor relación · ~30% descuento por token vs el pack chico" "≈ $1.39 MXN/1k" · "+2M" "$2,318.84" "Mejor relación · pensado para usuarios PRO con uso pesado" "≈ $1.16 MXN/1k" | En la hoja: 3 opciones tipo radio (84 px, radio 20, seleccionada con anillo acento): "**{n} créditos**" + frase · derecha "**{monto} MXN**" + "Pago único". Frases: "Para unos cuantos clips más" / "Cada crédito te sale más barato" / "El más barato por crédito, para uso diario". Botón `btn-xl` **"Continuar al pago · {monto} MXN"** → `/app/usage/checkout?pack={id}` · "Ahora no" cierra. Precio por 1,000 → Opciones avanzadas | **"~30% descuento" es falso para el de 500k** (con los precios actuales es 19.6 %; el ~33 % es del de 2M) y "Mejor relación" se repite en 2 paquetes → se quitan; si se quiere un %, se **calcula** de `packPriceCents`. Preseleccionado: el de en medio |
| 10 | Banner "● Pago recibido — tus tokens se suman a tu balance en cuanto Mercado Pago confirma (de segundos a minutos). Esta página se actualiza sola." (`?payment=success`) | `Banner trial` "**Pago recibido.** Tus créditos se suman en unos minutos." (74 §2); refresco automático igual | |
| 11 | "● ROYALTIES · TUS ENGINES" (solo socios): explicación, filas por engine "cerrado/acumulando", "{n} tokens este mes · rate `$X/1M`", "$ MXN este periodo", `<details>` "Historial de pagos (n)" con estado y `ref` | Solo si hay datos: grupo "Tus ganancias como socio" con `Row` por herramienta: título = nombre de la herramienta · detalle "Este mes · se paga al cerrar el mes" / "Pagado el {fecha}" · valor "{monto} MXN". **Tarifa por millón, tokens atribuidos, `ref` y estados crudos (`paid`/`cancelled`) → Opciones avanzadas** | Ver **D-F3-7** (¿esto vive aquí o en el panel?) |
| 12 | "● ACTIVIDAD RECIENTE" vacía: "Todavía no registras consumo este mes." / mono "Tu actividad aparece aquí en cuanto uses una herramienta." | `StateBlock` (74 §2): "Aún no usas tus créditos" · "Cuando hagas tu primer clip, aquí verás en qué se usaron." · [Hacer mi primer clip] → `/app/clips` | |
| 13 | Actividad con datos: fila por run "{engine} `{operation}` `{n} llamadas`" · "{fecha} · LLM tokens · Storage · Publish" · "{n} tokens · run"; fila por evento "{engine} `{kind}`" · "{n} {unidad}" | Dos grupos nuevos: **"En qué los usaste este mes"** (una `Row` por herramienta con su `ToolIcon` y color: título = herramienta, detalle en palabras: "Hiciste {n} clips" / "Te mandamos {n} avisos" / "Manejaste {n} transmisiones" / genérico "Lo usaste {n} veces", valor = créditos) y **"Historial"** (`Row`: título = el resultado si existe — "6 clips de “Noche de preguntas”" — o "{Herramienta}"; detalle "{Herramienta} · {fecha relativa en palabras}"; valor "−{creditos}"; renovación del día 1 y compras de paquetes como "+{n}" en acento) + "Ver todo" | `operation`, `llamadas`, `kind`, `units`, "run", ids → **Opciones avanzadas · Detalle técnico** (lista `Group`/`Row` o `<table>` simple con clases `ch-*` existentes: fecha, herramienta, operación, tipo, cantidad; no existe un `DataTable` compartido, no crear uno nuevo). Nombres con `engineDisplayName()` → nunca "chalybclip", "engine" |
| 14 | Tira de diagnóstico admin (mono ámbar) "▸ Algunos datos se mostraron con valores por defecto ({warnings}). … revisa los logs de Vercel — busca por el prefijo `[/app/usage]`." | Cliente: `StateBlock` "No pudimos cargar tus créditos" · "Tus créditos están bien; solo no pudimos mostrarlos ahora." · [Intentar otra vez] (74 §2). Admin: lo mismo + los `warnings` y la pista de logs **dentro de Opciones avanzadas** (`details` abierto si hay warnings) | Nunca mostrar números por defecto como si fueran reales: si `warnings` afecta al saldo, no se pinta el número |
| 15 | Mensaje cliente `usage.loadFailed` "No pudimos cargar tu consumo…" + "Intentar de nuevo" (verde) | Fila 14 | Verde no se usa para acciones |

### B.3 Diseño (mockup 72)
Dos columnas (izquierda 470 px): **izquierda** tarjeta grande de saldo (acción principal "Conseguir más créditos") + grupo "En qué los usaste este mes"; **derecha** grupo "Historial" (5 filas + "Ver todo" que expande a 20 con paginación) + `details.ch-adv` "Opciones avanzadas · Para creadores profesionales" (cerrado) con: **Límites de tu plan** (Trabajos este mes `{usados} de {jobsPerMonth}` · Espacio `{MB usados} de {storageMB}` · Streams de Clips al mes · Días que guardamos tus resultados `historyDays`) · **Detalle técnico** (% usado, precio por 1,000 créditos de cada paquete, tabla de eventos) · (admin) diagnóstico. Solo se muestran límites con dato real.
Subtítulo de página: "Los créditos se usan cuando tus herramientas trabajan por ti."

### B.4 Copia exacta
| Llave | Texto |
|---|---|
| `credits.title` | Mis créditos |
| `credits.sub` | Los créditos se usan cuando tus herramientas trabajan por ti. |
| `credits.left` | Te quedan |
| `credits.unit` | créditos |
| `credits.used` | Usaste {usados} de {total} este mes |
| `credits.renew` | Se renuevan el **{fecha}**. Vuelves a tener {total}. |
| `credits.extra` | Créditos extra comprados: **{n}**. Se usan después de los de tu plan. |
| `credits.unlimited` / `.admin` | Sin límite de créditos / Eres administrador. |
| `credits.cta` | Conseguir más créditos |
| `credits.byTool` | En qué los usaste este mes |
| `credits.byTool.clips` / `.senales` / `.envivo` / `.generic` | Hiciste {n} clips / Te mandamos {n} avisos / Manejaste {n} transmisiones / Lo usaste {n} veces |
| `credits.history` / `.all` | Historial / Ver todo |
| `credits.history.renewal` | Se renovaron tus créditos |
| `credits.history.pack` | Compraste {n} créditos |
| `credits.adv` / `.advTag` | Opciones avanzadas / Para creadores profesionales |
| `credits.adv.limits` / `.tech` | Límites de tu plan / Detalle técnico |
| `credits.sheet.title` | Conseguir más créditos |
| `credits.sheet.sub` | Se suman a los que ya tienes. Tu plan y tu fecha de cobro no cambian. |
| `credits.pack.name` | {n} créditos |
| `credits.pack.small` / `.mid` / `.big` | Para unos cuantos clips más / Cada crédito te sale más barato / El más barato por crédito, para uso diario |
| `credits.pack.once` | Pago único |
| `credits.sheet.terms` | Es un **pago único**, no una suscripción. Los créditos extra se usan después de los de tu plan y {vigencia}. Precios en MXN, IVA incluido. — `{vigencia}` = "**no vencen**" o "vencen el **{fecha}**" según **D-F3-4** |
| `credits.sheet.card` | En el siguiente paso pones tu tarjeta. Pago seguro con Mercado Pago. |
| `credits.sheet.cta` | Continuar al pago · {monto} MXN |
| `credits.sheet.later` | Ahora no |
| `credits.paid` | **Pago recibido.** Tus créditos se suman en unos minutos. |
| `credits.low` | Te queda poco: **{pct}%** de tus créditos. Se renuevan el {fecha}. · botón "Conseguir más" |
| `credits.empty.title` / `.body` / `.cta` | Aún no usas tus créditos / Cuando hagas tu primer clip, aquí verás en qué se usaron. / Hacer mi primer clip |
| `credits.error.title` / `.body` / `.cta` | No pudimos cargar tus créditos / Tus créditos están bien; solo no pudimos mostrarlos ahora. / Intentar otra vez |

Números con `toLocaleString('es-MX')` (o el locale activo); nada de "100k"/"2M".

### B.5 Estados
Vacío (fila 12) · cargando (`Skeleton` de la tarjeta, 3 filas y 5 filas) · error (fila 14) · casi sin créditos (fila 7) · sin créditos ("Te quedaste sin créditos este mes. Se renuevan el {fecha}." en la tarjeta, botón igual) · compra recibida (fila 10) · admin ilimitado (fila 5) · socio (fila 11). Hoja: opción seleccionada por defecto la de en medio; botón con el monto de la opción elegida; `Esc`/✕/"Ahora no" cierran y regresan el foco al botón.

---

## C. `/app/settings/perfil` → **Mi perfil** (parte de Mi cuenta) · mockups **73**, **74** §1

### C.1 Ruta
- **Se queda `/app/settings/perfil`** (Mi cuenta = `/app/settings`). Agregar a `MODERN`. Migaja "Mi cuenta ›" → `/app/settings`. `h1` "Mi perfil".
- En Mi cuenta la fila `account.prefs.profile` dice "Perfil y contraseña" pero esta página **no tiene contraseña** → cambiar a "Mi perfil" (o agregar "Cambiar contraseña" en Opciones avanzadas, **D-F3-8**). La fila "Idioma" de Mi cuenta enlaza a `/app/settings/perfil#idioma`.

### C.2 Inventario viejo → nuevo
| # | Elemento viejo | Nuevo | Nota |
|---|---|---|---|
| 1 | "● CUENTA" | `GroupHeader` "Tus datos" | |
| 2 | (no había) | Fila de foto: `Avatar large` (iniciales) · "Tu foto" · "Opcional" · `btn-secondary compact` "Cambiar foto" | `profiles.avatar_url` ya es editable por el usuario (migración 0032). Si no hay bucket de almacenamiento para fotos, **no mostrar el botón** (solo iniciales) — **D-F3-6** |
| 3 | NOMBRE · input oscuro "qachalybfreev69c51" | `Field` "Tu nombre" (62 px, borde `#DCDCE3`, 19 px) | Validación actual: 2–120 caracteres. Error al salir del campo: "Escribe tu nombre (mínimo 2 letras)." |
| 4 | CORREO · input oscuro (en código `disabled`) | `Field` de solo lectura (fondo `#F7F7FA`, ícono sobre, `aria-readonly`) · ayuda "Aquí te mandamos tus avisos y recibos." | Cambiar correo no existe hoy; no se inventa (si se pide, flujo con verificación al correo nuevo) |
| 5 | Botón ámbar chico "Guardar cambios" (13 px) **arriba**, solo para nombre + idioma | **Un solo** botón `btn-xl` "Guardar cambios" al final del formulario (columna derecha, después de Opciones avanzadas; en móvil fijo abajo), que guarda **todo** lo de la página. Deshabilitado sin cambios | Estados en 74 §1 |
| 6 | "● PREFERENCIAS" + nota "El idioma se guarda en tu cuenta con el botón «Guardar cambios» de arriba. La zona horaria y los interruptores de abajo se guardan solo en este navegador." | `GroupHeader` "Idioma y hora". La nota **se quita**: todo se guarda en la cuenta. Junto al botón: "Todo se guarda en tu cuenta: se ve igual en tu celular y en tu computadora." | Requiere C.5 |
| 7 | IDIOMA · select oscuro "English" / "Español" | `select.ch-select` dentro de `Field` "Idioma" (`id="idioma"`): "Español (México)" · "English" | **Hoy muestra "English" a una cuenta en español**: el `useEffect` mezcla `localStorage['chalyb:settings:prefs'].locale` encima del valor real, y `profiles.preferred_locale` tiene `default 'en'` (migración 0001). Arreglo C.5 |
| 8 | ZONA HORARIA · select con IANA crudo "America/Mexico_City", "America/New_York", "America/Los_Angeles", "Europe/Madrid" | `select.ch-select` "Zona horaria" con nombres en palabras: "Ciudad de México (UTC−6)", "Tijuana (UTC−7)", "Hermosillo (UTC−7)", "Cancún (UTC−5)", "Nueva York (UTC−4)", "Los Ángeles (UTC−7)", "Madrid (UTC+2)" (offset calculado al momento con `Intl`, no escrito) · ayuda "Usamos esta hora en tus avisos y fechas." | El valor guardado sigue siendo IANA. Detectar la del navegador si la cuenta no tiene |
| 9 | "● NOTIFICACIONES" | `Group` "Notificaciones" con `Row` + `Switch` (56×34, `aria-label` = título) | |
| 10 | "Errores críticos" · "Te avisamos por email y push cuando algo se cae." (on) | "Si algo deja de funcionar" · "Te avisamos por correo y en tu celular." | |
| 11 | "Resumen diario" · "Ingresos, tareas y errores del día anterior, a las 09:00." (on) | "Resumen del día" · "Lo que hicieron tus herramientas ayer, a las 9:00 a.m." | "Ingresos" es del panel del dueño, no de un suscriptor; hora en la zona del usuario |
| 12 | "Eventos de marketing" · "Cuando una publicación se vuelve viral o sube la interacción." (off) | "Cuando a un clip tuyo le va muy bien" · "Si se vuelve viral o recibe muchas reacciones." | El nombre viejo confundía con correos de marketing |
| 13 | (no había) | "Novedades y promociones" · "Consejos y ofertas por correo. Quítalo cuando quieras." (refleja `marketing_opt_in`; cambiarlo agrega un evento en `consent_events`, nunca edita uno) | El usuario debe poder retirar el consentimiento que dio al registrarse (`signup.marketing`). **D-F3-5** |
| 14 | "● SEGURIDAD" · "2FA con app autenticadora" · "El código TOTP es obligatorio para los roles Admin y Super Admin." (on) | `details.ch-adv` "Opciones avanzadas" + `Pill` "Seguridad" → "Verificación en dos pasos" · "Te pedimos un código de una app (como Google Authenticator) al entrar." | **Hoy el interruptor no hace nada** (solo `localStorage`; no hay MFA de Supabase en el código). Un control de seguridad falso **se quita**. Se muestra solo cuando exista la inscripción real (`supabase.auth.mfa.enroll/verify`); para Admin/Super Admin la obligación se valida en el servidor, no con un interruptor. "TOTP", "roles" → nunca en la vista normal |
| 15 | Texto "Cargando…" (antes de hidratar) | `Skeleton` de campos (74 §1); la página se pinta en el servidor con los valores reales, sin esperar `localStorage` | |
| 16 | Toast "Perfil actualizado — **{nombre}**" (vía `?saved=1`) / "**Error** · {mensaje}" (HTML con `dangerouslySetInnerHTML`) | `.ch-toast` "Listo, guardamos tus cambios." (con ícono check verde) / error en la barra del botón: "No pudimos guardar. Revisa tu internet e intenta otra vez. Tus cambios siguen aquí." + "Intentar otra vez" (74 §1). **Texto plano, sin HTML** | Se elimina `escapeHtml` + `dangerouslySetInnerHTML` |
| 17 | Mensajes de servidor "El nombre debe tener entre 2 y 120 caracteres." / "Idioma no válido." / "Inicia sesión para continuar." / `error.message` de Supabase crudo | Mensajes en i18n (C.4); nunca el `error.message` de la base | |

### C.3 Diseño (mockup 73)
Dos columnas iguales (`minmax(0,1fr)` ×2, gap 26). Izquierda: "Tus datos" (foto, nombre, correo) y "Idioma y hora" (idioma, zona). Derecha: "Notificaciones" (4 filas), "Opciones avanzadas" (cerrado), nota + `btn-xl` "Guardar cambios". Labels 18 px/600 encima de cada campo; inputs blancos 58–62 px; texto de ayuda 16 px `--ink3-text`.
Móvil 390: una columna en el mismo orden, el botón fijo abajo sobre la barra de pestañas.

### C.4 Copia exacta (`workspace.settings.*` se reemplaza por `profile.*`; mantener las llaves viejas hasta borrar el componente viejo)
| Llave | Texto |
|---|---|
| `profile.title` | Mi perfil |
| `profile.data` | Tus datos |
| `profile.photo` / `.photoSub` / `.photoCta` | Tu foto / Opcional / Cambiar foto |
| `profile.name` | Tu nombre |
| `profile.name.error` | Escribe tu nombre (mínimo 2 letras). |
| `profile.name.tooLong` | Tu nombre puede tener hasta 120 letras. |
| `profile.email` / `.emailHint` | Correo / Aquí te mandamos tus avisos y recibos. |
| `profile.langTime` | Idioma y hora |
| `profile.language` | Idioma |
| `language.es` / `language.en` | Español (México) / English *(cada idioma se escribe en su propio idioma)* |
| `profile.timezone` / `.tzHint` | Zona horaria / Usamos esta hora en tus avisos y fechas. |
| `profile.notifs` | Notificaciones |
| `profile.n.critical` / `.criticalSub` | Si algo deja de funcionar / Te avisamos por correo y en tu celular. |
| `profile.n.daily` / `.dailySub` | Resumen del día / Lo que hicieron tus herramientas ayer, a las {hora}. |
| `profile.n.viral` / `.viralSub` | Cuando a un clip tuyo le va muy bien / Si se vuelve viral o recibe muchas reacciones. |
| `profile.n.marketing` / `.marketingSub` | Novedades y promociones / Consejos y ofertas por correo. Quítalo cuando quieras. |
| `profile.adv` / `.advTag` | Opciones avanzadas / Seguridad |
| `profile.mfa` / `.mfaSub` | Verificación en dos pasos / Te pedimos un código de una app (como Google Authenticator) al entrar. |
| `profile.mfa.required` | Obligatoria para administradores. |
| `profile.save` | Guardar cambios |
| `profile.saving` | Guardando… |
| `profile.note.clean` | Todo se guarda en tu cuenta: se ve igual en tu celular y en tu computadora. |
| `profile.note.dirty` | Tienes cambios sin guardar. |
| `profile.saved` | Listo, guardamos tus cambios. |
| `profile.saveError` | No pudimos guardar. Revisa tu internet e intenta otra vez. Tus cambios siguen aquí. |
| `profile.retry` | Intentar otra vez |
| `profile.leave` (al salir con cambios) | ¿Salir sin guardar? Tus cambios se pierden. · [Seguir editando] (primario) · [Salir sin guardar] (`btn-dark`) |
| en.json | Las mismas llaves traducidas (p. ej. `profile.saved` "Done, your changes are saved.") |

### C.5 Comportamiento de guardado (arregla el bug y los controles falsos)
1. **Valores iniciales desde el servidor**, no desde `localStorage`: `full_name`, `email`, `preferred_locale`, `avatar_url`, y los campos nuevos de C.5.3. Al montar, si existe `localStorage['chalyb:settings:prefs']`, **migrarlo una sola vez** (solo si la cuenta no tiene valor propio) y **borrar la llave**. Nunca sobrescribe lo que viene del servidor.
2. `preferred_locale` con `default 'en'`: nueva migración que cambia el default a `'es'`. Backfill de cuentas que nunca eligieron idioma: **D-F3-10** (default del build: no tocar filas existentes; el select muestra el idioma con el que se está viendo la app si el valor guardado es el default de fábrica y la cuenta nunca guardó).
3. Persistencia de lo que hoy vive en el navegador: migración que agrega a `profiles` `timezone text`, `notify_critical bool default true`, `notify_daily bool default true`, `notify_viral bool default false` y los agrega al `grant update` de 0032 (los demás campos siguen bloqueados). `marketing_opt_in` se guarda como evento en `consent_events` (append-only).
4. **Un solo `saveProfileSettings`** que recibe todo (nombre, idioma, zona, 3 avisos, marketing). Mismo cliente de Supabase con el usuario, una lectura, una escritura (como ya documenta `profile-actions.ts`).
5. Si **no** cambió el idioma: no hay redirección; la acción regresa `{ ok: true }`, se muestra el toast, el botón vuelve a deshabilitado y el formulario se queda con los valores guardados.
6. Si **sí** cambió el idioma: `redirect({ href:{ pathname:'/app/settings/perfil', query:{ saved:'1' } }, locale })` como hoy, **con la sesión intacta** (ver C.6); al llegar, el toast sale en el idioma nuevo y se quita `?saved=1` de la URL.
7. Interruptores de Notificaciones: si al hacer el PR **ningún proceso lee** `notify_critical` / `notify_daily` / `notify_viral` (hoy nadie lee las preferencias), se esconden detrás de `PROFILE_NOTIFICATION_PREFS` (default apagado) para no mostrar controles sin efecto — **D-F3-5**. "Novedades y promociones" sí se muestra (consentimiento real).
8. 2FA: fuera de la vista hasta que exista MFA real (C.2 fila 14). Si Opciones avanzadas queda vacío, no se muestra la barra.
9. Salir con cambios sin guardar → `profile.leave` (hoja de confirmación) en navegación interna y `beforeunload` en cierre de pestaña.

### C.6 Bug conocido: **guardar el idioma te saca de la sesión**
Historia: la acción hacía `getUser` en un cliente y `update` en otro y re-renderizaba layouts dentro del mismo POST; el usuario terminaba en `/sign-in?next=/app/settings`. El comentario de `saveProfileSettings` dice que ya se corrigió, pero **no hay prueba** que lo cubra. Este PR agrega la prueba y, si falla, el arreglo (revisar `src/proxy.ts`: que la cookie de Supabase se refresque también en `/en/app/*`, que la redirección de `next-intl` conserve las cookies que escribió la acción y que la cookie `NEXT_LOCALE` no pise las de sesión).

---

## 4. Accesibilidad y criterios de aceptación

### 4.1 Accesibilidad (las 3 páginas)
- Contraste **AA**: texto normal ≥ 4.5:1, texto grande ≥ 3:1. Texto secundario `--ink3-text` (5.0:1 en blanco), verde de texto `--ok-text`. Prohibido `--ink3` y `--ok` como color de texto.
- **Texto ≥ 16 px** (cuerpo 18, cobros 17–18, ayuda 16; pills 16 en estas pantallas). Únicas excepciones: `.ch-ghead` y `.ch-plan__k` (15 px, ya aprobados).
- Objetivos táctiles **≥ 44 px** (botones 60/68, filas 68, interruptores 56×34 dentro de una fila de 68 que también es clicable, opciones de la hoja 84).
- Foco visible (`:focus-visible` 2 px acento); todo con teclado; `Sheet` atrapa el foco y lo regresa; `role="switch"` + `aria-checked`; campos con `<label for>` y `aria-describedby` para ayuda y errores; errores anunciados con `role="alert"`; toast con `role="status"`; barra de créditos con `role="progressbar"` + `aria-valuenow/min/max` + texto visible.
- `lang` del documento = idioma activo (`es-MX` / `en`). Fechas con `formatFechaLarga` en la zona del usuario.

### 4.2 Criterios de aceptación por página
**A · Mi plan**
- [ ] `/app/subscription` y `/app/billing` en Gratis se ven como **70**; en Pro mensual como **71**; los otros 5 estados de BUILD-SPEC §6.10 + "Gratis con prueba usada" + "admin" tienen fixture y captura (1440×900 y 390×844).
- [ ] Volver de Mercado Pago con `?status=success` sincroniza y muestra el plan activo en ese mismo render (prueba existente se mantiene).
- [ ] El número grande de la oferta es el cobro real con periodicidad; prueba de contenido: no existe "2 meses gratis", ni "/mes" como número grande del anual, ni "1 herramienta incluida", ni "EL MÁS ELEGIDO".
- [ ] Ningún monto en JSX/i18n: cambiar `LIST_CENTS.pro.year` cambia 70 y 71 (prueba unitaria con snapshot).
- [ ] En pagado, "Cancelar suscripción" visible sin scroll en 1440×900; el banner de 7 días aparece del día −7 al día del cobro.
- [ ] Abuela: dice "cuánto me cobran y cuándo" en < 5 s; encuentra "Empezar mis 7 días gratis" sin scroll.

**B · Mis créditos**
- [ ] Muestra el saldo real de `getTokenBalance()`; con `warnings` que afecten al saldo **no** pinta un número (muestra el error).
- [ ] "Conseguir más créditos" abre la hoja; cada opción lleva a `/app/usage/checkout?pack={id}` con el monto correcto (`packPriceCents`); "Ahora no", ✕ y `Esc` cierran.
- [ ] Ninguna palabra: "token(s)", "engine", "run", "llamada", "LLM", "Storage", "Publish", "telemetry", "balance", "bonus", "Top-up", "Suscripción" en la vista normal (sí permitidas dentro de Opciones avanzadas solo si son nombres técnicos necesarios; preferir palabras).
- [ ] Ningún "% de descuento" que no se calcule de `PRICING`.
- [ ] Estados vacío / error / casi sin créditos / sin créditos / compra recibida / admin / socio con fixture y captura.
- [ ] Profesional: el detalle técnico está a 1 toque (Opciones avanzadas) y recuerda abierto/cerrado.

**C · Mi perfil**
- [ ] Un solo botón "Guardar cambios"; deshabilitado sin cambios; "Guardando…" bloquea doble envío; éxito = toast "Listo, guardamos tus cambios." sin recargar (si no cambió el idioma).
- [ ] Recargar la página (o abrirla en otro navegador) muestra exactamente lo guardado: nombre, idioma, zona, avisos, marketing. `localStorage['chalyb:settings:prefs']` ya no existe después de la primera visita.
- [ ] Con `localStorage` = `{"locale":"en"}` y la cuenta en `es`, el select muestra **Español (México)**.
- [ ] No hay interruptor de 2FA mientras no exista MFA real; no hay ningún interruptor que no cambie nada (prueba: cada `Switch` visible tiene un campo en `profiles` o un evento que lo lea).
- [ ] Ningún `dangerouslySetInnerHTML` en el formulario; ningún `error.message` de Supabase en pantalla.
- [ ] **Prueba E2E del bug de sesión (obligatoria, bloquea el merge)** — `e2e/perfil-idioma-sesion.spec.ts` (usar el arnés existente: `asRole('free')` de `e2e/utils/roles`, `e2e/mock-supabase/server.mjs`; ver `e2e/logout-en.spec.ts` como ejemplo). Como el mock no prueba cookies reales de Supabase, correr esta prueba **también** contra un Preview de Vercel con una cuenta de prueba real antes de publicar:
  1. Entrar con una cuenta Gratis de prueba (fixture) → `/app/settings/perfil`.
  2. Cambiar Idioma a "English" → "Guardar cambios".
  3. Esperar URL `/en/app/settings/perfil` (sin `saved=1` después del toast). **Nunca** pasa por `/sign-in`: registrar todas las navegaciones y fallar si alguna contiene `/sign-in`.
  4. El toast dice "Done, your changes are saved."; `h1` en inglés; `document.documentElement.lang === 'en'`.
  5. Las cookies de sesión de Supabase (`sb-*-auth-token*`) siguen presentes y la sesión es válida: `page.goto('/en/app/settings')` muestra el botón "Sign out" (mismo criterio que `logout-en.spec.ts`) y la tarjeta de usuario con el mismo nombre/correo, sin pasar por `/sign-in`.
  6. Recargar → sigue dentro y en inglés. Ir a `/en/app` y volver → sigue dentro.
  7. Cambiar a "Español (México)" → guardar → URL `/app/settings/perfil`, toast "Listo, guardamos tus cambios.", sigue dentro.
  8. Repetir 3 veces seguidas y también: (a) cambiando nombre + idioma a la vez, (b) en 390×844, (c) con el token de acceso a punto de vencer (fixture con `expires_at` en < 60 s) para cubrir el refresco de cookie en la misma petición.
  9. En la base: `profiles.preferred_locale` = último valor; ningún otro campo cambió.

### 4.3 Criterios globales (las 3 páginas)
- [ ] **No queda estilo viejo**: sin monospace, sin micro-etiquetas en mayúsculas, sin ámbar como acento, sin paneles oscuros. Prueba Playwright en las 3 rutas (Gratis, Pro, admin):
  - `document.querySelector('.ch-legacy, .cc-shell, [class*="cc-mod-"]') === null`;
  - ningún elemento visible con `getComputedStyle(e).fontFamily` que contenga `mono`;
  - ningún nodo de texto con `font-size < 16px` salvo `.ch-ghead`, `.ch-plan__k`;
  - ningún `text-transform: uppercase` salvo `.ch-ghead`, `.ch-plan__k`;
  - ningún elemento > 200×120 px dentro de `main` con fondo de luminancia < 0.2 (excepto `.ch-toast` y `btn-dark`);
  - ningún color de texto/fondo/borde dentro de `[#E0A000–#F5C060]` (ámbar viejo `#f5b13d`, `#f5b942`, `#e8c27a`) fuera de `Banner warn`/`Pill warn`;
  - axe-core sin violaciones `color-contrast`, `label`, `button-name`, `aria-*`.
- [ ] `shell-routes.test.ts`: `shellModeFor('/app/subscription'|'/app/usage'|'/app/settings/perfil'|'/en/app/usage') === 'modern'`.
- [ ] Prueba de contenido (bundle + `messages/*.json` usados por estas rutas): sin "próximamente", "beta", "Disponible", "Requiere Pro", "engine", "token", "Free" (como nombre de plan), "Chalyb" fuera del logo.
- [ ] Un solo botón primario visible por vista (contar `.ch-btn--primary` visibles, excluyendo la hoja cerrada).
- [ ] Capturas Playwright de 70–74 equivalentes guardadas en el PR.

### 4.4 Revisión tipo grep (debe salir vacía en los archivos tocados)
```bash
FILES='src/app/[locale]/(dashboard)/app/subscription src/app/[locale]/(dashboard)/app/usage src/app/[locale]/(dashboard)/app/settings/perfil src/components/workspace/settings-form.tsx src/components/workspace/subscription-actions.tsx src/components/workspace/token-pack-buy-button.tsx src/components/app/billing'
# 1) Clases y variables del tema viejo
rg -n "cc-mod-|cc-scroll|cc-bar-(track|fill)|cc-shell|ch-legacy|--cc-(mono|amber|amber-g|green|green-g|purple|purple-g|red|txt(-[0-9])?|panel|line-2|r-l|bg-3|disp)" $FILES
# 2) Monoespaciado, mayúsculas, tamaños chicos y colores en línea
rg -n "monospace|font-?[Ff]amily|text-?[Tt]ransform|textTransform|letterSpacing: *'0\.[0-9]|fontSize: *1[0-5](\.[0-9])?\b|#f5b1|#f5b9|#e8c2|#070809|rgba\(245, ?1(77|85)" $FILES
# 3) Glifos y textos de desarrollo
rg -n "▸|◆|●|◷|telemetry|paso 05|profiles\.tier|Vercel|\.env|TOTP|Super Admin|engines?\b|tokens?\b|Top-up|LLM|Free\b|\bSuscripción\b|EL MÁS ELEGIDO|1 herramienta incluida|nunca caducan|dangerouslySetInnerHTML|localStorage" $FILES --glob '!*.test.*'
```
(Si una coincidencia del grupo 3 es un nombre interno de variable o import — p. ej. `getTokenBalance`, `TOKEN_PACKS` — se acepta; el criterio es que **no llegue a la pantalla**. Los nombres internos no se renombran, BUILD-SPEC §0.1.) Al terminar, borrar `subscription-actions.tsx` y `token-pack-buy-button.tsx` si ya nadie los importa, y las llaves `workspace.settings.*` sin uso.

---

## 5. Decisiones abiertas para el dueño (con default del build)
| # | Decisión | Por qué importa | Default del build |
|---|---|---|---|
| D-F3-1 | ¿Pro incluye **todas** las herramientas o **1 a elegir**? La página vieja dice "1 herramienta incluida · tú eliges cuál" (`TIER_MARKETING`, `liveEnginesCount: 1`); el flag `proIncludesAllTools()` (default `true`) y toda la copia nueva dicen "todas". | Prometer algo que no se da es publicidad engañosa (LFPC art. 32). | Seguir el flag: con `true`, "Todas las herramientas"; con `false`, "Tu plan Pro incluye {tools}". Borrar la línea vieja. Además: ¿qué distingue a VIP aparte de créditos? (TODO del flag) |
| D-F3-2 | Créditos por plan: `TIER_CAPS.tokensPerMonth` (50,000 / 1,000,000 / 5,000,000) vs `PRICING.credits` (todo `null` = "ocultar", Q13). | Dos fuentes de verdad. | Saldo y uso del usuario: siempre de `getTokenBalance()` (es real). Números de plan en listas de venta ("{n} créditos al mes"): solo si `PRICING.credits[plan]` no es `null`; si es `null`, la línea se oculta. Unificar en una sola fuente |
| D-F3-3 | Los créditos se renuevan el **día 1** (`tokens.ts`), pero BUILD-SPEC/mockup 30 dicen "Se renuevan el día {día de cobro} de cada mes". | La fecha que ve la persona debe ser la real. | Mostrar el día 1 (lo que hace el código). Cambiar el texto de §6.10 o el código, no ambos |
| D-F3-4 | Créditos extra: la página dice "**nunca caducan**"; Términos de Suscripción §9.3 dice que vencen a los [VIGENCIA]. | Contradicción entre UI y contrato. | Mostrar "no vencen" (lo que hace el sistema) **y** pedir al abogado que alinee §9.3; o fijar vigencia y mostrar "vencen el {fecha}". Bloquea publicar 72b |
| D-F3-5 | Notificaciones: hoy **nada** lee esos interruptores. ¿Se construyen los envíos (aviso de falla, resumen diario a las 9:00, clip viral) o se ocultan? ¿Se agrega "Novedades y promociones"? | Nunca un control sin efecto (BUILD-SPEC §0, §4.3). | Ocultar los 3 avisos tras `PROFILE_NOTIFICATION_PREFS` hasta que exista el envío; mostrar "Novedades y promociones" (consentimiento revocable, evento en `consent_events`) |
| D-F3-6 | Foto de perfil: ¿hay almacenamiento para subirla? | Botón sin acción si no. | Solo iniciales hasta tener bucket + límite de tamaño (PNG/JPG ≤ 5 MB) |
| D-F3-7 | Regalías de socios ("Royalties · tus engines"): ¿se quedan en Mis créditos o se mueven a una sección de socio? | Mezcla gasto del cliente con ganancias de socio. | Se quedan en Mis créditos como grupo "Tus ganancias como socio", solo para socios, con lo técnico en Opciones avanzadas |
| D-F3-8 | Mi cuenta dice "Perfil y contraseña" pero no hay contraseña. | Fila que promete algo que no existe. | Renombrar a "Mi perfil"; si se quiere contraseña, "Cambiar contraseña" (correo con enlace) en Opciones avanzadas |
| D-F3-9 | Compras viejas "Pago único" (plan sin suscripción, `tierEndsAt`) y tier PARTNER: confirmar cómo se ven en `MiPlanView`. | Estado no cubierto por §6.10. | "Tu plan · Activo" · "{plan} hasta el {fecha}" · "No se renueva solo." · [Ver planes] |
| D-F3-10 | `preferred_locale` tiene `default 'en'`. ¿Se corrigen las cuentas que nunca eligieron idioma? | Hoy la mayoría de cuentas mexicanas quedarían en "English". | Default nuevo `'es'`; no tocar filas viejas sin aprobación; el select muestra el idioma activo cuando el guardado es el de fábrica |
| D-F3-11 | Zona horaria: hoy casi todo formatea fechas con `America/Mexico_City` fijo. ¿Se usa la del usuario en toda la app? | Si se guarda pero no se usa, es otro control sin efecto. | Guardarla y usarla en estas 3 páginas + avisos; el resto de la app en un PR aparte |
| D-F3-12 | ~~IVA abierto~~ **Resuelto para planes:** totales con IVA (Pro $997 / Pro anual $9,970 / VIP $3,799). Precios: ver PRICING-CARDS-SPEC.md (fuente única). **Sigue abierto para paquetes de créditos** ($172.84 / $694.84 / $2,318.84, lista × 1.16). | Precio total visible obligatorio. | Planes: `PRICES_INCLUDE_IVA=true`. Paquetes: lo que decida el dueño; nada escrito a mano |

---

## 6. Índice de mockups de este fix
| # | Archivo | Qué muestra | Ruta |
|---|---|---|---|
| 70 | `mockups/70-mi-plan-gratis.png` | Mi plan Gratis: tu plan $0, tu cuenta (créditos, método, facturas), VIP, oferta "Prueba Pro gratis 7 días" (Pro mensual $997, o anual $9,970) con bloque de cobro legal | `/app/subscription`, `/app/billing` (Gratis) |
| 71 | `mockups/71-mi-plan-pro.png` | Mi plan Pro mensual pagado (estructura de 30) + banner de renovación 7 días antes | `/app/billing` (y `/app/subscription` → redirige) |
| 72 | `mockups/72-creditos.png` | Mis créditos: saldo grande + barra, renovación, extra, uso por herramienta, historial, Opciones avanzadas | `/app/usage` |
| 72b | `mockups/72b-creditos-comprar.png` | Hoja "Conseguir más créditos": 3 paquetes, pago único, monto en el botón | `/app/usage` (hoja) |
| 73 | `mockups/73-perfil.png` | Mi perfil: foto/iniciales, nombre, correo (solo lectura), idioma, zona, notificaciones, avanzadas, un "Guardar cambios", toast de éxito | `/app/settings/perfil` |
| 74 | `mockups/74-estados-fix3.png` | Estados: barra de guardar (sin cambios / con cambios / guardando / error), toast, error de campo, cargando; créditos vacío / error / pago recibido / poco saldo; Gratis con prueba usada / prueba terminada / admin | las 3 |

Generador: `build_fix3.py` (sandbox de `build.py`, solo escribe `html/70–74*`) + `render_fix3.py` (Chrome headless 2x, reporta desbordes, texto < 15 px y fuentes mono: hoy 0 en las 6).
