# Chalyb · TOOLS-SPEC: el interior de cada herramienta (para Claude Code)

> Cómo se ven y cómo funcionan **Clips**, **Señales** y **En vivo** *dentro* de la app (`/app`), sin abrir pestañas nuevas.
> Complementa a `BUILD-SPEC.md` (tokens §1, glosario §3, reglas §0, legal §11). **Si algo choca, manda `legal/aceptacion-ux.md` en lo legal y `BUILD-SPEC.md` en tokens/glosario.**
> Mockups: `mockups/50-…61-*.png` (hoja de contacto: `mockups/62-overview-herramientas.png`). HTML de referencia: `html/50-…62-*.html`.
> Generador: `build_tools.py` + `render_tools.py` (separados a propósito: no tocan `build.py`, `render.py`, las pantallas 00–30 ni las 40–43 de la landing; usan el mismo `html/style.css` y los helpers de `build.py`/`more_shared.py`).
> Regenerar: `python3 build_tools.py && python3 render_tools.py` (o `python3 render_tools.py 54` para una sola).

---

## 0. Qué cambia y por qué

**Hoy (recorrido con cuenta Pro, 2 oct 2026, capturas en `/workspace/chalyb-engines-walk/`):** la nueva estructura ya está en producción (Inicio / Mis resultados / Mi cuenta). `/app/engines` lista 3 herramientas; cada página (`/app/engines/chalybclip`, `/chalybcrypto`, `/chalybobs`) solo tiene título, "Incluido en tu plan", una descripción, el texto "{Herramienta} se abre en una pestaña nueva" y un botón **Abrir** que abre otra app en otra pestaña. Las tres fallan:

| Herramienta | Qué ve la persona | Problema |
|---|---|---|
| Clips | "No pudimos abrir Clips en este momento. Intenta de nuevo en unos minutos." + Intentar de nuevo + Hablar con una persona | Callejón sin salida: la herramienta principal del producto no abre. |
| Señales | "Antes de abrir Señales, lee el aviso y acéptalo." + Hablar con una persona | **No hay ningún aviso que leer ni casilla que marcar** en la pantalla: bloqueo total (viola §0.3 "nunca un callejón sin salida"). |
| En vivo | Se abre una pestaña `about:blank` | La pestaña nunca navega. |

**Después:** cada herramienta es **una mini-casa dentro de la app**: la barra lateral se queda, arriba va el encabezado de la herramienta (ícono con su color, nombre, "Incluido en tu plan") y **máximo 3 pestañas** (Principal · Historial · Ajustes). **Una sola acción principal** por pantalla. Lo profesional vive en **"Opciones avanzadas"**, cerrado por defecto. **Nada abre otra pestaña.**

### 0.1 Reglas nuevas que se suman a BUILD-SPEC §0
1. **Prohibido abrir pestañas o ventanas** desde `/app/*` para usar una herramienta (`window.open`, `target="_blank"`, redirecciones a otro dominio). Excepciones permitidas: descargas de archivo (mismo tab, `Content-Disposition: attachment`) y el flujo OAuth de YouTube/Twitch/TikTok/Kick/Facebook (redirección en la **misma** pestaña con regreso a la pantalla de origen). Los documentos legales se abren en una hoja (`Sheet`) dentro de la app.
2. **Una herramienta que no responde nunca saca a la persona de la app:** se muestra `ToolErrorState` (mockup 60) dentro del mismo encabezado.
3. **Los nombres internos no cambian** (BUILD-SPEC §0.1): los slugs `chalybclip`, `chalybcrypto`, `chalybobs`, tablas, flags y variables de entorno se quedan. Solo cambian rutas visibles y textos.
4. Los datos de las capturas llevan la etiqueta "Datos de ejemplo"; **en producción la etiqueta no existe** y los números son reales.

---

## 1. Arquitectura: qué reemplaza al botón "Abrir en pestaña nueva"

### 1.1 Opciones evaluadas
| | A. Incrustar la app de cada motor (`iframe` / microfrontend) | **B. La app principal llama a las APIs de cada motor (recomendado)** |
|---|---|---|
| Diseño | Cada motor trae su propio estilo; imposible cumplir el sistema (tipos de 18 px, botones de 60–68 px, glosario). | Todas las pantallas se construyen con los componentes de `components/ui/` → mismo sistema que 01–30. |
| Sesión | Cookies de terceros, `X-Frame-Options`/CSP, doble inicio de sesión; es justo lo que hoy rompe (handoff entre dominios). | Una sola sesión: la del usuario en `/app`. El servidor de `/app` habla con los motores con credencial de servicio. |
| Errores | El `iframe` en blanco o con su propio error no se puede traducir a palabras simples. | Errores normalizados → copia de §7 y `ToolErrorState`. |
| Permisos / plan | El motor vuelve a revisar plan por su cuenta (origen del bug B1 de BUILD-SPEC). | `getEntitlements(userId)` (BUILD-SPEC §4.1) decide en un solo lugar. |
| Legal | El aviso de riesgo, consentimientos y registros quedarían repartidos. | El aviso (53), `consent_events` y avisos viven en la app principal, con evidencia única (BUILD-SPEC §10.3). |
| Accesibilidad / móvil | `iframe` + teclado + lectores de pantalla = frágil. | Nativo, probado con las mismas pruebas E2E. |

**Recomendación: B.** Si un motor todavía no tiene API, se usa A **solo como puente temporal**, detrás de un flag por herramienta (`TOOL_EMBED_FALLBACK_{SLUG}`, nombre propuesto), servido desde el **mismo dominio** por proxy inverso (`/app/{herramienta}/legacy`), dentro de `ToolShell`, y **nunca** en pestaña nueva.

### 1.2 Cómo queda (BFF en Next.js)
```
Navegador ──► /app/{clips|senales|en-vivo}/**  (React Server Components + componentes de UI)
                 │
                 ▼
          /api/tools/{slug}/**   (route handlers del servidor de /app = "BFF")
                 │  1. getEntitlements(userId) → included | trial_offer | setup_needed
                 │  2. firma una credencial de servicio corta (JWT HS256/EdDSA, aud={slug}, sub={userId}, exp=60 s) o mTLS
                 │  3. timeout 8 s, 2 reintentos solo en GET idempotentes, circuit breaker por motor
                 │  4. normaliza errores → { reason, retryable, supportCode }
                 ▼
     motores: chalybclip · chalybcrypto · chalybobs   (sin cookies, sin UI pública)
```
- **Registro de herramientas** (`config/tools.ts`, nombre propuesto; si ya existe un catálogo de engines, se extiende): `{ slug:'chalybclip', route:'clips', name:'Clips', icon:'scissors', color:'#5B4BFF', live:true, tabs:[…] }`, `{ slug:'chalybcrypto', route:'senales', name:'Señales', icon:'trend', color:'#FF9F0A', live:true, needsRiskAck:true }`, `{ slug:'chalybobs', route:'en-vivo', name:'En vivo', icon:'live', color:'#FF375F', live:true }` y el resto (Asistente, Pronósticos, Inmuebles, Inversiones) con `live:false` hasta que funcionen. **Solo `live:true` aparece** en Inicio, Herramientas (61) y "También incluido".
- **Estado por herramienta** (`tool_status[slug]`: `ok | slow | down`, `incident_active: boolean`, `incident_since`): lo alimenta el health check (`GET /health` de cada motor cada 60 s) y el dueño desde `/dashboard/herramientas` (BUILD-SPEC §9.1). `incident_active=true` solo cuando **ya se alertó a una persona** (alerta entregada o el dueño lo marcó). Es lo que habilita la frase "Ya nos avisaron, lo estamos arreglando" (60).
- **Tiempo real:** En vivo (estado de transmisión, escenas, espectadores) y el avance de Clips usan **SSE** desde `/api/tools/{slug}/events` (el BFF se suscribe al motor). Polling de 5 s como respaldo.
- **Código de ayuda:** cada error genera `supportCode` = prefijo (`CLP`, `SEN`, `VIV`) + 4 dígitos, ligado al evento en Actividad (`/dashboard/actividad`). "Hablar con una persona" abre el chat con ese código ya escrito.

### 1.3 Contrato mínimo por motor (lo que el BFF necesita; adaptar a lo que exista)
**Clips · `chalybclip`**
- `POST /jobs` `{ source: {url} | {uploadId} | {platform, videoId}, format: 'vertical'|'horizontal'|'square', count: 3|6|10, captions: {on, lang, style}, watermark: {on, logoId?} }` → `{ jobId }` (idempotente con `Idempotency-Key`)
- `GET /jobs?userId=&status=active` · `GET /jobs/{id}` → `{ status: received|finding_moments|adding_captions|ready|failed, pct, step, found, reason? }` (estados de BUILD-SPEC §4.2.3)
- `GET /clips?userId=&limit=&cursor=` · `GET /clips/{id}` → `{ id, jobId, title, durationS, format, captionsOn, trim:{startS,endS}, thumbUrl, previewUrl }`
- `PATCH /clips/{id}` `{ title?, captionsOn?, trim?, format? }` → re-render rápido; **nunca** borra el original
- `GET /clips/{id}/download` → URL firmada (5 min) · `POST /clips/{id}/publish` `{ platform:'tiktok'|'youtube' }`
- `POST /jobs/from-live` `{ streamId, atS, windowS:60 }` (para "Hacer clip de este momento")
- `GET /health`

**Señales · `chalybcrypto`** (regla legal: el contenido **no** se calcula con datos del usuario, §5.5)
- `GET /signals?coins=BTC,ETH&since=` → `[{ id, coin, kind:'buy'|'sell'|'wait', refPriceMXN, createdAt, why:{short, bullets[3]} }]` — **sin `userId`**
- `GET /signals/{id}?range=1d|7d|1m` → señal + serie de precio para la gráfica
- `GET /coins` · webhook `signal.created` → la app principal hace la entrega (WhatsApp/correo/app) según preferencias guardadas **en la app principal**
- `GET /health`

**En vivo · `chalybobs`**
- `POST /pairing-codes` → `{ code:'482913', expiresAt }` (10 min, un solo uso)
- `GET /devices?userId=` → `[{ id, name:'Laptop de María', os, obsReady, online, lastSeenAt }]`
- `GET /devices/{id}/state` → `{ streaming, startedAt, scenes:[{id,name,thumbUrl}], currentSceneId, mic, cam, network:'good'|'slow'|'offline', destinations:[…] }`
- `POST /devices/{id}/commands` `{ type:'start_stream'|'stop_stream'|'set_scene'|'set_mic'|'set_cam', … }` → `{ ok, reason? }`
- Espectadores: el BFF los pide a YouTube/Twitch con las cuentas conectadas del usuario (no el motor).
- `GET /health`

---

## 2. Rutas (visibles) y redirecciones

Rutas en español, como el resto de `/app` (BUILD-SPEC usa `/app/senales`, `/app/en-vivo`). El slug interno vive en `config/tools.ts`, no en la URL.

| Ruta | Pantalla | Mockup |
|---|---|---|
| `/app/herramientas` | Tus herramientas (reemplaza a la lista de `/app/engines` y a 23 para Pro; el estado Gratis de 23 sigue igual) | **61** |
| `/app/clips` | Inicio de Clips (pestaña "Hacer clips") | **50** |
| `/app/clips/nuevo` → `/app/clips/nuevo/formato` → `/app/clips/trabajo/[jobId]` | Asistente de 3 pasos existente (02 → 03/06 → 04 → 05). Cambia de ruta porque `/app/clips` ahora es el inicio de la herramienta | 02–06 |
| `/app/clips/mis-clips` | Pestaña "Mis clips" (rejilla de 05 con buscador y chips Todos / Vertical / Horizontal / Cuadrado) | (usa 05) |
| `/app/clips/[clipId]` | Detalle de un clip | **51** |
| `/app/clips/ajustes` | Ajustes de Clips | **52** |
| `/app/senales` | Inicio de Señales; si no hay aviso aceptado, abre la hoja 53 encima; si no hay monedas elegidas, manda a `/app/senales/empezar` | **54** (+53) |
| `/app/senales/empezar` | Primera activación: paso 1 monedas (20) → paso 2 cómo te avisamos → listo (21) | 20, 21 |
| `/app/senales/historial` | Pestaña "Historial" (misma tarjeta de 54, agrupada por día, con chips por moneda) | (usa 54) |
| `/app/senales/[signalId]` | Detalle de una señal | **55** |
| `/app/senales/ajustes` | Ajustes de Señales (monedas, cómo, horario) | **56** |
| `/app/en-vivo` | Pestaña "Transmitir": sin computadora conectada → 57; conectada y sin transmitir → 22 dentro de `ToolShell`; transmitiendo → 58 | **57**, 22, **58** |
| `/app/en-vivo/conectar` | Conectar (o volver a conectar) la computadora | **57** |
| `/app/en-vivo/transmisiones` | Pestaña "Mis transmisiones" (tarjetas de 19: Ver grabación / Hacer clips) | (usa 19) |
| `/app/en-vivo/ajustes` | Ajustes de En vivo | **59** |

**Redirecciones** (en `next.config` `redirects()`; `permanent:false` (307) las primeras 4 semanas, luego 308). Conservar query string.
| Desde | Hacia |
|---|---|
| `/app/engines` | `/app/herramientas` |
| `/app/engines/chalybclip` (y `/app/engines/chalybclip/*`) | `/app/clips` |
| `/app/engines/chalybcrypto` (y `/*`) | `/app/senales` |
| `/app/engines/chalybobs` (y `/*`) | `/app/en-vivo` |
| `/app/engines/{slug}` de una herramienta con `live:false` | `/app/herramientas` (nunca un 404 ni un callejón) |
| Cualquier URL vieja del dominio de cada motor que se haya compartido (si se conocen) | la ruta equivalente de `/app` |

En la tarjeta de Inicio (01) "Hacer clips de mi stream" → `/app/clips`; "Recibir señales de cripto" → `/app/senales`; "Manejar mi transmisión" → `/app/en-vivo`; "Más herramientas" → `/app/herramientas` (solo si hay alguna `live:true` además de las 3; si no, la 4ª tarjeta no se muestra y la rejilla pasa a 3 columnas, ver F7).

---

## 3. Componentes nuevos (en `components/ui/` o `components/tools/`)

| Componente | Qué es | Medidas / notas |
|---|---|---|
| `ToolShell` | `AppShell` (barra lateral, ítem activo "Inicio") + `ToolHeader` + contenido | padding `34px 64px 30px`, `.wrap` 1040 px |
| `ToolHeader` | Migaja "Inicio ›" (17 px, `--ink2`) · `ToolIcon` 64 px radio 18 con el **color de la herramienta** · `h1` 36 px/700 · `Pill ok` "Incluido en tu plan" · `ToolTabs` a la derecha | En plan Gratis la pill es `Pill acc` "Incluido en Pro · Pruébalo gratis" (BUILD-SPEC §3) |
| `ToolTabs` | Control segmentado de **máx. 3** pestañas, cada una es un `<a>` con ruta propia | alto 50 px (+4 de marco), 18 px/600, activa blanca con sombra; fondo `#EBEBF0`, radio 16 |
| `ToolErrorState` | Pantalla "no abrió" (60) | ver §6.1 |
| `ToolLockedState` | Para `trial_offer` (Gratis) en Señales y En vivo | mismo layout que `SetupState` (24, panel 3) |
| `AdvancedOptions` | Barra "Opciones avanzadas · Para creadores profesionales · {resumen}" con chevron; abre acordeón (06) | 66 px, borde interior 1.5 px `#DEDEE4`; recuerda estado por usuario y herramienta |
| `DisclaimerFooter` | Franja de Señales "Esto es informativo…" + "Leer aviso completo" | borde interior 2 px `#E4E0FF`, siempre visible en 54/55/historial |
| `RiskAckSheet` | Hoja del aviso (53) | `Sheet` 700 px, radio 28 |
| `ClipCard` / `ClipGrid` | Miniatura 9:16 recortada, duración, título (2 líneas), meta | 6 columnas en 1040 px |
| `JobProgressRow` | Fila "En proceso" (50) | barra de 12 px, "Paso {n} de 4", % |
| `ConnectedAccounts` | Grupo de cuentas (YouTube/Twitch/TikTok/Kick/Facebook) con "Conectado ✓" o "Conectar" | Conectar abre `ConnectAccountSheet` con el texto de `aceptacion-ux.md` §7 |
| `ClipPlayer` | Reproductor 9:16 (o el formato elegido) con play, barra, tiempo, volumen, pantalla completa | 352×626 en escritorio |
| `TrimBar` | Tira de cuadros con 2 manijas moradas, zona fuera de corte atenuada; "Empieza en / Dura / Termina en" | manijas de 22 px de ancho y 66 px de alto (objetivo táctil ≥ 48 px); teclado: ← → mueven 0.1 s, Shift ±1 s |
| `FormatSegmented` | Vertical / Horizontal / Cuadrado con ícono de forma | 48 px |
| `CaptionPresetPicker` | 3 tarjetas visuales: Clásico (blanco), Amarillo (palabra clave amarilla, **predeterminado**), Con fondo (caja negra) | radio, chequeo morado |
| `SignalCard` | Moneda, símbolo, hora, `VerdictPill`, "Precio de referencia", "Por qué:", "Ver detalle" | la más reciente con anillo acento, pill "Nueva" y botón primario |
| `VerdictPill` | `buy` "Momento de compra" (acento) · `sell` "Momento de venta" (ámbar `--warn`) · `wait` "Sin señal clara" (gris) | **nunca verde** (BUILD-SPEC §1.1) |
| `PriceChart` | Línea + área suave, 3 marcas de eje, días abajo, punto "Aquí te avisamos · {hora}" | sin líneas de "objetivo", sin proyecciones |
| `PairingSteps` | 3 tarjetas: Descargar · Código de 6 dígitos · ¡Listo! | dígitos 46×70, 38 px/700, tabulares |
| `LiveStatusBar` | "En vivo · 00:12:34" (rojo) · espectadores · destinos · Internet | 1 fila |
| `GiantButton` | "Iniciar transmisión" (acento) / "Terminar transmisión" (`--bad`) | 100 px, 27–28 px/700, radio 24 (BUILD-SPEC §1.5) |
| `BigToggle` | Mosaico Micrófono / Cámara con estado escrito ("Encendido" / "Apagada") | ≥ 120 px de alto; apagado = gris |
| `SceneCard` | Miniatura de escena + ícono + nombre + estado ("En pantalla") | seleccionada con anillo acento |

---

## 4. Clips (`chalybclip`) · `/app/clips`

### 4.1 Inicio de Clips · `/app/clips` · mockup **50**
- **Acción principal (una):** `btn-xl` "Hacer clips nuevos" → `/app/clips/nuevo` (paso 1, mockup 02). Al cerrar ✕ el asistente vuelve a **`/app/clips`** (no a Inicio) cuando se entró desde aquí.
- **Copia:**
  - `clips.home.hero.title` "Hacer clips nuevos" · `clips.home.hero.body` "Pega el enlace de tu stream o video. Te damos clips con subtítulos, listos para publicar." · `clips.home.hero.cta` "Hacer clips nuevos" · `clips.home.hero.hint` "Toma 1 minuto. Funciona con YouTube, Twitch, Kick y Facebook."
  - `clips.home.accounts` "Cuentas conectadas" · enlace "Ajustes" · "Conectado" · "Conectar" · subtítulo con el usuario de la red (`@MariaEnVivo`)
  - `clips.home.processing` "En proceso" · `clips.home.processing.hint` "Te avisamos cuando estén listos" · fila: "Clips de “{titulo}”" · "{paso_actual}… Faltan unos {n} minutos." (pasos: "Recibiendo tu video", "Buscando los mejores momentos", "Agregando subtítulos", "Preparando la descarga") · "Paso {n} de 4" · "{pct}%" · botón gris "Ver avance" (→ `/app/clips/trabajo/[jobId]`, mockup 04)
  - `clips.home.latest` "Tus últimos clips" · `clips.home.latest.all` "Ver todos ({n})" (→ Mis clips) · tarjeta: título (2 líneas máx.), "{fecha_relativa} · {Formato}"
- **Pestañas:** `clips.tab.make` "Hacer clips" · `clips.tab.mine` "Mis clips" · `clips.tab.settings` "Ajustes"
- **Estados:**
  - **Primera vez / vacío** (sin clips nunca): se ocultan "En proceso" y "Tus últimos clips"; en su lugar `EmptyState` de 24 panel 1 ("Aún no tienes clips" · "Haz el primero en 1 minuto. Solo pega el enlace de tu stream." · el botón del hero sigue siendo el único primario; el `EmptyState` no repite botón).
  - **Cargando:** hero y encabezado se pintan al instante (son estáticos); esqueletos en cuentas, fila de proceso y rejilla. Sin girador a pantalla completa.
  - **Procesando:** hasta 3 filas `JobProgressRow`; si hay más, "y {n} más" → Mis clips. Avance por SSE.
  - **Trabajo fallido:** la fila cambia a ámbar: "No pudimos terminar “{titulo}”." + razón de BUILD-SPEC §7.6 + "No se usaron créditos." + [Intentar otra vez].
  - **Sin créditos** (`locked` para Clips): el hero cambia a "Te quedaste sin créditos este mes. Se renuevan el {fecha_larga}." + [Ver mi plan] (único primario). Gratis **sí** usa Clips (Fase 0).
  - **Motor caído / no responde:** `ToolErrorState` (60) en el cuerpo; las pestañas siguen visibles; "Mis clips" muestra lo ya guardado si el BFF lo tiene en caché.

### 4.2 Detalle del clip · `/app/clips/[clipId]` · mockup **51**
- **Acción principal:** `btn-xl` "Descargar" (descarga el clip **con** los cambios). Secundarias: "Compartir" (hoja nativa del sistema / copiar enlace) y "Publicar en TikTok" (gris; si TikTok no está conectado abre `ConnectAccountSheet` y vuelve aquí).
- **Copia:** botón Atrás "Mis clips" · "Clip {n} de {total}" con flechas · `clips.detail.title` "Título del clip" · "Así se llamará al publicarlo" · `clips.detail.captions` "Subtítulos" · "{idioma} · {estilo}" · `clips.detail.trim` "Recortar" · "Arrastra los bordes morados" · "Empieza en {m:ss}" · "Dura {m:ss}" · "Termina en {m:ss}" · `clips.detail.format` "Formato" · "Vertical" · "Horizontal" · "Cuadrado" · "Descargar" · "Compartir" · "Publicar en TikTok" · `clips.detail.autosave` "Los cambios se guardan solos. Tu clip original no se borra."
- **Comportamiento:** título editable en línea (máx. 100 caracteres); interruptor de subtítulos aplica al instante en la vista previa; recorte mínimo 5 s, máximo la duración del clip; cambiar formato re-encuadra con centro automático (pro: ajustar encuadre va en Opciones avanzadas de Ajustes). Guardado automático con indicador "Guardando…" / "Guardado" junto a la nota.
- **Estados:** cargando (marco gris del reproductor + esqueletos) · "Preparando tu descarga…" en el botón mientras se re-renderiza (bloqueado contra doble clic) · clip no encontrado → `EmptyState` "No encontramos este clip" + [Ver mis clips] · error al publicar → "TikTok no respondió. Lo intentamos otra vez en unos minutos y te avisamos." (sin perder cambios).

### 4.3 Ajustes de Clips · `/app/clips/ajustes` · mockup **52**
- **Grupos:** `clips.settings.accounts` "Cuentas conectadas" (YouTube "@{usuario}" Conectado · Twitch Conectar · TikTok "Para publicar con un toque" Conectar) · `clips.settings.captions` "Subtítulos": "Poner subtítulos en mis clips" (interruptor, encendido por defecto) · "Idioma de los subtítulos" "Español (México)" · `clips.settings.style` "Estilo de subtítulos" · "Toca uno. Lo usamos en tus próximos clips." · presets "Clásico" / "Amarillo" / "Con fondo" · `clips.settings.brand` "Tu marca": "Marca de agua / logo" (interruptor) "Tu logo en una esquina de cada clip" · "Subir mi logo" "PNG o JPG" · pie `settings.autosave` "Los cambios se guardan solos y se usan en tus próximos clips."
- **Opciones avanzadas** (cerradas; resumen "Publicar automáticamente, duración y Acceso API"): "Publicar automáticamente en mis redes" (requiere cuenta conectada **y** la casilla de `aceptacion-ux.md` §7: "Entiendo que Chalyb publicará clips en **{cuenta}** según las reglas que configuré y que **soy responsable** de lo que se publique." [Activar publicación automática]; evento `autopublish_enabled` en `consent_events`) · "Duración de los clips" (Automática / 15–60 s) · "Encuadre" (Centro automático / Seguir a la persona) · "Subir varios videos a la vez" · "Acceso API".
- **No se agrega** voz ni rostro con IA (BUILD-SPEC §11.6). Si algún día se agrega, va aquí dentro y detrás del paso `ai.likeness.*`.

### 4.4 Aceptación (Clips)
- [ ] **Abuela:** desde Inicio, en ≤ 3 toques llega al paso 1 (Inicio → Clips → Hacer clips nuevos) y en ≤ 5 toques más descarga un clip; en el detalle descarga con **1 toque**; sin scroll para ver "Descargar" a 1440×900 y 390×844.
- [ ] **Abuela:** entiende qué está "En proceso" y cuánto falta sin abrir nada.
- [ ] **Pro:** "Publicar automáticamente" a ≤ 2 toques desde `/app/clips` (Ajustes → Opciones avanzadas); recortar + cambiar formato + publicar en TikTok sin salir de 51.
- [ ] Ningún clip se descuenta de créditos si el trabajo falla (BUILD-SPEC §4.2.5).

---

## 5. Señales (`chalybcrypto`) · `/app/senales`

### 5.1 Aviso de riesgo (una vez) · hoja sobre `/app/senales` · mockup **53**
- **Cuándo:** la primera vez que se abre Señales **y** cada vez que cambie la versión del aviso. Bloquea la herramienta (no la app: la barra lateral sigue funcionando) hasta aceptar. Hoy el aviso se exige pero no se muestra (F2): esta hoja es el arreglo.
- **Estructura (de arriba abajo):** ícono de Señales · `risk.title` "Antes de empezar" · `risk.sub` "Léelo una vez. Son 3 cosas." · 3 puntos:
  1. `risk.b1` "**Son ideas informativas, no consejos personales.**" · "No es asesoría financiera ni una recomendación para ti."
  2. `risk.b2` "**Las señales son iguales para todos en tu plan.**" · "No usamos tus saldos, tus inversiones ni tus metas."
  3. `risk.b3` "**Tú decides y el riesgo es tuyo.**" · "No garantizamos resultados. Puedes perder dinero."
  - Recuadro gris `risk.legal.k` "El aviso, palabra por palabra" + enlace "Leer aviso completo" (abre `/uso-aceptable#avisos` en `Sheet`) y **el texto exacto de `aceptacion-ux.md` §6** con `{Herramienta}`="Señales": "Señales da **información general** generada con IA, igual para todos los usuarios de tu plan. **No es asesoría financiera, de inversión ni de apuestas**, no es una recomendación personal para ti y no toma en cuenta tus saldos, posiciones ni objetivos. No garantizamos resultados y **puedes perder todo tu dinero**. Chalyb no es asesor en inversiones registrado ante la CNBV, ni casa de bolsa, exchange o casa de apuestas."
  - `Checkbox` **desmarcada**: `risk.check` "Entiendo y acepto que las decisiones y los riesgos son míos."
  - `btn-xl` `risk.cta` "Entendido, continuar" (deshabilitado hasta marcar) · `risk.hint` "Marca la casilla para continuar. Solo te lo pedimos esta vez."
- **Por qué los 3 puntos *y* el texto completo:** los puntos hacen que se entienda; el texto completo es el que exige `aceptacion-ux.md` §6 y el que queda en la evidencia. **Quitar el recuadro legal solo si el abogado aprueba que los 3 puntos lo sustituyen** (pregunta abierta Q3).
- **Servidor:** `POST /api/consent/risk-ack` `{ tool:'chalybcrypto', version }` → `consent_events` tipo `risk_ack_accepted` con `disclosure_text` (hash del texto mostrado), `checkbox_text`, `checkbox_checked=true`, hora UTC, IP cifrada, user-agent (BUILD-SPEC §10.3). **Sin casilla → 422.** El BFF no deja leer `/api/tools/chalybcrypto/*` sin un `risk_ack` vigente (403 → la UI vuelve a mostrar la hoja).
- Cerrar la hoja sin aceptar (Esc / tocar fuera) → vuelve a donde estaba la persona (por defecto Inicio), **nunca** a una pantalla en blanco.

### 5.2 Inicio de Señales · `/app/senales` · mockup **54**
- **Acción principal:** "Ver detalle" de la señal más reciente (botón primario solo en esa tarjeta; las demás usan enlace "Ver detalle ›").
- **Copia:** chips `signals.filter.all` "Todas" + una por moneda elegida (filtran la lista, no cambian contenido) · tarjeta: "{Moneda}" "{SÍMBOLO}" · pill "Nueva" (si no se ha visto) · "{Hoy|Ayer|fecha}, {hora}" · `VerdictPill` · `signals.ref` "Precio de referencia" "{$monto} MXN" · `signals.why` "**Por qué:** {texto corto}" · "Ver detalle"
  - Lateral `signals.alerts` "Mis avisos" [Cambiar → Ajustes]: WhatsApp "Sí/No" · Correo · En la app · Horario "{desde} a {hasta}"
  - Lateral `signals.legend.title` "¿Qué significa cada una?": "Momento de compra" · "El precio va subiendo de forma estable." / "Momento de venta" · "Subió rápido y podría bajar." / "Sin señal clara" · "No hay nada claro por ahora."
  - Pie fijo `signals.disclaimer` (BUILD-SPEC §7.2): "**Esto es informativo, no es asesoría financiera.** Las señales son iguales para todos y no usan tus saldos ni tus inversiones. Tú decides." + "Leer aviso completo"
- **Pestañas:** `signals.tab.home` "Señales" · `signals.tab.history` "Historial" · `signals.tab.settings` "Ajustes"
- **Textos de "Por qué":** frases generales sobre el **precio** ("Lleva varios días subiendo poco a poco, sin saltos bruscos."), jamás sobre la persona. Lista de palabras prohibidas en §8.
- **Estados:**
  - **Primera vez:** sin aviso → 53; con aviso pero sin preferencias → `/app/senales/empezar` (20 → paso 2 → 21).
  - **Vacío:** "Aún no hay señales de tus monedas. Te avisamos en cuanto haya una." (sin botón primario; enlace "Agregar más monedas" → Ajustes).
  - **Cargando:** esqueletos de 3 tarjetas; el pie legal se pinta siempre.
  - **Error parcial:** banner gris "No pudimos traer las señales nuevas. Te mostramos las últimas que teníamos." + [Intentar otra vez]; **error total** → `ToolErrorState` (60).
  - **Gratis (`trial_offer`):** `ToolLockedState` "Señales viene en Pro" · "Pruébalo gratis 7 días. Cancela cuando quieras." · [Empezar mis 7 días gratis] (→ 14; precios: ver PRICING-CARDS-SPEC.md, fuente única). El aviso 53 se pide **después** de activar, no antes.
  - **WhatsApp sin confirmar:** `SetupState` "Te falta confirmar tu WhatsApp" · "Te mandamos un código de 6 números." · [Confirmar ahora].

### 5.3 Detalle de la señal · `/app/senales/[signalId]` · mockup **55**
- **Copia:** Atrás "Señales" · "{Moneda}" "{SÍMBOLO}" · "{fecha}, {hora}" · "Precio de referencia" "{$monto} MXN" · `VerdictPill` · rango `Segmented` "1 día" · "7 días" (predeterminado) · "1 mes" · marca en gráfica "Aquí te avisamos · {hora}" · `signals.detail.why` "Por qué, en palabras simples" (3 puntos del motor, cortos) · `signals.detail.follow` "Recibir avisos de esta moneda" (interruptor) · "Por {canales}" · `signals.detail.same` "Esta misma señal la ven todas las personas de tu plan. No usa tus saldos ni tus inversiones." · pie legal.
- **Acción principal:** el interruptor "Recibir avisos de esta moneda" (agrega/quita la moneda de las preferencias; no cambia la señal).
- **Gráfica:** solo precio pasado. **Prohibido:** líneas de "precio objetivo", "stop", proyecciones, porcentajes de ganancia esperada, flechas al futuro.
- **Estados:** cargando (esqueleto del recuadro) · señal vieja (> 7 días): banda gris "Esta señal es del {fecha_larga}. Puede que ya no aplique." · no encontrada → `EmptyState` + [Ver señales].

### 5.4 Ajustes de Señales · `/app/senales/ajustes` · mockup **56**
- **Grupos:** `signals.settings.coins` "Tus monedas" (chips con ✕ + "Agregar moneda") · "Solo eliges de qué monedas te avisamos. La señal es la misma para todos." · `signals.settings.how` "Cómo te avisamos": WhatsApp (+52 55 •••• {últimos4}) · Correo ({correo}) · En la app ("Una notificación en tu celular") · `signals.settings.when` "Horario": "Avisarme desde" "8:00 a.m." · "Hasta" "10:00 p.m." · "En la noche no te molestamos" · "Días" "Todos los días" · `signals.settings.legal` "Información importante": "Aviso de riesgo" · "Lo aceptaste el {fecha_larga}" · [Leer otra vez] · pie "Los cambios se guardan solos."
- **Opciones avanzadas** (resumen "Temporalidad, resumen diario y formato del aviso"): "Temporalidad" (Corto plazo / Mediano plazo; filtra qué señales recibes, igual para todos) · "Resumen diario" (una vez al día a la hora elegida) · "Formato del aviso" (Corto / Con explicación).
- **Conexión con exchange: no va en Señales.** BUILD-SPEC §11.4 prohíbe ligar Señales con órdenes ("auto-trading ligado a Señales", "copiar automáticamente", "seguir señales"). Un exchange, si existe, vive **solo en Inversiones** (`live:false` hoy), con "**Nunca podemos retirar tu dinero.**", reglas escritas por la persona y el flujo de `aceptacion-ux.md` §7. En Señales no se muestra ni un enlace a "operar".
- **Ninguno de estos campos existe:** saldo, cartera, posiciones, objetivos, "perfil de riesgo", "nivel de riesgo", montos (§11.4).

### 5.5 Aceptación (Señales)
- [ ] **Abuela:** lee el aviso, marca la casilla y entra en ≤ 2 toques; entiende cada tarjeta sin saber qué es "RSI"; cambia "por dónde le avisamos" en ≤ 2 toques (Ajustes → interruptor).
- [ ] **Pro:** llega a "Temporalidad" en ≤ 2 toques desde `/app/senales`.
- [ ] **Prueba de contrato:** el BFF llama `GET /signals` **sin** `userId`; dos usuarios del mismo plan reciben el mismo cuerpo (hash igual).
- [ ] **Prueba de contenido:** ningún texto de Señales contiene las palabras de §8; el pie legal está en 54, 55 e Historial; el aviso 53 genera `risk_ack_accepted` y sin casilla el servidor responde 422.
- [ ] Cambiar la versión del aviso vuelve a mostrar 53 una vez.

---

## 6. En vivo (`chalybobs`) · `/app/en-vivo`

### 6.1 Conectar la computadora (primera vez) · `/app/en-vivo` sin dispositivo · mockup **57**
- **Por qué un programa de ayuda:** controlar OBS desde el navegador requiere dirección, puerto y contraseña de OBS (jerga). Un pequeño programa de escritorio ("programa de En vivo") que se empareja con un código evita todo eso y, si falta OBS, lo instala. *(Confirmar con el dueño cómo se conecta hoy el motor, Q6.)* Alternativa manual (OBS WebSocket: servidor, puerto, contraseña) **solo** en Opciones avanzadas de Ajustes.
- **Copia:** `live.setup.title` "Conecta tu computadora" · `live.setup.sub` "Solo se hace una vez. Toma unos 2 minutos." · `live.setup.obs` "**¿Qué es OBS?** Es el programa gratis que manda la imagen de tu computadora a YouTube o Twitch. Nosotros lo manejamos por ti."
  - Paso 1 (activo) "Ahora" · `live.setup.s1.title` "Descarga el programa de En vivo" · "Ábrelo en la computadora donde transmites. Si no tienes OBS, lo instala por ti." · `btn-xl` "Descargar para Windows" (detecta el sistema; en Mac dice "Descargar para Mac") · "¿Tienes Mac? Descargar para Mac" (o "¿Tienes Windows?…")
  - Paso 2 "Después" · `live.setup.s2.title` "Escribe este código en el programa" · "El programa te lo pide al abrirlo. Así sabemos que es tu computadora." · código de 6 dígitos en 2 grupos de 3 · "Este código sirve por 10 minutos."
  - Paso 3 "Al final" · `live.setup.s3.title` "¡Listo!" · "Cuando se conecte, aquí verás una palomita verde y ya podrás transmitir."
  - Pie: girador + `live.setup.wait` "Esperando tu computadora… Esta página se actualiza sola." · [Hablar con una persona] (verde contorno)
- **Una acción principal:** "Descargar para…". El código se muestra desde el inicio para que la persona lo tenga a la mano.
- **Estados:** esperando (SSE `device.paired`) · **conectado:** el paso 3 se pone verde con ✓ "¡Listo! Tu computadora está conectada." y a los 2 s pasa a la pantalla de transmitir (22) · **código vencido:** "Este código ya venció." + [Ver un código nuevo] · **descarga no inicia:** enlace "¿No empezó la descarga? Descárgalo otra vez." · **ya tenía otra computadora:** se puede tener varias; aparecen en Ajustes.
- **Descarga:** archivo firmado (code signing Windows/Mac notarizado) servido desde el mismo dominio, en la **misma** pestaña.

### 6.2 Transmitir · `/app/en-vivo` · antes: mockup **22** (dentro de `ToolShell`) · durante: mockup **58**
- **Antes de empezar (22):** se usa la pantalla aprobada 22 tal cual, pero dentro de `ToolShell` (sin `WizardShell`): `GiantButton` acento "Iniciar transmisión" · "Empieza en 3 segundos. Puedes detenerla cuando quieras." · escenas · controles rápidos · "Antes de empezar" (Internet, Título) · Opciones avanzadas.
- **Durante (58) – copia:** `LiveStatusBar`: `live.on` "En vivo · {hh:mm:ss}" · "{n} personas viendo" · "{plataformas}" · "Internet {Bueno|Lento|Sin conexión}" · vista previa con etiqueta "EN VIVO" y "Lo que ve tu público" · `live.scenes` "Escenas" · "Toca una para cambiar lo que ve tu público" · escenas predeterminadas "Cámara" ("Solo tú") · "Pantalla" ("En pantalla" cuando está activa) · "Pausa" ("Vuelvo enseguida") · `live.stop` "Terminar transmisión" (`GiantButton` rojo) · "Te preguntamos antes de terminar." · `BigToggle` "Micrófono" "Encendido|Apagado" · "Cámara" "Encendida|Apagada" · `live.clipNow` "Hacer clip de este momento" · "Guarda el último minuto en Clips." · Opciones avanzadas "Calidad, servidores y atajos".
- **Acción principal:** "Terminar transmisión" (es lo único que puede salir mal si no se encuentra rápido).
- **Terminar:** hoja `live.stop.confirm.title` "¿Terminar tu transmisión?" · "Tu público dejará de verte." · [Sí, terminar] (`btn-dark`, mismo tamaño) · [Seguir transmitiendo] (`btn-primary`). Después: "Tu transmisión terminó · Duró {duracion}." + [Hacer clips de esta transmisión] (→ Clips con la grabación ya elegida) · [Ver mis transmisiones].
- **"Hacer clip de este momento" (sinergia del kit):** `POST /api/tools/chalybclip/jobs/from-live` con `{ streamId, atS: ahora, windowS: 60 }` → aviso en pantalla "Listo, guardamos este momento. Lo verás en Clips en unos minutos." → aparece en "En proceso" de 50. Requiere grabación activa ("Guardar la grabación" encendido o VOD de la plataforma); si no, el botón explica "Para hacer clips en vivo, enciende Guardar la grabación en Ajustes." No gasta créditos hasta que el clip esté listo.
- **Estados:** computadora apagada/desconectada → `SetupState` "Tu computadora no está conectada" · "Abre el programa de En vivo en tu computadora." · [Volver a intentar] · sin destino elegido → "Elige dónde transmitir" [Ir a Ajustes] · internet lento → pill ámbar "Lento" + "Bajamos la calidad para que no se corte." (solo si calidad = Automática) · error al iniciar → "No pudimos iniciar tu transmisión. Revisa que {plataforma} siga conectada." [Intentar otra vez] [Hablar con una persona] · se cae la conexión durante → banda roja "Se perdió la conexión con tu computadora. Tu transmisión puede seguir en OBS." [Volver a conectar] · Gratis → `ToolLockedState` "En vivo viene en Pro".
- **Pestañas:** `live.tab.stream` "Transmitir" · `live.tab.history` "Mis transmisiones" · `live.tab.settings` "Ajustes".

### 6.3 Ajustes de En vivo · `/app/en-vivo/ajustes` · mockup **59**
- **Copia:** `live.settings.where` "Dónde transmites": YouTube "@{usuario} · conectado" (interruptor = transmitir ahí) · Twitch · Kick "Conectar" · Facebook "Conectar" · "Puedes transmitir en varias a la vez." · `live.settings.device` "Tu computadora": "{nombre}" "OBS listo · {sistema}" "Conectado" (con opción "Desconectar" dentro) · `live.settings.quality` "Calidad": "Automática" pill "Recomendada" "Se ajusta sola a tu internet." (predeterminada) · "Alta" "Para internet muy rápido." · "Ahorro" "Si tu internet es lento o usas datos." · `live.settings.after` "Al terminar": "Hacer clips al terminar" "Te llegan a Clips" (y "Guardar la grabación") · nota con candado `live.settings.keyNote` "Tu clave de transmisión está oculta por seguridad. Solo se ve en Opciones avanzadas."
- **Opciones avanzadas** (resumen "Bitrate, servidores, atajos y clave de transmisión"): bitrate (kbps), resolución y fps, servidor de ingesta por plataforma, **clave de transmisión** (enmascarada `••••••••`; "Mostrar" pide confirmar la contraseña o volver a iniciar sesión; nunca se registra en logs ni se manda al navegador hasta que se pide), atajos de teclado, conexión manual a OBS WebSocket.
- Conectar una plataforma usa `ConnectAccountSheet` con el texto de `aceptacion-ux.md` §7 ("Vas a conectar tu cuenta de {plataforma}. Chalyb podrá ver tus videos y **publicar solo cuando tú lo indiques**… [Conectar {plataforma}]") y registra `social_connect` en `consent_events`.

### 6.4 Aceptación (En vivo)
- [ ] **Abuela:** conecta su computadora sola en ≤ 2 minutos (descargar → escribir 6 números); inicia, cambia de escena y termina sin leer ayuda; encuentra "Terminar" en < 3 s.
- [ ] **Pro:** llega a bitrate / clave de transmisión en ≤ 2 toques desde `/app/en-vivo` (Ajustes → Opciones avanzadas).
- [ ] "Hacer clip de este momento" crea un trabajo visible en `/app/clips` en < 5 s.
- [ ] La clave de transmisión no aparece en el HTML, en logs ni en respuestas del BFF salvo al pulsar "Mostrar".

---

## 7. Compartido

### 7.1 Cuando una herramienta no abre · `ToolErrorState` · mockup **60**
Reemplaza a la página actual con "Abrir" + "No pudimos abrir {X} en este momento" (F1). Va **dentro** de `ToolShell` (el encabezado y las pestañas siguen).
- **Copia (genérica, `{Herramienta}` = Clips / Señales / En vivo):** ícono de enchufe (fondo `--warn-tint`) · `tool.error.title` "{Herramienta} no abrió esta vez" · `tool.error.body` "Algo falló de nuestro lado, no es tu culpa. Lo que ya hiciste está guardado." · [Intentar otra vez] (`btn-primary`, único primario) · [Hablar con una persona] (verde contorno) · **solo si `tool_status[slug].incident_active`**: pill ámbar `tool.error.known` "Ya nos avisaron, lo estamos arreglando." · `tool.error.code` "Si nos escribes, menciona este código: **{supportCode}**" · bajo la tarjeta, según la herramienta: Clips "Mientras tanto, tus clips anteriores siguen en [Mis resultados]." · Señales "Mientras tanto, las últimas señales siguen en [Historial]." · En vivo "Si ya estabas transmitiendo, tu transmisión sigue en OBS."
- **Reglas:** "Lo que ya hiciste está guardado" solo si de verdad hay borrador/estado guardado; si no, se omite esa frase. "Intentar otra vez" reintenta en el lugar (sin recargar toda la app) con estado "Intentando…"; después de 3 intentos fallidos el botón principal pasa a ser "Hablar con una persona". Sin `incident_active` **no** se muestra la pill (nunca prometer algo que no es cierto).
- Cada vez que se muestra: evento en Actividad con `slug`, `reason`, `supportCode`.

### 7.2 Tus herramientas · `/app/herramientas` · mockup **61**
- **Copia:** migaja "Inicio ›" · `tools.title` "Tus herramientas" · `tools.sub.pro` "Todas están incluidas en tu plan Pro y se abren aquí mismo." · 3 tarjetas grandes (Clips, Señales, En vivo) con ícono de color, pill "Incluido en tu plan", la frase de `TOOLS` (BUILD-SPEC §8.1 / `more_shared.py`), una línea de estado real y [Abrir] (navega dentro de la app):
  - Clips: "{n} en proceso · {m} listos {cuándo}" / "Aún no tienes clips"
  - Señales: "{n} señal(es) nueva(s) hoy" / "Sin señales nuevas hoy"
  - En vivo: "Te falta un paso: conectar" (punto ámbar) / "Listo para transmitir" / "Transmitiendo ahora"
- **"También incluido":** fila de tarjetas ligeras (ícono 46 px, nombre, "Abrir ›") **solo con las herramientas `live:true`** que no sean las 3 principales. Si no hay ninguna, la sección no existe (hoy no se muestra). En el mockup aparece con la etiqueta "Ejemplo · solo si están activas"; esa etiqueta no va en producción.
- **Gratis:** mismas tarjetas con el estado `trial_offer` de BUILD-SPEC §7.4 / mockup 23 (pill "Incluido en Pro" + "Pruébalo gratis"); Clips sigue con "Abrir".

---

## 8. Requisitos legales que aplican (de BUILD-SPEC §11 y `legal/aceptacion-ux.md`)
| Regla | Dónde aplica aquí | Cómo se cumple / prueba |
|---|---|---|
| §11.4 Señales iguales para todos; no usar saldos, posiciones, objetivos ni perfil de riesgo | 54, 55, 56, BFF | `GET /signals` sin `userId`; no existen esos campos; prueba de contrato (§5.5) |
| §11.4 Prohibido "copiar automáticamente", "seguir señales", auto-trading ligado a Señales | 54–56 | No hay exchange en Señales; prueba de contenido |
| §11.4 Sin consejo personal ni promesas | Textos de señales, "Por qué", WhatsApp, correos, notificaciones | **Palabras prohibidas** (escaneo del bundle, plantillas y respuestas del motor antes de mostrarlas): "te conviene", "deberías", "tu cartera", "tus ganancias", "si ya ganaste", "garantizado", "seguro que", "sin riesgo", "ganancia asegurada", "rendimiento de", "% de ganancia", "objetivo de precio", "precio objetivo", "copiar", "invierte ahora", "no te lo pierdas". Si una explicación del motor contiene alguna, se reemplaza por "Ver detalle" y se registra el caso |
| §11.4 "Esto es informativo, no es asesoría financiera" siempre | 54, 55, Historial, aviso de WhatsApp/correo/app (`notif.signal`) | `DisclaimerFooter` + pie en cada mensaje |
| `aceptacion-ux.md` §6 aviso de riesgo con casilla, una vez por herramienta y versión | 53 | Texto exacto + casilla desmarcada + 422 sin casilla + `risk_ack_accepted` |
| §11.4 Divulgar afiliaciones con exchanges | Señales (pie) si algún día hay enlaces de afiliado | Hoy no hay; si se agregan: "Chalyb recibe una comisión de {exchange}" visible |
| `aceptacion-ux.md` §7 conectar redes | 50, 52, 59 (`ConnectAccountSheet`) | Texto antes de OAuth + `social_connect` |
| `aceptacion-ux.md` §7 publicación automática | 52 Opciones avanzadas | Casilla de responsabilidad + `autopublish_enabled` |
| §11.6 Voz e imagen con IA | Clips, En vivo | **No se construye.** Si aparece: Opciones avanzadas + `ai.likeness.*` + `voice_likeness_consent` |
| Uso aceptable y contenido (`legal/uso-aceptable-y-contenido.md`) | Clips (contenido de terceros), En vivo | Nota en paso 1 (02) ya aprobada; no se agrega copia nueva. Pregunta Q8 sobre clips de streams ajenos |
| §0.3 Nunca "próximamente"/"beta"; nada sin terminar visible | 61 "También incluido", Inicio | Solo `live:true`; prueba automática de cadenas |
| §11.9 Sin aceptación por simple uso | 53 | La hoja exige casilla; abrir Señales no cuenta como aceptación |
| Privacidad (Aviso §datos) | Teléfono WhatsApp, correo | Se muestran enmascarados; la entrega la hace la app principal, el motor nunca recibe teléfono ni correo |
| §11.5 Pronósticos | — | No aplica (no está `live`) |

---

## 9. Lista de arreglos para las fallas de hoy
| # | Falla observada | Causa probable (verificar) | Arreglo |
|---|---|---|---|
| **F1** | Clips: "No pudimos abrir Clips en este momento" al tocar Abrir | El handoff a la app del motor falla: variable de entorno de URL/secretos del motor faltante en producción, token de SSO vencido o rechazado, CORS/cookies de terceros, o el motor caído | (1) Quitar el handoff y el botón "Abrir"; `/app/clips` se pinta nativo (50) llamando al BFF. (2) Health check de `chalybclip` en el despliegue (prueba de humo de BUILD-SPEC §4.1 B3). (3) Si el motor no responde, `ToolErrorState` (60) con `supportCode`. |
| **F2** | Señales: "Antes de abrir Señales, lee el aviso y acéptalo." sin aviso visible | La revisión del aviso existe, pero el modal nunca se construyó (o se renderiza detrás del banner de cookies / en la otra app) | Hoja 53 en `/app/senales` con texto exacto §6, casilla y `POST /api/consent/risk-ack`; el BFF exige el `risk_ack` vigente. Prueba E2E: cuenta nueva → acepta → ve 54. |
| **F3** | En vivo abre `about:blank` | Patrón `const w = window.open(''); const url = await getHandoffUrl(); w.location = url` donde la URL llega vacía/undefined o la promesa falla y la ventana nunca navega; o `NEXT_PUBLIC_*_URL` de En vivo vacía | Eliminar `window.open`. `/app/en-vivo` pinta 57/22/58 nativo. Agregar regla de lint/CI: **ningún** `window.open` ni `target="_blank"` en `app/(app)/**` (excepto lista blanca de descargas). |
| **F4** | Copia "{Herramienta} se abre en una pestaña nueva." | Diseño anterior | Borrar la cadena y la llave; prueba de contenido que falle si reaparece "pestaña nueva". |
| **F5** | La barra lateral no llega al fondo (fondo gris debajo, se ve en las 3 capturas a 1024×~700) | `AppShell` con alto fijo/`min-height` en el `aside` en vez de `height:100vh` + `position:sticky`, o el contenedor no es `display:flex` a alto completo | `aside{position:sticky;top:0;height:100dvh}` y `.app{min-height:100dvh;display:flex}`; captura de regresión a 1024×700 y 1440×900. |
| **F6** | El banner de cookies tapa el contenido y los botones (Señales, En vivo) | Banner flotante centrado sobre el área de trabajo | Banner fijo abajo, a lo ancho del área de contenido (sin tapar la barra lateral), con espacio reservado (`padding-bottom`) mientras esté visible; nunca encima de un botón primario. Texto y opciones de `aceptacion-ux.md` §9 sin cambios. |
| **F7** | Inicio muestra 3 tarjetas en rejilla de 2×2 con un hueco | La 4ª tarjeta ("Más herramientas") se ocultó pero la rejilla no se ajustó | Con 3 tarjetas: la 3ª ocupa el ancho completo (o rejilla de 3 columnas). La 4ª solo aparece si hay herramientas `live:true` extra (y lleva a 61). |
| **F8** | Tarjeta de usuario muestra "qachalybprojgf…" (correo truncado) | No hay `nombre` y se usa el correo | Usar `nombre` del perfil; si falta, pedirlo una vez ("¿Cómo te llamamos?") y mientras tanto mostrar solo "Tu cuenta". |
| **F9** | Los íconos de Señales y En vivo salen morados | Se usa `--accent` para todas | Usar el color de cada herramienta del registro (`#FF9F0A`, `#FF375F`) en el cuadro del ícono (BUILD-SPEC §1.1). |
| **F10** | Los 3 errores dependen de la otra app; el dueño no se entera | No hay health check ni registro | `tool_status` + evento en Actividad + alerta al dueño cuando `down` > 5 min; eso habilita `incident_active`. |

---

## 10. Criterios de aceptación globales
- [ ] **Ninguna pestaña nueva:** E2E recorre Inicio → cada herramienta → cada pestaña → detalle → ajustes y verifica `context.pages().length === 1` todo el tiempo. Lint/CI sin `window.open` / `target="_blank"` en `/app`.
- [ ] Las 6 redirecciones de §2 responden 307/308 a la ruta correcta y conservan query string.
- [ ] Cada pantalla de herramienta tiene: barra lateral visible, encabezado con ícono de color + nombre + pill, **≤ 3 pestañas**, **1 botón primario** (prueba: contar `.btn-primary`/`GiantButton` visibles = 1 por vista, salvo tarjetas de lista).
- [ ] Todos los estados (vacío, cargando, procesando, error, bloqueado/Gratis, primera vez, falta un paso) tienen fixture y captura (Storybook o Playwright) en 1440×900 y 390×844.
- [ ] Ningún texto: "próximamente", "beta", "Disponible", "Requiere Pro", "pestaña nueva", "engine(s)", "motor", "ChalyClip", "chalybcrypto", "chalybobs", "OBS controller", ni las palabras prohibidas de §8.
- [ ] **Prueba de la abuela global:** una persona de 70 años, sin ayuda, (a) hace y descarga un clip, (b) acepta el aviso y lee una señal, (c) conecta su computadora e inicia/termina una transmisión — cada tarea sin scroll para encontrar el botón principal.
- [ ] **Prueba del profesional global:** desde la pantalla principal de cada herramienta, cualquier opción avanzada está a ≤ 2 toques; el estado abierto/cerrado de "Opciones avanzadas" se recuerda.
- [ ] Con el motor apagado (mock), cada herramienta muestra 60 con `supportCode` y el evento llega a Actividad; con `incident_active=true` aparece la pill, con `false` no.
- [ ] Accesibilidad (BUILD-SPEC §0.10): pestañas con `role="tablist"`/`aria-selected`, manijas de recorte operables con teclado, `GiantButton` con `aria-live` del contador, contraste AA.

---

## 11. Índice de mockups (nuevos)
| # | Archivo | Pantalla | Ruta |
|---|---|---|---|
| 50 | `mockups/50-clips-home.png` | Inicio de Clips: Hacer clips nuevos, En proceso, últimos clips, cuentas | `/app/clips` |
| 51 | `mockups/51-clips-detalle.png` | Detalle del clip: reproductor, título, subtítulos, recortar, formato, Descargar | `/app/clips/[clipId]` |
| 52 | `mockups/52-clips-ajustes.png` | Ajustes de Clips: cuentas, subtítulos, estilos, logo, avanzadas cerradas | `/app/clips/ajustes` |
| 53 | `mockups/53-senales-aviso.png` | Aviso de riesgo una vez: 3 ideas + texto exacto + casilla | hoja sobre `/app/senales` |
| 54 | `mockups/54-senales-home.png` | Inicio de Señales: tarjetas, chips por moneda, Mis avisos, pie legal | `/app/senales` |
| 55 | `mockups/55-senales-detalle.png` | Detalle de señal: gráfica simple, por qué, recibir avisos | `/app/senales/[signalId]` |
| 56 | `mockups/56-senales-avisos.png` | Ajustes de Señales: monedas, cómo, horario, aviso | `/app/senales/ajustes` |
| 57 | `mockups/57-envivo-conectar.png` | Conectar la computadora en 3 pasos con código de 6 dígitos | `/app/en-vivo` (sin dispositivo) |
| 58 | `mockups/58-envivo-control.png` | Cuarto de control en vivo: Terminar, escenas, micrófono/cámara, clip | `/app/en-vivo` (transmitiendo) |
| 59 | `mockups/59-envivo-ajustes.png` | Ajustes de En vivo: destinos, calidad, al terminar, avanzadas | `/app/en-vivo/ajustes` |
| 60 | `mockups/60-tool-no-abre.png` | Herramienta que no abre (genérico) | cualquier herramienta |
| 61 | `mockups/61-herramientas.png` | Tus herramientas: 3 tarjetas + "También incluido" | `/app/herramientas` |
| 62 | `mockups/62-overview-herramientas.png` | Hoja de contacto 50–61 | — |
Reutilizadas: 02–06 (asistente de Clips), 20–21 (primera activación de Señales), 22 (En vivo antes de transmitir, ahora dentro de `ToolShell`), 19 (tarjetas de historial), 23 (estado Gratis), 24 (vacío / falta un paso).

**Orden sugerido:** F5–F9 (1 PR chico) → `config/tools.ts` + `ToolShell` + redirecciones + `ToolErrorState` (las 3 rutas dejan de abrir pestañas el mismo día, aunque sea mostrando 60) → Señales 53 (desbloquea F2) → Clips 50/51/52 → En vivo 57/58/59 → 61.

---

## 12. Preguntas abiertas para el dueño
| # | Pregunta | Por qué importa | Default mientras tanto |
|---|---|---|---|
| Q1 | ¿Los motores (`chalybclip`, `chalybcrypto`, `chalybobs`) tienen API que la app pueda llamar desde el servidor, o solo su propia interfaz? ¿Dónde están desplegados y quién los mantiene? | Define si vamos por la opción B ya o con el puente temporal de §1.1 | Opción B; puente solo si no hay API |
| Q2 | Capturas o acceso a las interfaces reales de cada motor | Los mockups se hicieron por intención de producto; hay que mapear funciones reales a 50–59 | Diseñar con el contrato de §1.3 |
| Q3 | ¿El abogado acepta los 3 puntos del aviso (53) como resumen *además* del texto completo? ¿O quiere solo el texto? | El texto §6 es obligatorio; los puntos son adicionales | Puntos + texto completo |
| Q4 | ¿Cambiamos en toda la app "Buen momento para comprar/vender" / "Mejor espera" (19, 21, 26) por "Momento de compra" / "Momento de venta" / "Sin señal clara" (54–55)? | Consistencia; la nueva forma es menos valorativa (más "información", menos "consejo") | Usar la nueva en 53–56 y proponer el cambio global tras visto bueno legal |
| Q5 | ¿"Precio de referencia" en MXN, USD o ambos? ¿De qué fuente y con qué retraso? | Exactitud y transparencia | MXN, con fuente y hora en el detalle |
| Q6 | ¿Cómo se conecta hoy `chalybobs` con OBS (programa propio, OBS WebSocket directo, otro)? ¿Existe ya un programa de escritorio firmado para Windows/Mac? | 57 asume un programa de ayuda con código de emparejamiento | Programa de ayuda; manual en avanzadas |
| Q7 | ¿Se puede leer "personas viendo" de YouTube/Twitch con los permisos que ya pedimos? | 58 muestra espectadores | Ocultar el dato si no hay permiso |
| Q8 | ¿Se permiten clips de streams de terceros (no del usuario)? | Derechos de autor / Uso aceptable | Solo contenido propio o con permiso (texto ya aprobado) |
| Q9 | ¿Qué herramientas además de las 3 están listas para `live:true`? | "También incluido" (61) y la 4ª tarjeta de Inicio | Ninguna |
| Q10 | ¿Quién recibe las alertas de herramienta caída y en cuánto tiempo responde? | Solo así es verdad "Ya nos avisaron, lo estamos arreglando" | Pill apagada hasta tener alerta real |
| Q11 | ¿Créditos por clip y por clip en vivo? ¿"Hacer clip de este momento" cuesta lo mismo? | Copia de créditos y errores | Mismo costo que un clip normal, solo al terminar |
| Q12 | ¿Hay afiliación o comisión con algún exchange? | §11.4 exige divulgarla | Ninguna |
