# Chalyb · BUILD-SPEC del rediseño completo (para Claude Code)

> Plan para implementar el rediseño en el código real de Chalyb (Next.js: área de suscriptor `/app`, panel del dueño `/dashboard`, acceso `/sign-in`, pagos con Mercado Pago).
> Mockups: `mockups/01-…30-*.png` (vista general en `mockups/09-overview-completo.png`). HTML de referencia en `html/` (generado con `build.py` + `more_*.py` y capturado con `render.py`).
> **Precios: ver PRICING-CARDS-SPEC.md (fuente única)** (montos, prueba de 7 días solo Pro, insignia, pies de IVA). Textos de cobro y prueba: `trial-to-paid-path.md` y **`legal/aceptacion-ux.md` (manda en todo lo legal)**. Documentos legales: `legal/` (hallazgos en `legal/REVISION-LEGAL.md`). **Los requisitos legales obligatorios están en §11.**

---

## 0. Reglas que aplican a todo

1. **Solo cambian los nombres que ve el cliente.** Las rutas internas, los slugs de código, los nombres de tablas, los feature flags y las variables de entorno **no se renombran** (por ejemplo, si el código dice `chalyclip`, `engine`, `tokens` o `NEXT_PUBLIC_*`, se queda así). Las rutas de abajo son **propuestas para pantallas nuevas**. Si ya existe una ruta que hace lo mismo, se usa la existente y solo se cambia lo que se ve.
2. **"Chalyb" solo aparece como logo.** Las herramientas se llaman **Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones**, sin prefijos ("ChalyClip", "Chalyb Señales", etc.).
3. **Vendemos como producto establecido.** Prohibido en la interfaz: "próximamente", "beta", "en construcción", "Disponible" como estado de bloqueo, "coming soon" o "WIP". Una herramienta sin terminar **no se muestra**. Nunca se muestra una tarjeta que lleve a un callejón sin salida.
4. **Palabras simples** (ver glosario §3): créditos, herramientas, conectar, transmisión.
5. **Prueba de la abuela (grandma test):** una persona de 70 años, sin conocimientos técnicos, termina la tarea sola, sin ayuda, sin leer instrucciones y sin hacer scroll para encontrar el botón principal. Cada pantalla tiene **una sola acción principal** (botón de 60–68 px) y una frase que explica qué pasa después.
6. **Prueba del profesional (pro test):** un YouTuber profesional encuentra lo avanzado en **≤ 2 toques** desde la pantalla de la herramienta, siempre detrás de **"Opciones avanzadas"** (cerrado por defecto, recuerda su estado por usuario).
7. **Asistentes (wizards) de 3 pasos:** ocultan la navegación; muestran **Atrás** (izquierda), título de la herramienta (centro), **cerrar ✕** (derecha) y debajo la barra **"Paso X de 3"**. Cerrar vuelve a Inicio sin perder lo capturado (borrador guardado).
8. **Fechas** siempre en palabras ("30 de octubre de 2026") en la zona horaria del usuario (por defecto `America/Mexico_City`); guardar en UTC.
9. **Precios** siempre en MXN y con IVA incluido (ver §0.1).
10. **Accesibilidad:** contraste AA mínimo; texto de cobro ≥ 14 px (usamos 17–18 px); objetivos táctiles ≥ 48 px; foco visible; todo usable con teclado; `lang="es-MX"`.

### 0.1 Precios e IVA
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Resumen (no copiar montos de aquí al código): Pro $997 MXN al mes · Pro anual $9,970 MXN al año · VIP $3,799 MXN al mes · VIP anual $36,325 MXN al año · Pro Lealtad (precio por meses, §15 de ese archivo). Son **totales con IVA incluido** (`PRICES_INCLUDE_IVA=true`); pie "Precios en MXN, IVA incluido." Todos los montos salen de **una sola configuración** (`src/config/pricing.ts`); ningún monto escrito a mano.

---

## 1. Tokens de diseño (sacados de `html/style.css` y de la capa compartida `SH` en `more_shared.py`)

### 1.1 Colores
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F5F5F7` | Fondo de toda la app |
| `--card` | `#FFFFFF` | Tarjetas, grupos, hojas |
| `--ink` | `#1D1D1F` | Texto principal |
| `--ink2` | `#5E5E66` | Texto secundario |
| `--ink3` | `#8E8E96` | Texto terciario, metadatos |
| `--line` | `#E6E6EB` | Separadores |
| `--accent` | `#5B4BFF` | Acción principal, selección, marca |
| `--accent-d` | `#4A3AE8` | Hover/pressed del acento |
| `--tint` | `#EFEDFF` | Fondo de íconos y estados seleccionados |
| `--tint2` | `#F6F5FF` | Franjas suaves (banners tranquilos, avisos) |
| `--ok` | `#1FA855` | **Solo** "listo/hecho/conectado" y **ayuda humana** |
| `--ok-tint` | `#E6F6EC` | Fondo de "listo" |
| `--warn` | `#A65A00` (fondo `#FFF3DF`, borde `#FFD999`) | Avisos ámbar (últimos 7 días, "Lento hoy", "Buen momento para vender") |
| `--bad` | `#D70015` (fondo `#FFEDEE`, borde `#FFC9CD`) | Pago pendiente, cobros fallidos, acciones destructivas |
| Ejemplo | `#8E6A00` sobre `#FFF6D6`, borde punteado `#E8C55A` | Etiqueta "Ejemplo" en datos de muestra (admin) |
| Logo | gradiente `140deg #7B6CFF → #5B4BFF → #3F2FE0` | Marca |
| Tarjeta de plan | gradiente `135deg #6B5CFF → #5B4BFF → #4632E6` | "Tu plan", CTA final de landing |
| Colores de herramienta | Clips `#5B4BFF`, Señales `#FF9F0A`, En vivo `#FF375F`, Asistente `#30B0C7`, Pronósticos `#34A853`, Inmuebles `#0A84FF`, Inversiones `#AF52DE`, Idea `#E8A600` | Solo en el cuadro del ícono |

Regla: el verde no se usa para "comprar", ni para precios, ni para decorar.

### 1.2 Radios y sombras
- Tarjetas: `--r: 22px` (rango 20–24 px); hojas/modales 28 px; tarjetas grandes de landing 24–32 px.
- Grupos tipo iOS (`.group`): 20 px. Inputs: 16 px (dentro del formulario de Mercado Pago, 12 px). Botones: 16 px (normal) / 18 px (XL). Chips y pills: 999 px. Íconos de herramienta: 16–20 px.
- `--shadow: 0 1px 2px rgba(16,16,40,.04), 0 6px 24px rgba(16,16,40,.06)`
- `--shadow-lg: 0 2px 4px rgba(16,16,40,.04), 0 18px 48px rgba(16,16,40,.10)`
- Seleccionado: `box-shadow: 0 0 0 2–3px var(--accent), var(--shadow-lg)`.

### 1.3 Tipografía
Familia: `-apple-system, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif` (Inter como fuente web). `letter-spacing: -0.011em`, `font-feature-settings: "cv11","ss01"`.
| Rol | Tamaño / peso / interlineado |
|---|---|
| Hero de landing | 66 px / 700 / 1.04, tracking −0.045em (móvil 40 px) |
| Título de sección de landing | 44 px / 700 (móvil 30 px) |
| `h1` de pantalla | **40 px** / 700 / 1.12, tracking −0.03em (móvil 29–34 px) |
| `h2` | 26 px / 650 / 1.2 |
| Título de tarjeta | 20–24 px / 650–700 |
| Cuerpo | **18 px** base; subtítulos `.sub` 20 px; textos de tarjeta 17–19 px |
| Metadatos | 15–16 px (nunca menos de 14 px; los textos de cobro van a 17–18 px) |
| Eyebrow / label | 14 px / 700 / mayúsculas, tracking .06em, color acento |
| Navegación lateral | 20 px / 500 (activo 600) |

### 1.4 Espaciado y layout
- Escala: 4 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 24 · 28 · 36 · 48 · 56 · 64 · 88 px.
- Escritorio 1440×900: barra lateral **272 px** (fondo `#FBFBFD`, borde derecho `--line`), contenido con padding `52px 64px 40px`, ancho máximo `.wrap` 1040 px.
- Asistente: barra superior de 84 px; barra de pasos de 3 segmentos de 72×8 px (gap 8 px) + "Paso X de 3" en 16 px/600; columna central de 760–1000 px.
- Móvil 390×844: barra de estado 50 px, márgenes laterales 16–20 px, barra de pestañas inferior de 88 px (fondo translúcido con desenfoque) con 3 pestañas: Inicio / Resultados / Cuenta.
- Rejillas: tareas de Inicio 2×2 (gap 22 px); herramientas 4 columnas (gap 18–20 px); resultados 3 columnas.

### 1.5 Botones y controles
| Componente | Medidas |
|---|---|
| `btn` | 60 px de alto, padding 0 28 px, radio 16 px, 19 px/600 |
| `btn-xl` (acción principal de pantalla) | **68 px**, 21 px, radio 18 px, ancho completo (máx. 520 px en asistentes) |
| Botón gigante (En vivo "Iniciar transmisión") | 100 px, 28 px/700, radio 24 px |
| Botón de tarjeta compacto | 46–54 px, 17 px |
| `btn-primary` | acento con sombra `0 6px 18px rgba(91,75,255,.32)` |
| `btn-secondary` | blanco, texto acento, borde interior 1.5 px `#DAD6FF` |
| `btn-gray` | `#EBEBF0`, texto `--ink` |
| `btn-dark` | `--ink`, texto blanco (solo "Sí, cancelar", mismo peso que el primario) |
| `btn-danger` | blanco, texto `--bad`, borde `--bad-line` |
| `btn-ok` | verde, solo para "Hablar con una persona / WhatsApp" |
| Chips de filtro | 46–48 px, radio 999; activo = fondo `--ink` y texto blanco |
| Interruptor | 56×34 px; encendido = acento |
| Input | 52–62 px de alto, radio 16 px, borde 1.5 px `#DCDCE3`; foco = 2 px acento + halo de 5 px `rgba(91,75,255,.12)` |
| Casilla | 28×28 px, radio 8 px, **siempre desmarcada por defecto** |
| Atrás | pastilla de 48 px blanca con chevron acento |
| Cerrar | círculo de 48 px blanco |

### 1.6 Inventario de componentes (crear en `components/ui/`)
`AppShell` (barra lateral 3 ítems + tarjeta de usuario) · `MobileTabBar` · `WizardShell` (Atrás / título / ✕ / `StepBar`) · `PublicNav` · `PublicFooter` · `Card` · `Group`+`Row` (lista estilo iOS con ícono de color, título, subtítulo, valor, chevron) · `Button` (primary/secondary/gray/dark/danger/ok/white, tamaños md/xl/giant) · `Chip` · `Pill` (ok/acc/warn/bad/gray/dark) · `Switch` · `Segmented` · `Field` · `Checkbox` · `ToolIcon` · `Thumb` (marco de video con gradiente, sin fotos) · `Avatar` (iniciales con gradiente) · `Banner` (trial/warn/gray/bad) · `DisclosureBlock` · `Sheet`/`Modal` · `EmptyState` · `ErrorState` · `SetupState` · `AdvancedOptions` (acordeón) · `KpiCard` (con etiqueta "Ejemplo" opcional) · `DataTable` · `ConfirmStep` · `ExampleTag`.

---

## 2. Llaves de texto (i18n)
Todo el texto visible vive en `messages/es-MX.json` (o el sistema i18n existente). En este documento: `llave` → "texto exacto". `{variables}` se sustituyen en el servidor. Las fechas y montos salen de helpers únicos `formatFechaLarga()` y `formatMXN()`.

---

## 3. Glosario (término viejo → término nuevo para el cliente)
| Antes (no usar en UI) | Ahora |
|---|---|
| tokens, saldo de tokens | **créditos** |
| engines, motores, módulos, apps | **herramientas** |
| ChalyClip, ChalybClip, Chalyb Clips | **Clips** |
| Crypto signals, señales Chalyb | **Señales** |
| Stream manager, OBS controller, Chalyb Live | **En vivo** |
| Bot, chatbot, agente | **Asistente** |
| Picks, tips, apuestas | **Pronósticos** |
| Realtor, bienes raíces IA | **Inmuebles** |
| Trade, trading bot | **Inversiones** |
| Dashboard (lado del cliente) | **Inicio** |
| Library, historial, outputs, jobs | **Mis resultados** |
| Settings, perfil, billing | **Mi cuenta** / **Mi plan** |
| Subscription / tier | **plan** |
| Upgrade | **Prueba Pro gratis** (en prueba) / **Subir a VIP** / **Cambiar plan** |
| Disponible / Requiere Pro / candado | **Incluido en tu plan** / **Incluido en Pro · Pruébalo gratis** |
| Onboarding, setup | **Conectar** / **Te falta un paso** |
| Integrations, OAuth, connect account | **Conectar YouTube / Twitch / TikTok** |
| Upload, ingest, source URL | **Pega el enlace** / **Subir un video** |
| Render, processing, queue | **Estamos creando tus clips** |
| Aspect ratio | **Formato** (Vertical / Horizontal / Cuadrado) |
| Captions / SRT | **Subtítulos** |
| Watermark | **Marca de agua / logo** |
| API key | **Acceso API** (solo en Opciones avanzadas) |
| Past due, dunning | **Pago pendiente** |
| Churn, cancel subscription | **Cancelar** |
| Trial | **Prueba gratis / Prueba Pro gratis 7 días** (nunca "mes gratis") |
| Invoice | **Factura (CFDI)** |
| Payment method | **Método de pago / tarjeta** |
| Support ticket | **Hablar con una persona** |
| Notifications | **Avisos** (pantalla) / **Notificaciones** (preferencia) |
| Admin / backoffice | **Panel del dueño** |
| Users / customers (admin) | **Personas** |
| Revenue, MRR, billing (admin) | **Dinero / Ingresos** |
| Logs, events (admin) | **Actividad** |
| Healthy / degraded / down | **Funcionando bien / Lento hoy / No funciona ahora** |

---

## 4. FASE 0 · "Clips funciona de punta a punta" (antes de cualquier rediseño)

**Objetivo:** que cualquier persona en cualquier plan (Gratis, prueba, Pro, VIP) pueda pegar un enlace y recibir clips, y que **ninguna pantalla muestre un estado que contradiga al siguiente**.

### 4.1 Bugs conocidos de QA
| # | Síntoma | Causa probable a investigar | Arreglo esperado |
|---|---|---|---|
| B1 | Gratis ve una tarjeta **"Disponible"** y al abrirla aparece el candado **"Requiere Pro"** | La tarjeta y la página de la herramienta consultan permisos distintos (por ejemplo, un catálogo estático contra una revisión de plan en el servidor) | **Una sola función de permisos** en el servidor `getEntitlements(userId)` → `{ plan, trial, tools: { [slug]: 'included' \| 'trial_offer' \| 'setup_needed' }, credits }`. Tarjetas, rutas, API y workers usan esa misma función. Se eliminan "Disponible" y el candado; para Gratis se muestra el estado `trial_offer` (ver 23). |
| B2 | Pro se queda en **"La configuración quedó incompleta"** con un botón **Abrir** que no hace nada | Un paso de configuración (conexión de red o alta del usuario en la herramienta) falló o no existe y la interfaz no sabe cuál | La configuración pasa a ser **un estado con nombre** (`missing: 'youtube' \| 'obs' \| 'whatsapp' \| …`). La interfaz muestra `SetupState` (24, panel 3) con **un botón que resuelve justo ese paso**. Ningún botón queda sin acción: si no hay a dónde ir, no se muestra. Las herramientas que no necesitan configuración (Clips con enlace pegado) **nunca** quedan bloqueadas por una conexión opcional. |
| B3 | Los clips **no se pueden generar en ningún plan** | Revisar la cadena completa: validación del enlace → descarga/ingesta → cola → worker → almacenamiento → resultado → aviso. Revisar variables de entorno del worker, credenciales de almacenamiento y descuento de créditos | Prueba de humo automática por cada despliegue: un enlace público conocido produce ≥ 3 clips en < 10 min. Si falla, se muestra `ErrorState` con copia clara y **no se descuentan créditos**. |

### 4.2 Trabajo de la fase
1. Escribir pruebas E2E (Playwright) **antes** de arreglar: `gratis`, `trial`, `pro_mensual`, `pro_anual`, `vip`, `past_due` × Inicio → Clips → paso 1 → paso 2 → listos.
2. Implementar `getEntitlements` y reemplazar todas las revisiones de plan dispersas (buscar `isPro`, `plan ===`, `requiresPro`, `locked`, `Disponible`).
3. Normalizar los estados de un trabajo de Clips: `received → finding_moments → adding_captions → ready | failed(reason)`, que alimentan la pantalla 04 (anillo de progreso + lista de 4 pasos).
4. Razones de error con copia (ver 7.6): `link_private`, `link_unsupported`, `video_too_long`, `no_credits`, `platform_down`, `unknown`.
5. Descuento de créditos **solo al terminar con éxito**; reintentos automáticos (máx. 2) antes de mostrar error.
6. Registro de cada fallo en Actividad del panel (Fase 5) con la razón.

### 4.3 Criterios de aceptación de Fase 0
- [ ] En los 6 tipos de cuenta, el flujo Clips termina en "Tus clips están listos" con clips descargables.
- [ ] Ninguna pantalla contiene "Disponible", "Requiere Pro", "configuración quedó incompleta", "próximamente" ni "beta".
- [ ] Cada botón visible lleva a una acción real (prueba automática: ningún `onClick` vacío ni `href="#"`).
- [ ] Gratis ve las herramientas de Pro con "Incluido en Pro · Pruébalo gratis", que lleva a 14 (Tu prueba).
- [ ] Prueba de la abuela: con una cuenta Gratis nueva, pegar un enlace y descargar un clip en ≤ 5 toques después de entrar.
- [ ] Prueba del profesional: en Pro, llegar a "Subir varios videos a la vez" en ≤ 2 toques desde el paso 2.

---

## 5. FASE 1 · Sistema de diseño, estructura y navegación
**Mockups:** 01, 07, 08, 09.

1. Crear los tokens del §1 como variables CSS (o el tema de Tailwind si el proyecto lo usa) **sin tocar** nombres internos que no sean de UI.
2. Construir los componentes del §1.6 con historias/fixtures.
3. `AppShell` de `/app`: barra lateral con **exactamente 3 ítems**: `nav.inicio` "Inicio" · `nav.resultados` "Mis resultados" · `nav.cuenta` "Mi cuenta". Tarjeta inferior: `{nombre_completo}` + `nav.plan.{gratis|prueba|pro|pro_anual|vip}` → "Plan Gratis" / "Prueba Pro" / "Plan Pro" / "Plan Pro anual" / "Plan VIP".
4. Móvil: `MobileTabBar` con `tab.inicio` "Inicio", `tab.resultados` "Resultados", `tab.cuenta` "Cuenta"; campana de Avisos arriba a la derecha.
5. `WizardShell` para todos los flujos de herramienta y de prueba.

### 5.1 Inicio · `/app` · mockup **01** (escritorio) y **08** (móvil)
- **Para qué:** elegir qué hacer hoy, en un toque.
- **Componentes:** saludo, 4 tarjetas de tarea grandes (la primera resaltada), franja "Todo incluido", bloque "Lo último".
- **Copia:**
  - `home.greeting` "Hola, {nombre} 👋" · `home.title` "¿Qué quieres hacer hoy?"
  - `home.task.clips` "Clips" · "Hacer clips de mi stream" · "Crea clips cortos listos para TikTok, Reels y Shorts." (móvil: "Para TikTok, Reels y Shorts.")
  - `home.task.senales` "Señales" · "Recibir señales de cripto" · "Te avisamos cuándo comprar o vender, en tu celular." (móvil: "Te avisamos cuándo comprar o vender.")
  - `home.task.envivo` "En vivo" · "Manejar mi transmisión" · "Controla tus escenas de OBS desde un solo lugar." (móvil: "Controla OBS desde tu celular.")
  - `home.task.mas` "Y mucho más" · "Más herramientas" · "Asistente, Pronósticos, Inmuebles e Inversiones." (móvil: "Asistente, Pronósticos y más.")
  - `home.included.pro` "**Todo incluido en tu plan Pro.** Sin pagos extra." · `home.included.gratis` "**Prueba Pro gratis 7 días.** Todas las herramientas incluidas." + botón "Empezar mis 7 días gratis"
  - `home.latest.title` "Lo último" · `home.latest.all` "Ver todo" · `home.latest.clips` "Tus {n} clips están listos" · `home.latest.from` "De tu stream “{titulo}” · {hace}" · `home.latest.cta` "Ver mis clips"
- **Estados:** vacío (se oculta "Lo último" y se muestra `empty.clips` de 7.6) · cargando (esqueletos de tarjeta, sin girador a pantalla completa) · error (banner gris "No pudimos cargar tus resultados." + "Intentar otra vez") · Gratis (franja de prueba en vez de "Todo incluido").
- **Aceptación:** abuela identifica la tarea en < 5 s y la abre con 1 toque · pro: "Mis resultados" a 1 toque.

### 5.2 Mi cuenta · `/app/cuenta` · mockup **07**
- **Copia:** `account.title` "Mi cuenta" · `account.plan.k` "Tu plan" · `account.plan.cta` "Ver mi plan" (abre 30) · grupos "Mi plan y pagos", "Mis redes conectadas", "Preferencias", "Ayuda" · `account.credits` "Créditos disponibles" · "Usaste {usados} de {total} este mes" · "Se renuevan el {fecha_corta}" · "Método de pago" · "Facturas" · "Conectado" · "Conectar" · "Idioma" · "Notificaciones" · `help.human.title` "Hablar con una persona" · "Te respondemos en minutos, en español." · "Escribir".
- **Nota:** en el mockup 07 el botón dice "Ver planes"; en producción debe decir **"Ver mi plan"** y abrir 30.


---

## 6. FASE 2 · Cuenta, prueba gratis y cobros
**Mockups:** 12, 13, 14, 15, 16, 17, 18, 30 (y 26 para avisos). **Fuente de textos:** `legal/aceptacion-ux.md` §1–§5 (manda) y `trial-to-paid-path.md` (ya alineado con la revisión legal).

### 6.1 Configuración única de precios y planes (`pricing config`)
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Un solo archivo del servidor (`src/config/pricing.ts`); **ningún monto escrito a mano en componentes, correos ni textos legales**. Resumen de lo que define ese archivo (ver PRICING-CARDS-SPEC §13 y §16):
- Planes `pro_month` $997 · `pro_year` $9,970 · `vip_month` $3,799 · `vip_year` $36,325 · `pro_lealtad` (calendario §15). Totales con IVA (`PRICES_INCLUDE_IVA=true`).
- Prueba: `PRICING.trial = { days: 7, reminderDaysBefore: 7 }`; `planHasTrial()` solo `pro_month` y `pro_year` (VIP, VIP anual y Pro Lealtad sin prueba). Una vez por cuenta y por tarjeta.
- Flags: `SHOW_REFERENCE_PRICE` (default **false**; apagado muestra "Precio de lanzamiento: $997 MXN al mes") · `TRIAL_DAY6_REMINDER` (default **false**).
- Ahorros y porcentajes se **calculan** y se redondean hacia abajo (Pro anual "Ahorras $1,994 al año · 16%", VIP anual "Ahorras $9,263 al año · 20%"); ahorro 0 se oculta.
- Mercado Pago: un `preapproval_plan` por plan; prueba de 7 días en Pro (`start_date = inicio + 7 días`). Los IDs viven en variables de entorno existentes (no renombrar).

### 6.2 Reglas de precio en pantalla (obligatorias, ver §11.1)
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Tarjetas, textos, toggle ("Ahorra hasta 20%"), insignia "Más popular", línea "o paga mes a mes: $997 MXN al mes (plan mensual)" (solo en tarjetas, nunca en el cobro) y pie "Precios en MXN, IVA incluido." están en PRICING-CARDS-SPEC §6, §12.2 y §16. Regla que se queda aquí: el número grande es siempre el cobro real con su periodicidad; nunca "equivale a … al mes", nunca "2 meses gratis".

### 6.3 Planes · `/planes` (público) y `/app/planes` · mockup **12**
- **Para qué:** entender en 10 segundos qué cuesta y qué incluye.
- **Componentes:** `PublicNav`, `Segmented` Mensual/Anual (Anual activo; pill "Ahorra hasta 20%"), 3 tarjetas (Gratis · Pro resaltado con etiqueta "Más popular" · VIP con anual y mensual), FAQ, `PublicFooter`.
- **Copia:** `plans.title` "Empieza gratis, crece con Pro" · `plans.sub` "Prueba Pro gratis 7 días. Cancela en 1 clic, sin llamadas." · CTA Pro "Empezar mis 7 días gratis" · VIP "Elegir VIP anual" / "Elegir VIP mensual" ("Se cobra hoy. Sin prueba gratis."). **Precios: ver PRICING-CARDS-SPEC.md (fuente única).** (llaves y textos exactos: PRICING-CARDS-SPEC §6 y §16).
- **Con toggle en Mensual:** Pro muestra "$997 MXN al mes" + "Se renueva cada mes" y desaparece "Ahorras"; el CTA no cambia (mockups 43 / 43b).
- **Estados:** usuario con sesión → los CTA dicen "Tu plan actual" (deshabilitado) en su plan · Pro en prueba → "Ya estás probando Pro" · VIP desde Pro → "Subir a VIP".
- **Aceptación:** abuela dice cuánto pagará al año sin ayuda (lee "$9,970") · pro cambia a Mensual en 1 toque · prueba automática: el texto "2 meses gratis" no existe en el bundle.

### 6.4 Paso 1 · Crear cuenta · `/sign-in?mode=signup&intent=trial` (ruta existente `/sign-in`) · mockup **13**
- **Componentes:** `WizardShell` ("Prueba Pro gratis", "Paso 1 de 3"), botón Google, separador, 3 `Field`, `Checkbox` de marketing, recuadro lateral "Tus 7 días de Pro gratis".
- **Copia:** `signup.title` "Crea tu cuenta" · `signup.sub` "Toma 1 minuto. No necesitas tarjeta en este paso." · `signup.google` "Continuar con Google" · `signup.or` "o con tu correo" · `signup.name` "Tu nombre" · `signup.email` "Correo" · `signup.password` "Contraseña" · `signup.password.hint` "Mínimo 8 letras o números" · `signup.cta` "Crear cuenta" · `signup.legal` "Al crear tu cuenta aceptas los [Términos y Condiciones] y la [Política de Uso Aceptable], y confirmas que leíste el [Aviso de Privacidad]. Debes tener 18 años o más." · `signup.marketing` "Quiero recibir novedades, consejos y promociones de Chalyb por correo. Puedo darme de baja cuando quiera." (**desmarcada**) · `signup.side.title` "Tus 7 días de Pro gratis" · "Todo incluido" · "Hoy pagas $0" · "Hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Cancela en 1 clic." · `signup.have` "¿Ya tienes cuenta?" · "Entrar".
- **Estados:** correo ya registrado ("Ya tienes cuenta con este correo. [Entrar]") · contraseña corta (texto bajo el campo, sin rojo hasta salir del campo) · Google cancelado (vuelve sin error) · cargando (botón con "Creando tu cuenta…").
- **Registro:** evento `signup_terms_accepted` con versiones de Términos, Uso aceptable y Aviso (ver §10.3). Marketing solo si se marcó (`marketing_opt_in`).
- **Aceptación:** abuela termina con Google en 2 toques · ningún campo extra (teléfono, empresa, etc.).

### 6.5 Paso 2 · Tu prueba · `/app/prueba` · mockup **14**
- **Componentes:** `WizardShell` ("Paso 2 de 3"), 2 tarjetas-radio (**Pro mensual preseleccionado** y primero; Pro anual segundo. Nunca preseleccionar el anual, PRICING-CARDS-SPEC §16.2), `DisclosureBlock` que se actualiza en vivo, `btn-xl` "Continuar al pago", leyenda de IVA.
- **Copia:** `trial.title` "Prueba Pro gratis 7 días" · `trial.sub` "Hoy pagas $0. Cancela en 1 clic, sin llamadas." · `trial.q` "¿Qué plan quieres cuando terminen tus 7 días gratis?" · opción mensual: "Pro mensual" + "$997 MXN al mes" + "Se renueva cada mes" · opción anual: "Pro anual" + "$9,970 MXN al año" + "Se renueva cada año" + pill "Ahorras $1,994 al año · 16%" (sin insignia) · `trial.cta` "Continuar al pago" · `price.tax`.
- **`DisclosureBlock` (texto exacto de `aceptacion-ux.md` §3.2):**
  `disclosure.today` "**Hoy pagas $0.** Tu prueba gratis de 7 días termina el **{fecha_fin_prueba}**."
  `disclosure.charge` "Si no cancelas antes, el **{fecha_cobro}** se cobrarán **${monto} MXN** {periodicidad} a {tarjeta}, y se renovará automáticamente {renovacion} hasta que canceles."
  `disclosure.notice` "Hoy mismo te enviamos por correo el aviso de cobro con esta fecha y este monto." (aviso del día 0, PRICING-CARDS-SPEC §16.3)
  `disclosure.cancel` "Cancela en 1 clic desde **Mi cuenta → Mi plan**, sin llamadas. Si cancelas, sigues con Pro hasta el {fecha_fin_prueba} y no se te cobra nada."
  Variables: `{periodicidad}` anual "por 1 año de Pro" / mensual "por tu primer mes de Pro" · `{renovacion}` anual "cada año ($9,970 MXN)" / mensual "cada mes ($997 MXN)" · `{tarjeta}` sin tarjeta "la tarjeta que registres" / con tarjeta "tu tarjeta terminación {ultimos4}".
- **Estados:** usuario que ya usó su prueba → título "Elige tu plan Pro", sin "gratis", bloque "Hoy se cobran ${monto} MXN" · antifraude rechaza la prueba (tarjeta ya usada) → "Esta tarjeta ya tuvo una prueba gratis. Puedes elegir un plan y empezar hoy." + revisión humana disponible (Aviso de Privacidad §5.1) · Quebec → ver §11.8.
- **Aceptación:** al cambiar de plan el bloque cambia monto y periodicidad en < 100 ms · abuela dice cuándo y cuánto se le cobra · el monto grande siempre es el cobro real.

### 6.6 Paso 3 · Pago (Mercado Pago) · `/app/prueba/pago` · mockup **15**
- **Componentes:** `WizardShell` ("Paso 3 de 3"), aviso de 1 línea, **Card Payment Brick de Mercado Pago embebido** (sin redirección si es posible) con estilos del tema (radio 12 px, fuente Inter), línea de seguridad + enlace "Quién vende", **`Checkbox` obligatoria desmarcada**, `btn-xl` "Empezar mis 7 días gratis" (deshabilitado hasta marcar), tarjeta "Resumen".
- **Copia:**
  `pay.title` "Agrega tu tarjeta"
  `pay.oneLine` "Hoy pagas **$0**. Primer cobro: **${monto} MXN** el **{fecha_cobro}** y después **{cada_periodo}**, salvo que canceles antes." (`{cada_periodo}`: "cada año" / "cada mes") — **monto Y periodicidad** obligatorios.
  `pay.secure` "Pago seguro con Mercado Pago. Chalyb no guarda el número de tu tarjeta." · `pay.seller` "Quién vende" (abre hoja con razón social, domicilio, teléfono y correo, art. 76 Bis fr. III LFPC)
  `pay.consent` (texto exacto `aceptacion-ux.md` §3.3) "Acepto que, si no cancelo antes del **{fecha_cobro}**, Chalyb cobre automáticamente **${monto} MXN** {renovacion_corta} a mi tarjeta, y acepto los [Términos de Suscripción](/suscripcion)." · `{renovacion_corta}` "y cada año después" / "y cada mes después"
  `pay.cta` "Empezar mis 7 días gratis" · `pay.cta.hint` "Marca la casilla para continuar. Puedes cancelar cuando quieras." · `pay.consent.error` "Marca la casilla para confirmar el cobro automático. Puedes cancelar cuando quieras."
  Resumen: "Resumen" · "Plan al terminar la prueba" {plan} · "Tu prueba de 7 días termina" {fecha_fin_prueba} · "Aviso de cobro por correo" "Hoy" · "Primer cobro" ${monto} MXN / {fecha_cobro} · "Después" "${monto} MXN cada año|cada mes" · "Total hoy" "$0" · enlace "Cambiar a Pro mensual ($997 al mes)" / "Cambiar a Pro anual ($9,970 al año)". La línea "o paga mes a mes…" de las tarjetas **no** va aquí.
- **Estados:** tarjeta rechazada ("Tu banco no aceptó esta tarjeta. Prueba con otra o habla con tu banco.") · validación de MP (se muestran los mensajes del Brick en español) · cargando ("Guardando tu tarjeta…", botón bloqueado contra doble clic) · 3DS (modal del banco; al volver, sigue el flujo).
- **Servidor:** al confirmar se crea la suscripción (`preapproval`) con `free_trial` y se guarda `consent_events` (§10.3) con: versión de Términos de Suscripción, texto exacto mostrado (hash), monto, periodicidad, fechas, últimos 4, IP, user-agent, `checkbox=true`. **Sin casilla marcada el endpoint responde 422** (la regla vive en el servidor, no solo en el botón).
- **Aceptación:** prueba E2E: botón deshabilitado sin casilla; con casilla crea suscripción y evento · abuela entiende que hoy no paga nada · la casilla nunca viene marcada (prueba automática).

### 6.7 Listo · `/app/prueba/listo` · mockup **16**
- **Copia:** `done.title` "¡Listo, {nombre}!" (salto de línea) "Tus 7 días de Pro gratis ya empezaron." (texto exacto `aceptacion-ux.md` §3.6) · `done.sub` "Primer cobro: **${monto} MXN** el {fecha_cobro}, a tu tarjeta ••{ultimos4}. Ya te enviamos el aviso de cobro." · recap: "Hoy pagaste" "$0" · "Tu prueba gratis termina" · "Aviso de cobro enviado" (asunto del correo) "Hoy" · "Primer cobro ({plan})" "{marca} ••{ultimos4} · se renueva {cada_periodo} hasta que canceles" · `done.cta` "Hacer mis primeros clips" (va directo a Clips paso 1) · `done.plan` "Ver mi plan" · `done.footer` "Te enviamos estos datos a {correo} · Folio de tu aceptación: {consent_id}".
- **Efecto:** se envía el Correo 1 (aviso de cobro del día 0, 6.11) en ese momento.
- **Aceptación:** 1 toque a Clips paso 1 · el folio coincide con `consent_events.id`.

### 6.8 Avisos de prueba (banners) · componente `TrialBanner` · mockup **17**
Una línea + un botón, arriba del contenido, **uno a la vez** (prioridad: pago pendiente > aviso sin entregar > terminada > activa). La prueba dura 7 días, así que no hay fase "tranquila".
| Estado | Cuándo | Estilo | Copia | Botón |
|---|---|---|---|---|
| `trial_active` | días 0–7 | ámbar | `banner.trial` "**Prueba Pro gratis** · El **{fecha_cobro}** se cobrarán **${monto} MXN**, salvo que canceles antes." | "Ver mi plan" |
| `notice_undelivered` | el aviso del día 0 rebota o no se confirma para el día 2 | ámbar | `banner.noticeHold` "No pudimos enviarte el aviso de cobro a **{correo}**. Confírmalo o actualízalo: **no te cobraremos** hasta 5 días después de avisarte." (texto de `trial-to-paid-path.md` §2; **falta OK de Legal**) | "Revisar correo" |
| `trial_ended` | terminada o cancelada y ya vencida | neutral | `banner.ended` "Tu prueba terminó. Estás en el plan Gratis." | "Volver a Pro" |
| `past_due` | cobro fallido | rojo | `banner.pastDue` "No pudimos cobrar tu plan. Actualiza tu tarjeta antes del **{fecha_gracia}** para no perder Pro." | "Actualizar tarjeta" |
- `trial_active`, `notice_undelivered` y `past_due` **no se pueden cerrar**. `trial_ended` se cierra por sesión.
- Renovaciones de planes pagados: el mismo banner ámbar aparece 7 días antes de **cada** renovación: `banner.renew` "Tu plan {plan} se renueva el **{fecha_cobro}** por **${monto} MXN**." [Ver mi plan].
- **Aceptación:** el banner `trial_active` y el aviso de cobro del día 0 dicen lo mismo (fecha y monto).

### 6.9 Cancelar · hoja desde Mi plan · mockup **18**
- **Regla:** 2 clics (Cancelar → Sí, cancelar). Máximo **una** oferta de retención y **el botón "Sí, cancelar" siempre visible en la misma pantalla** que la oferta, con el **mismo peso visual** que "Seguir con Pro" (`btn-dark` vs `btn-primary`, mismo tamaño). Sin llamadas, sin encuestas obligatorias.
- **Copia (prueba):** `cancel.trial.title` "¿Cancelar tu prueba?" · `cancel.trial.body` "Seguirás teniendo Pro hasta el **{fecha_fin_prueba}**. Después no se te cobrará nada y pasarás al plan Gratis. Tus clips y resultados se quedan guardados." · oferta opcional (solo si el plan elegido es anual) `cancel.offer` "¿Prefieres pagar mes a mes?" [Cambiar a $997/mes] · `cancel.yes` "Sí, cancelar" · `cancel.keep` "Seguir con Pro".
- **Copia (plan pagado):** `cancel.paid.title` "¿Cancelar tu plan {plan}?" · `cancel.paid.body` "Seguirás teniendo {plan} hasta el **{fecha_fin_periodo}**. No habrá más cobros. Después pasarás al plan Gratis y tus resultados se quedan guardados."
- **Hecho:** `cancel.done.title` "Listo, cancelaste." · `cancel.done.body` "No se te volverá a cobrar. Tienes Pro hasta el **{fecha_fin}**." · "Si cambias de opinión, puedes volver a activar Pro en cualquier momento." · [Volver a Inicio] [Volver a activar Pro] · `cancel.done.folio` "Folio: {folio_cancelacion} · Te enviamos la confirmación a {correo}".
- **Servidor:** se cancela el `preapproval` en Mercado Pago **inmediatamente** (sin cobros futuros); el acceso sigue hasta fin de periodo; se guarda `cancellation_events` con folio; se envía correo con folio.
- **Aceptación:** E2E de 2 clics · después de cancelar no existe ningún cobro programado en MP · "Sí, cancelar" visible sin scroll en 1440×900 y 390×844.

### 6.10 Mi plan · `/app/cuenta/plan` · mockup **30** (Pro anual pagado) y **18** (prueba)
Estructura fija para todos los estados: tarjeta "Tu plan" (degradado) · grupo "Próximo cobro" (fecha + monto + aviso, método de pago, créditos) · grupo "Cambiar de plan" · grupo "Facturas" · fila "Cancelar". Llaves comunes: `myplan.title` "Mi plan" · `myplan.crumb` "Mi cuenta ›" · `myplan.next` "Próximo cobro" · `myplan.method` "Método de pago" · `myplan.method.sub` "Vence {mm/aa}" · `myplan.method.change` "Cambiar tarjeta" · `myplan.credits` "Créditos de este mes" · `myplan.credits.sub` "Usaste {usados} de {total}" · `myplan.credits.renew` "Se renuevan el día {dia} de cada mes" · `myplan.change` "Cambiar de plan" · `myplan.invoices` "Facturas" · `myplan.invoice.row` "{fecha} · {plan} · ${monto} · CFDI" · `myplan.invoice.empty` "Ninguna aún" · `myplan.invoice.data` "Datos de facturación (RFC)" · `myplan.cancel` "Cancelar suscripción" · `myplan.cancel.sub` "1 clic, sin llamadas. Sigues con {plan} hasta el {fecha_fin_periodo}."

| Estado | Tarjeta "Tu plan" | Próximo cobro | Cambiar de plan | Cancelar |
|---|---|---|---|---|
| **Pro mensual** | "TU PLAN · ACTIVO" · "Pro mensual — todo incluido" · "Se renueva cada mes." / "Próximo cobro: {fecha_cobro}" · "$997 MXN al mes" · [Cambiar plan] | "{fecha_cobro}" · "$997 MXN" · "Aviso por correo 7 días antes" | "Pasar a Pro anual" · "$9,970 al año" · "Ahorras $1,994 al año. Empieza en tu próxima fecha de cobro" · "Subir a VIP" · "$3,799 al mes" · "Se aplica hoy; te mostramos el ajuste antes" · "Pasar a Gratis" · "$0" · "Al terminar tu mes pagado" | "Cancelar suscripción" |
| **Pro anual** (mockup 30) | "Pro anual — todo incluido" · "Se renueva cada año." / "Próximo cobro: {fecha_cobro}" · "$9,970 MXN al año" | "{fecha_cobro}" · "$9,970 MXN" · "Aviso por correo 30 y 7 días antes" | "Pasar a Pro mensual" · "$997 al mes" · "Empieza cuando termine tu año pagado" · "Subir a VIP" · "Pasar a Gratis" · "Al terminar tu año pagado" | "Cancelar suscripción" |
| **VIP** | "VIP — todo incluido y más créditos" · "Se renueva cada mes." · "$3,799 MXN al mes" (VIP anual: "$36,325 MXN al año", aviso 30 y 7 días antes) | "{fecha_cobro}" · "$3,799 MXN" · "Aviso por correo 7 días antes" | "Bajar a Pro mensual" · "$997 al mes" · "Empieza en tu próxima fecha de cobro" · "Bajar a Pro anual" · "$9,970 al año" · "Pasar a Gratis" | "Cancelar suscripción" |
| **Prueba activa** | "TU PLAN · PRUEBA" · "Prueba Pro gratis" · "Te quedan {n} días · termina el {fecha_fin_prueba}" · "Después de la prueba: {plan} · ${monto} MXN {al año\|al mes}" [Cambiar] | "{fecha_cobro}" · "${monto} MXN" · "Aviso de cobro enviado el {fecha_inicio}" | "Cambiar a Pro mensual/anual (antes del primer cobro)" | "Cancelar prueba" · "1 clic, sin llamadas" |
| **Cancelado, activo hasta** | "TU PLAN · CANCELADO" · "{plan} hasta el {fecha_fin_periodo}" · "No habrá más cobros." · [Volver a activar {plan}] | se oculta; en su lugar "Después del {fecha_fin_periodo} pasarás al plan Gratis. Tus resultados se quedan guardados." | se oculta | se oculta |
| **Pago pendiente** | rojo: "TU PLAN · PAGO PENDIENTE" · "No pudimos cobrar ${monto} MXN" · "Actualiza tu tarjeta antes del {fecha_gracia} para no perder {plan}." · [Actualizar tarjeta] | "Intentaremos de nuevo el {fecha_reintento}" · método de pago resaltado | visible | "Cancelar suscripción" (también aquí; nunca se bloquea cancelar por deuda) |
- **Cambios de plan:** subir a VIP = inmediato con prorrateo mostrado **antes** de confirmar ("Hoy se cobrarán ${ajuste} MXN. Después, $3,799 MXN cada mes.") + `ConfirmStep` con casilla de cobro recurrente (mismo texto de §3.3 con el nuevo monto) · bajar o cambiar periodicidad = al final del periodo pagado, con confirmación "Tu cambio empieza el {fecha}. Hasta entonces sigues con {plan}." · cada cambio registra un `consent_event`.
- **Aceptación:** los 6 estados tienen fixture y captura · ningún estado sin botón de cancelar mientras haya cobros futuros · abuela encuentra "cuándo me cobran y cuánto" en < 5 s.

### 6.11 Correos y avisos de cobro (texto exacto en `trial-to-paid-path.md` §2 y `aceptacion-ux.md` §4)
| Correo | Cuándo | Asunto |
|---|---|---|
| 1 Aviso de cobro (= confirmación) | **día 0**, al empezar la prueba (entregado a más tardar el día 2) | "Aviso de cobro: el {fecha_cobro} se cobrarán ${monto} MXN si no cancelas" (texto `aceptacion-ux.md` §3.6; versiones aceptadas y folio; sin bienvenida ni marketing) |
| 2 Recordatorio día 6 | **apagado** (`TRIAL_DAY6_REMINDER=false`; opcional, Legal lo recomienda para Pro anual) | "Mañana termina tu prueba gratis" |
| 3 Cobro realizado | día 7 | "Bienvenido a Chalyb Pro" |
| 3b Cobro fallido | al fallar | "No pudimos cobrar tu plan Pro" |
| 4 Renovación mensual | **7 días antes de cada** cobro mensual | "Tu plan {plan} se renueva el {fecha_cobro}" |
| 5 Renovación anual | **30 y 7 días antes** | "Tu plan Pro anual se renueva el {fecha_cobro}" |
| 6 Resumen anual (mensuales) | 1 vez al año | "Tu resumen anual de Chalyb" (producto, frecuencia, monto, cómo cancelar) |
| 7 Cancelación | al cancelar | "Cancelaste tu plan · Folio {folio}" |
- **Regla de rebote (obligatoria):** si el aviso de cobro del día 0 (o uno de renovación) rebota o falla, se muestra banner + aviso en app/WhatsApp y **no se cobra hasta 5 días naturales después de un aviso efectivo** (Términos de Suscripción §2.7 bis). Implementar como bloqueo en el job de cobro (`reminder_delivered_at` requerido).
- Notificación en app (mockup 26), día 0: `notif.trialNotice.title` "Aviso de cobro: tu prueba Pro empezó" · `notif.trialNotice.body` "El {fecha_cobro} se cobrarán ${monto} MXN si no cancelas. Puedes cancelar en 1 clic."

### 6.12 Criterios de aceptación de Fase 2
- [ ] Ninguna cadena "2 meses gratis", "mes gratis", "1 mes" (como prueba), "equivale" ni "Mejor oferta" (PRICING-CARDS-SPEC §16.1, §16.6).
- [ ] La casilla de cobro recurrente es obligatoria, viene desmarcada y el servidor rechaza sin ella.
- [ ] El bloque de cobro dice monto **y** periodicidad **y** fecha en las pantallas 14, 15, 16 y en el Correo 1.
- [ ] Avisos: aviso de cobro el día 0 de la prueba; 7 días antes de cada mensual y de cada anual (+30 días en anual). El cobro se bloquea sin aviso entregado.
- [ ] Cancelar en 2 clics con "Sí, cancelar" visible junto a la oferta.
- [ ] Los montos salen de `PRICING`; cambiar un precio cambia pantallas, correos y textos legales.
- [ ] Prueba de la abuela: de la landing a "¡Listo!" sin ayuda en ≤ 6 toques (Google). Prueba del profesional: cambiar a Mensual y luego cancelar en ≤ 4 toques desde Inicio.

---

## 7. FASE 3 · Herramientas (asistentes de 3 pasos) y resultados
**Mockups:** 02–06, 19–26. Todas usan `WizardShell` y `getEntitlements`. Toda herramienta muestra **un solo** botón principal por paso.

### 7.1 Clips · `/app/clips` (paso 1) → `/app/clips/formato` → `/app/clips/{job}` · mockups **02, 03, 04, 05, 06**
- **Paso 1 (02):** `clips.s1.title` "Pega el enlace de tu stream o video" · `clips.s1.sub` "Copia la dirección de tu video y pégala aquí. Nosotros hacemos el resto." · placeholder "https://youtube.com/..." · `clips.s1.paste` "Pegar" · `clips.s1.works` "Funciona con YouTube, Twitch, Kick y Facebook." · `clips.s1.or` "o también puedes" · "Conectar YouTube" · "Conectar Twitch" · "Subir un video" · `clips.s1.cta` "Continuar" · `clips.s1.private` "Tu video es privado. Solo tú puedes verlo."
- **Paso 2 (03):** `clips.s2.title` "¿Dónde los vas a publicar?" · `clips.s2.sub` "Elige la forma de tus clips. Puedes cambiarla después." · tarjetas "TikTok / Reels / Shorts · Vertical" (pill "Recomendado"), "YouTube · Horizontal", "Instagram · Cuadrado" · `clips.s2.count` "¿Cuántos clips?" · `clips.s2.count.hint` "Te recomendamos 6 para empezar." (opciones 3 · **6** · 10; ver decisión D9) · `clips.s2.cta` "Crear mis clips".
- **Opciones avanzadas (06)**, cerradas por defecto, "Para creadores profesionales": "Subir varios videos a la vez" · "Subtítulos: estilo y idioma" · "Formato y duración personalizada" ("De 15 a 60 segundos") · "Publicar automáticamente en mis redes" · "Marca de agua / logo" · "Acceso API" · pie `clips.adv.default` "Si no tocas nada, usamos la mejor configuración por ti."
  - **Publicar automáticamente** requiere conexión y casilla (`aceptacion-ux.md` §7): "Entiendo que Chalyb publicará clips en **{cuenta}** según las reglas que configuré y que **soy responsable** de lo que se publique." [Activar publicación automática].
  - **Voz o rostro con IA** (doblaje, voz sintética, avatar): **no se construye** en esta fase. Si se agrega después, va en Opciones avanzadas con el paso de consentimiento de §11.6.
- **Paso 3 · Creando (04):** anillo de % + 4 pasos: "Video recibido" · "Buscando los mejores momentos" ("Encontramos {n}") · "Agregando subtítulos…" · "Listo para descargar"; `clips.wait.title` "Estamos creando tus clips" · `clips.wait.sub` "Tarda unos minutos. Puedes cerrar esta página, te avisamos cuando estén listos." · `clips.wait.email` "Avísame por correo".
- **Listos (05):** `clips.done.title` "Tus clips están listos 🎉" · `clips.done.sub` "Hicimos {n} clips de “{titulo}”. Ya tienen subtítulos." · "Hacer más clips" · "Descargar todos" · por clip: "Descargar" · "Compartir" · `clips.done.saved` "Tus clips se guardan en [Mis resultados]. Puedes volver por ellos cuando quieras."
- **Estados:** enlace inválido/privado → 7.6 error · sin créditos → "Te quedaste sin créditos este mes. Se renuevan el {fecha}." + [Ver mi plan] · trabajo fallido → 7.6 error con "No se usaron créditos."
- **Aceptación:** abuela: enlace → clips en 3 toques · pro: avanzadas en 1 toque desde paso 2.

### 7.2 Señales · `/app/senales` · mockups **20** (paso 1) y **21** (listo)
**Reglas legales de producto (§11.4) que el código debe respetar:** las señales son **iguales para todos los usuarios de un plan**; el servicio **no pide ni usa** saldos, posiciones, objetivos ni perfil de riesgo; **no existe** "copiar automáticamente"; ninguna señal se convierte en orden.
- **Primera activación:** modal de aviso de riesgo (texto exacto `aceptacion-ux.md` §6) con casilla "Entiendo y acepto que las decisiones y los riesgos son míos." y botón "Entendido, continuar"; se registra `risk_ack_accepted` por herramienta y versión.
- **Paso 1 (20):** `signals.s1.title` "¿Qué monedas te interesan?" · `signals.s1.sub` "Elige una o varias. Puedes cambiarlas después." · chips grandes Bitcoin BTC, Ethereum ETH, Solana SOL, XRP, Dogecoin DOGE, Cardano ADA, BNB, Litecoin LTC · "Buscar otra moneda" · `signals.s1.count` "Elegiste **{n} monedas**: {lista}." · `signals.s1.same` "Las señales son iguales para todos los usuarios de tu plan." · Opciones avanzadas "Temporalidad y horario de avisos" · "Continuar". (La elección de monedas solo **filtra** qué avisos recibes; no cambia el contenido de la señal.)
- **Paso 2:** `signals.s2.title` "¿Cómo te avisamos?" · tarjetas "WhatsApp" · "Correo" · "En la app" (varias) · "Continuar".
- **Listo (21):** `signals.done.title` "Tus señales ya están activas" · `signals.done.sub` "Te avisamos por {canal} cuando haya algo importante. Esto es lo más reciente." · franja fija `signals.disclaimer` "**Esto es informativo, no es asesoría financiera.** Las señales son iguales para todos y no usan tus saldos ni tus inversiones. Tú decides." + [Leer aviso completo] · tarjetas: moneda, hora, estado en palabras simples: `signal.buy` "Buen momento para comprar" (acento) · `signal.sell` "Buen momento para vender" (ámbar) · `signal.wait` "Mejor espera" (gris) · explicación general (p. ej. "Bitcoin lleva varios días subiendo de forma estable y sin sobresaltos.") · "Confianza alta|media" / "Sin prisa" · "Ver por qué" · lateral "Así te avisamos" (interruptores), "Tus monedas", "Opciones avanzadas".
- **Prohibido en copia de señales:** segunda persona sobre la posición del usuario ("si ya ganaste…", "tu cartera", "te conviene"), montos sugeridos, "garantizado".
- **Aceptación:** prueba de contrato: el endpoint de señales no recibe `userId` para calcular contenido (solo para filtrar entrega) · abuela entiende cada tarjeta sin conocer "RSI" · pro encuentra temporalidad en 1 toque.

### 7.3 En vivo · `/app/en-vivo` · mockup **22**
- **Copia:** `live.title` "Tu transmisión" · `live.sub` "Todo listo. Cuando quieras, toca el botón grande." · `live.obs.ok` "OBS conectado" · "Tu transmisión saldrá en {plataformas}" · "Cambiar" · `live.start` "Iniciar transmisión" (botón gigante 100 px) · `live.start.sub` "Empieza en 3 segundos. Puedes detenerla cuando quieras." · `live.scenes` "Escenas" · "Toca una para cambiar lo que ve tu público" · escenas como tarjetas grandes (nombre + descripción, "En pantalla") · `live.quick` "Controles rápidos": Micrófono · Cámara · "Hacer clips al terminar" · `live.check` "Antes de empezar": Internet "Bueno|Lento|Sin conexión", Título [Editar] · Opciones avanzadas "Calidad, servidores y atajos".
- **En transmisión:** el botón cambia a rojo `live.stop` "Terminar transmisión" + contador; terminar pide confirmación ("¿Terminar tu transmisión?" [Sí, terminar] [Seguir]).
- **Estados:** OBS no conectado → `SetupState` "Te falta conectar OBS" [Conectar ahora] (guía de 3 pasos) · internet lento → pill ámbar.
- **Voz/rostro con IA:** no existe; si se agrega (p. ej. avatar o voz sintética en escenas), aplicar §11.6.
- **Aceptación:** abuela inicia y cambia de escena sin leer ayuda · pro llega a "Calidad, servidores y atajos" en 1 toque.

### 7.4 Más herramientas · `/app/herramientas` · mockup **23**
- Rejilla de 4: **Asistente** "Un bot que contesta a tus clientes y seguidores, de día y de noche." · **Pronósticos** "Los pronósticos deportivos del día, explicados en simple." · **Inmuebles** "Publica tus propiedades y atiende a interesados sin perder tiempo." · **Inversiones** "Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero."
- Estado `included`: pill verde `tools.included` "Incluido en tu plan" + [Abrir].
- Estado `trial_offer` (Gratis): pill acento `tools.inPro` "Incluido en Pro" + botón secundario `tools.try` "Pruébalo gratis" (→ 14). Franja inferior "Prueba Pro gratis 7 días · Hoy pagas $0. Cancela en 1 clic, sin llamadas." [Empezar mis 7 días gratis] **Nunca** candado ni "Disponible".
- Estado `setup_needed`: pill ámbar "Te falta un paso" + [Conectar ahora] (va directo al paso que falta).
- **Asistente:** asistente de 3 pasos ("¿Dónde contesta?" WhatsApp/Instagram/web · "¿Qué debe saber?" pegar textos o enlace · "Pruébalo"). Sin clonación de voz ni de persona; si se ofrece "voz" o "avatar", ver §11.6. El bot se presenta como asistente automático ("Soy el asistente de {negocio}").
- **Pronósticos:** solo lectura de pronósticos explicados (partido, pronóstico, por qué, confianza). **Prohibido en UI:** apostar, montos, momios para apostar, quinielas, concursos, premios, sorteos, tablas de usuarios, "comparte y gana", enlaces a casas de apuestas (si algún día se agregan, solo con permiso SEGOB y mensajes del Reglamento LFJS, previa validación legal). Primera activación: modal de riesgo de §7.2 con `{Herramienta}`="Pronósticos". Pie fijo: "Esto es informativo. No es asesoría de apuestas."
- **Inmuebles:** fichas de propiedad (fotos del usuario, texto generado, compartir). Nota legal M13 de `REVISION-LEGAL.md` (antilavado) solo afecta si Chalyb interviene en pagos: **no lo hace**.
- **Inversiones:** 3 pasos: (1) **Conectar exchange** con el texto de `aceptacion-ux.md` §7 + `invest.noWithdraw` "**Nunca podemos retirar tu dinero.** Usa claves solo de lectura, o de lectura y operación si vas a usar reglas. Rechazamos claves con permiso de retiro." + casilla de consentimiento expreso de datos financieros; el servidor **consulta los permisos de la clave y la rechaza si permite retiros** ("Esta clave permite retiros. Por tu seguridad no la aceptamos. Crea una nueva sin ese permiso."); (2) **Escribe tu regla** (activo, condición, monto máximo, horario) en lenguaje simple, escrita por el usuario; (3) **Revisa y activa** con el texto de §7 "Esta automatización enviará órdenes… **solo según la regla que tú definiste**: {resumen_regla}. Chalyb no elige activos, montos ni momentos por ti." + casilla "Revisé la regla y acepto que las órdenes y sus riesgos son míos." [Activar]. Siempre visible: [Pausar]. **Prohibido:** "copiar señal", "seguir a Chalyb", carteras modelo, plantillas de regla que usen Señales como disparador, sugerencias basadas en saldos.
- **Aceptación:** las 3 variantes de estado tienen fixture · prueba automática: no existe ningún texto "Disponible", "Requiere Pro", "copiar automáticamente", "apuesta" · una clave con retiro es rechazada (prueba con mock del exchange).

### 7.5 Mis resultados · `/app/resultados` · mockup **19**
- **Copia:** `results.title` "Mis resultados" · `results.sub` "Todo lo que tus herramientas hicieron por ti." · `results.search` "Buscar en mis resultados" · chips: "Todos" · "Clips" · "Señales" · "En vivo" · "Asistente" · "Pronósticos" · "Inmuebles" · "Inversiones" · sección "Listos" · tarjetas grandes en 3 columnas (miniatura, herramienta, título, fecha relativa + detalle, 1–2 botones: "Ver clips"/"Descargar", "Ver señal", "Ver grabación"/"Hacer clips", "Ver mensajes", "Abrir"/"Compartir").
- **Estados:** vacío → 7.6 panel 1 · cargando → esqueletos · sin coincidencias → "No encontramos “{busqueda}”. Prueba con otra palabra." [Ver todos] · en proceso → tarjeta con anillo "Creando… {pct}%".
- **Aceptación:** filtrar en 1 toque · pro busca por título en < 3 s.

### 7.6 Vacío, error y "falta un paso" · componentes `EmptyState` / `ErrorState` / `SetupState` · mockup **24**
- `empty.clips.title` "Aún no tienes clips" · `empty.clips.body` "Haz el primero en 1 minuto. Solo pega el enlace de tu stream." · `empty.clips.cta` "Hacer mi primer clip"
- `error.link.title` "No pudimos leer ese enlace" · `error.link.body` "Revisa que el video sea público y vuelve a pegarlo." · [Intentar otra vez] (primario) · [Hablar con una persona] (verde) · `error.noCharge` "No se usaron créditos."
- Otras razones: `error.unsupported` "Ese enlace no es de una plataforma que podamos leer. Funciona con YouTube, Twitch, Kick y Facebook." · `error.tooLong` "Ese video dura más de {max} horas. Sube una parte o pásate a VIP." · `error.platform` "{plataforma} no responde ahora. Lo intentamos solos en unos minutos y te avisamos." · `error.unknown` "Algo salió mal de nuestro lado. Ya lo estamos revisando."
- `setup.youtube.title` "Te falta conectar YouTube" · `setup.youtube.body` "Así podemos traer tus streams y hacer tus clips solos. Toma 30 segundos." · `setup.cta` "Conectar ahora" · `setup.alt` "O pega un enlace, sin conectar nada." (misma estructura para OBS, Twitch, WhatsApp, exchange).
- **Aceptación:** cada estado tiene exactamente 1 botón principal y nunca un botón sin acción.

### 7.7 Ayuda · `/app/ayuda` · mockup **25**
- `help.title` "Ayuda" · `help.sub` "Aquí estamos para ayudarte, en español." · tarjeta verde `help.human.title` "Hablar con una persona" · "Te respondemos en minutos. Sin robots, sin esperas largas." · [WhatsApp] [Chat aquí] · `help.faq` "Preguntas comunes": "¿Cómo hago mis primeros clips?" · "¿Cómo conecto YouTube o Twitch?" · "¿Qué son los créditos?" · "¿Cómo cambio o cancelo mi plan?" · "Tengo un problema con un cobro" · `help.videos` "Videos para aprender" (tarjetas con duración "Video · {n} min").
- "Sin esperas largas" y "en minutos" solo si hay horario y SLA reales; si no, `help.human.sub.alt` "Te respondemos lo antes posible, en español." (decisión D6).

### 7.8 Avisos (notificaciones) · `/app/avisos` · mockup **26** (móvil)
- Lista estilo iOS agrupada "Hoy" / "Esta semana", "Marcar como leídos". Tipos: `notif.clipsReady` "Tus clips están listos" · "Hicimos {n} clips de “{titulo}”. Ya tienen subtítulos." · `notif.trial7` (6.11) · `notif.signal` "{moneda}: {estado}" · "Informativo, no es asesoría financiera." · `notif.liveEnded` "Tu transmisión terminó" · "Duró {duracion}. ¿Hacemos clips?" · `notif.assistant` "Tu Asistente respondió {n} mensajes" · "Tus clientes ya tienen respuesta." · `notif.renew` "Tu plan se renueva en 7 días" · `notif.pastDue` "No pudimos cobrar tu plan".
- **Aceptación:** tocar un aviso lleva al resultado exacto · los avisos de cobro no se pueden borrar antes de la fecha.

---

## 8. FASE 4 · Sitio público
**Mockups:** 10 (escritorio, página completa), 11 (móvil 390), 12 (planes, ver 6.3).

### 8.1 Landing · `/` · mockups **10** y **11**
> **Reemplazado por `LANDING-SPEC.md` (mockups 40–44, oct 2026).** Lo de abajo queda como historial de la primera pasada; si hay diferencias, manda LANDING-SPEC.
Secciones en este orden (ancla en `PublicNav`: Herramientas · Cómo funciona · Planes · Preguntas · Entrar · [Prueba Pro gratis]):
1. **Hero:** eyebrow `land.hero.eyebrow` "Todo incluido · Un plan, todas las herramientas" · `land.hero.title` "Bots que trabajan por ti mientras duermes" · `land.hero.sub` "Clips para tus redes, señales de cripto, tu transmisión y mucho más. Fuiste por una cosa y te llevaste todo." · CTA único `land.cta` "Empezar mis 7 días gratis" · `land.cta.sub` "Cancela cuando quieras. Hoy pagas $0." · 3 sellos "En español" · "Sin saber de tecnología" · "Cancela en 1 clic" · panel "Mientras dormías" con 4 resultados de ejemplo (clips listos, señal, Asistente, Pronósticos) y un marco de clip con gradiente (sin fotos de personas).
2. **Herramientas:** `land.tools.title` "Todo lo que necesitas, en un solo lugar" · `land.tools.sub` "Cada herramienta hace una cosa y la hace por ti. Todas vienen en tu plan." · 7 tarjetas con las frases de §7.4 y pill "Incluido en Pro" + tarjeta "Tu idea" ("¿Necesitas otra herramienta? Propónla y nosotros la construimos." [Proponer una idea]). Señales: "Te avisamos cuándo es buen momento para comprar o vender cripto." · Clips: "Convierte tu stream en clips cortos para TikTok, Reels y Shorts." · En vivo: "Maneja tu transmisión y tus escenas de OBS con botones grandes."
3. **Cómo funciona en 3 pasos:** "Crea tu cuenta" (Con Google o con tu correo. Toma 1 minuto.) · "Elige qué quieres hacer" (Clips, señales, tu transmisión… todo está en Inicio con botones grandes.) · "Listo, trabaja por ti" (Te avisamos cuando tus resultados estén listos. Tú solo los usas.)
4. **Galería de clips:** `land.gallery.title` "Así se ven tus clips" · "Pega el enlace de tu stream y recibe clips con subtítulos, listos para publicar." · 6 marcos con gradiente.
5. **Para quién (sin nombres, logos ni cifras inventadas):** `land.who.title` "Hecho para streamers, creadores y negocios" · "Si no tienes tiempo de editar, contestar o vigilar el mercado, Chalyb lo hace por ti." · Streamers / Creadores / Negocios / Quien invierte · franja "En español, para México y Latinoamérica · Pago seguro con Mercado Pago · Ayuda de una persona por WhatsApp".
6. **Planes (resumen):** precios según PRICING-CARDS-SPEC.md (fuente única; Pro anual "$9,970 MXN al año" grande) + "Ver todos los planes y qué incluyen".
7. **Socios (ligero):** `land.partner.title` "Tienes la idea, nosotros la construimos" · "Propón una herramienta. Si la hacemos, compartimos las ganancias contigo." [Proponer mi idea] → formulario simple (nombre, correo, idea) que llega a Panel → Necesita tu atención. Requiere bases del programa (decisión D7).
8. **FAQ:** "¿De verdad el primer mes es gratis?" (Sí. Hoy pagas $0. Te avisamos por correo 7 días antes de que termine y puedes cancelar en 1 clic desde Mi cuenta, sin llamadas.) · "¿Necesito saber de tecnología?" · "¿Qué incluye el plan Pro?" · "¿Cómo cancelo?" · "¿Cómo pago?" · "¿Me dan factura?" (respuestas cortas en `land.faq.*`).
9. **CTA final** "Fuiste por una cosa y te llevaste todo." + lista de las 7 herramientas + CTA.
10. **`PublicFooter`:** columnas Herramientas / Chalyb (Planes, Ayuda, Proponer una idea, Entrar) / **Legal: Términos y Condiciones · Términos de Suscripción · Aviso de Privacidad · Uso aceptable** · datos de "Quién vende" (razón social, domicilio, teléfono, correo) · "© {año} Chalyb. Precios en pesos mexicanos (MXN), IVA incluido." · "Pago seguro con Mercado Pago".
- **Móvil (11):** misma estructura en una columna; menú hamburguesa; CTA fijo inferior "Empezar mis 7 días gratis" tras el hero.
- **Técnico:** SSR/estático, `lang="es-MX"`, metadatos OG, sin cookies no esenciales antes del banner de cookies (`aceptacion-ux.md` §9), Lighthouse ≥ 90 en móvil.
- **Aceptación:** abuela encuentra el botón de prueba sin scroll en 390×844 · pro llega a precios en 1 toque · prueba automática de textos prohibidos (§0.3, §11).

---

## 9. FASE 5 · Panel del dueño · `/dashboard`
**Mockups:** 27, 28, 29. Mismo sistema visual. Navegación de 6: **Centro de mando · Personas · Dinero · Herramientas · Actividad · Ajustes** + tarjeta "Dueño" + enlace "Ver la app ›". Acceso solo para rol admin (middleware existente). Todos los números de muestra llevan `ExampleTag` "Ejemplo" mientras no haya datos reales; en producción se quita la etiqueta.

### 9.1 Centro de mando · `/dashboard` · mockup **27**
- `admin.hello` "Buenos días 👋" · `admin.home.title` "Centro de mando" · `admin.home.sub` "Así va Chalyb este mes. Lo importante, primero." · `Segmented` Hoy / 7 días / Este mes.
- 4 `KpiCard`: "Ingresos del mes" (MXN, vs. mes pasado) · "Suscriptores activos" (+n este mes) · "Pruebas activas" ("Terminan esta semana: {n}") · "Conversión de prueba" ("De cada 10 pruebas, {n} se quedan").
- "Necesita tu atención" (contador): cobros fallidos [Revisar] · reembolsos pedidos [Responder] · herramienta lenta [Ver] · ideas nuevas [Leer] · **avisos de cobro que rebotaron** [Ver] (bloquean el cobro, §6.11) · solicitudes ARCO [Responder] (plazo legal).
- "Herramientas": cada una con `Funcionando bien` (verde) / `Lento hoy` (ámbar) / `No funciona ahora` (rojo) + [Ver actividad].
- **Actividad (`/dashboard/actividad`)**: lista cronológica de eventos (fallos de Clips con razón de §7.6, cobros, cancelaciones, `consent_events` resumidos), filtros por herramienta y tipo.
- **Herramientas (`/dashboard/herramientas`)**: estado y switch de mostrar/ocultar por herramienta (una herramienta oculta no aparece en ningún lado, regla §0.3).
- **Ajustes (`/dashboard/ajustes`)**: `PRICING` en solo lectura con enlace al archivo de config, toggle Mensual/Anual (`billingToggleEnabled`), datos de "Quién vende", versiones vigentes de documentos legales.

### 9.2 Personas · `/dashboard/personas` · mockup **28**
- `admin.people.title` "Personas" · "Todos tus suscriptores en un solo lugar." · búsqueda "Buscar por nombre o correo" · chips Todos / En prueba / Pago pendiente / Cancelados · `DataTable` (Persona, Plan, Estado, Desde) con chips de estado: Activo (verde) · En prueba (acento) · Pago pendiente (rojo) · Termina pronto (ámbar) · Cancelado (gris).
- **Hoja de acciones** de la fila: "Regalar 1 mes de Pro" · "Cambiar su plan" · "Reenviar correo de acceso" · "Reembolsar último cobro" · "Cancelar su suscripción" (rojo) → **`ConfirmStep` "Confirma · paso 2 de 2"**: p. ej. "¿Reembolsar $997 MXN a Luis Hernández?" · "Regresa a su tarjeta por Mercado Pago en 5 a 10 días. Queda registrado con tu nombre." [No, volver] [Sí, reembolsar].
- Cada acción queda en Actividad con el admin que la hizo. Cambiar plan desde el panel **no** cobra más sin el consentimiento del usuario (se le envía un enlace para aceptar).

### 9.3 Dinero · `/dashboard/dinero` · mockup **29**
- `admin.money.title` "Dinero" · "Una sola fuente de verdad para tus ingresos." · "Viene de Mercado Pago · se actualiza cada hora".
- 4 tarjetas: "Ingresos del mes" ("Ya descontados los reembolsos") · "Pruebas que se convierten" ("{a} de {b} pruebas") · "Cobros fallidos" ("{n} cobros · se reintentan solos") · "Reembolsos" ("{n} este mes").
- Gráfica de barras "Ingresos por mes" (6 meses) · embudo "Pruebas de este mes": Empezaron prueba / Siguen en prueba / Ya pagaron / Cancelaron · tabla de movimientos (Fecha, Persona, Concepto, Monto, Estado: Cobrado / Falló / Reembolsado).
- **Fuente:** webhooks de Mercado Pago (`payment`, `subscription_preapproval`, `subscription_authorized_payment`) guardados en una tabla de movimientos; el panel **nunca** calcula ingresos desde el plan del usuario. Montos con IVA y, si D1 lo confirma, desglose de IVA en exportación CSV.
- **Aceptación (Fase 5):** el dueño responde "¿cuánto entró este mes y cuántas pruebas pagaron?" en < 10 s · toda acción destructiva tiene paso de confirmación · ningún número sin etiqueta "Ejemplo" en datos de muestra.

---

## 10. FASE 6 · Páginas legales y registro de aceptación
**Fuentes (no reescribir; publicar tal cual tras firma del abogado):** `legal/terminos-y-condiciones.md`, `legal/terminos-de-suscripcion.md`, `legal/aviso-de-privacidad.md`, `legal/uso-aceptable-y-contenido.md`, `legal/aceptacion-ux.md` (microcopia y registro), `legal/REVISION-LEGAL.md` (hallazgos y pendientes), `legal/README.md`. PDF de borrador: `legal/chalyb-politicas-borrador.pdf`.

### 10.1 Páginas
| Ruta | Documento | Notas |
|---|---|---|
| `/terminos` y `/terminos/v{x}` | Términos y Condiciones | Versión vigente + versiones archivadas inmutables |
| `/suscripcion` y `/suscripcion/v{x}` | Términos de Suscripción | Enlazado desde la casilla de cobro |
| `/privacidad` y `/privacidad/v{x}` | Aviso de Privacidad (integral) + aviso simplificado en registro | |
| `/uso-aceptable` (`#avisos`) | Uso aceptable y contenido | Ancla `#avisos` para el modal de riesgo |
| `/quien-vende` (o hoja) | Datos del proveedor | Art. 76 Bis fr. III LFPC |
- Render desde Markdown con índice, fecha de vigencia y número de versión visibles; legible a 18 px; imprimible/PDF.

### 10.2 Flujos de aceptación (texto exacto en `aceptacion-ux.md`)
§2 registro · §3 Tu prueba + casilla · §3.5 tarjeta · §3.6 confirmación · §4 recordatorios (tabla + regla de rebote) · §5 cancelación · §6 aviso de riesgo · §7 conectar cuentas, exchange y automatizaciones · §8 re-aceptación por cambio de Términos (modal; cambios de precio solo con aceptación expresa y aviso de 30 días) · §9 banner de cookies.

### 10.3 Registro de evidencia (`consent_events`)
- Implementar **exactamente** `aceptacion-ux.md` §10: eventos de §10.1, campos de §10.2 (incluye `disclosure_text` renderizado, `checkbox_text`, `checkbox_checked`, `amount_mxn`, `billing_interval`, fechas UTC, `prev_event_hash`/`event_hash`), reglas de §10.4 (solo agregar, hora del servidor UTC, archivo de versiones, conservación 10 años, 72 meses para marcas de incumplimiento, IP cifrada) y paquete de contracargo §10.5.
- Tabla nueva `consent_events` (nombre propuesto; si existe una tabla de auditoría, se extiende sin renombrar). Escritura solo desde el servidor; la app no tiene permisos de UPDATE/DELETE.
- El folio que se muestra en pantallas 16 y 18 es `consent_id` / `folio_cancelacion`.
- **Aceptación:** prueba que intenta borrar o editar un evento falla · cada pantalla con consentimiento genera su evento con el texto exacto mostrado · el PDF de contracargo se genera para un usuario de prueba.

### 10.4 Lista final antes de publicar
Usar `aceptacion-ux.md` §11 completa + "Para firma de abogado mexicano" de `REVISION-LEGAL.md` §5.

---

## 11. Requisitos legales que el build debe hacer cumplir
Fuente: `legal/REVISION-LEGAL.md` (30-sep-2026) y `legal/aceptacion-ux.md`. **No es asesoría legal:** los puntos marcados requieren firma de abogado mexicano antes de lanzar. Cada punto tiene una **prueba automática** (unitaria, E2E o de contenido) que bloquea el despliegue si falla.

### 11.1 Precio real como número principal (art. 7 Bis, 32 y 76 Bis fr. VIII LFPC)
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Regla que se prueba aquí: el número grande es el cobro real con su periodicidad ("$9,970 MXN al año", "$997 MXN al mes"); sin "equivale a … al mes"; **prohibido "2 meses gratis"** en cualquier lugar (UI, correos, anuncios, metadatos); la línea "o paga mes a mes…" solo en tarjetas, nunca junto al formulario de tarjeta ni en bloques de cobro; precio de referencia solo con `SHOW_REFERENCE_PRICE`.
- Prueba: escaneo de cadenas del bundle y de plantillas de correo.

### 11.2 Consentimiento expreso del cobro recurrente (art. 76 Bis fr. VIII LFPC; ROSCA/California)
- Casilla **obligatoria y desmarcada** en el paso de pago con el texto de `aceptacion-ux.md` §3.3; el botón "Empezar mis 7 días gratis" queda deshabilitado hasta marcarla y **el servidor rechaza (422)** sin ella.
- El aviso del paso de pago dice **monto y periodicidad** ("$9,970 MXN … y después cada año"; checkout con Pro mensual preseleccionado, nunca el anual), además de la fecha.
- Mismo patrón (casilla + monto + periodicidad) al subir a VIP o cambiar de plan con cobro.
- Botón como aceptación (sin casilla) solo si el abogado lo aprueba (`aceptacion-ux.md` §3.4).

### 11.3 Avisos previos y cancelación (art. 76 Bis fr. VIII y IX LFPC; California §17602; NY §527-a; Quebec Ley 10)
- Prueba: **aviso de cobro el día 0** (7 días antes del cobro; mínimo legal 5). Renovaciones: aviso **7 días antes de cada** cobro mensual y anual (el anual además a 30 días). Correo + banner + notificación. Recordatorio del día 6 apagado (opcional). Detalle: PRICING-CARDS-SPEC §16.3–§16.4.
- Si el aviso rebota o no se entrega: **no se cobra** hasta 5 días naturales después de un aviso efectivo (`reminder_delivered_at` requerido por el job de cobro).
- Cancelación inmediata en línea, 1 clic + 1 confirmación, sin llamadas. **Si hay oferta de retención, el botón "Sí, cancelar" sigue visible en la misma pantalla** y con el mismo peso visual. Máximo una oferta.
- Cambios de precio: solo con aceptación expresa y aviso de 30 días; sin aceptación, el plan termina al final del periodo sin cobro nuevo.

### 11.4 Señales e Inversiones: información general, no asesoría (arts. 225, 227 LMV; Ley Fintech; §202(a)(11)(D) Advisers Act; CFTC 4.14(a)(9); NI 31-103)
- Las señales son **iguales para todos los usuarios de un plan**. El contenido no se calcula con datos del usuario.
- **Nunca** pedir, guardar para recomendaciones ni usar **saldos, posiciones, objetivos o perfil de riesgo**. Se elimina cualquier campo "nivel de riesgo" / "perfil de inversionista" (en el mockup 20 las opciones avanzadas quedaron como "Temporalidad y horario de avisos").
- **Prohibido** "Copiar automáticamente", "seguir señales", auto-trading ligado a Señales, carteras modelo y plantillas que disparen órdenes desde Señales.
- Las automatizaciones de Inversiones **solo ejecutan reglas que el usuario escribe** (activo, condición, monto máximo, horario), con confirmación y botón de pausa.
- Al conectar un exchange: solo claves **de lectura** o **lectura + operación**; **se rechazan claves con permiso de retiro** (validación en servidor contra la API del exchange). Copia obligatoria: **"Nunca podemos retirar tu dinero."** Sin custodia de fondos.
- Se mantiene **"Esto es informativo, no es asesoría financiera"** en Señales, Inversiones, avisos y correos de señales; modal de riesgo en la primera activación con casilla (`aceptacion-ux.md` §6).
- Prohibida cualquier copia que sugiera consejo personal ("te conviene", "si ya ganaste…", "tu cartera debería…", montos sugeridos, "garantizado"). Si Señales/Inversiones llegan a cubrir acciones, ETF, FIBRAs o deuda, la regla es obligatoria y requiere validación legal previa.
- Divulgar cualquier afiliación con exchanges o brókers.

### 11.5 Pronósticos: solo pronósticos (Ley Federal de Juegos y Sorteos y su Reglamento)
- Solo se muestran pronósticos explicados. **Sin** recibir ni intermediar apuestas, **sin** concursos, quinielas, pools, premios, rifas, sorteos ni "regalos" en la UI ni en marketing de la herramienta.
- Sin enlaces a casas de apuestas salvo operadores con permiso SEGOB, con número de permiso, prohibición a menores y mensaje de juego responsable (y validación legal previa). Promociones con premio de Chalyb: requieren abogado.

### 11.6 Voz e imagen con IA (LFDA, reforma 2026: arts. 118 fr. VII y 121)
- **No se construye** clonación o suplantación de voz o rostro (doblaje, voz sintética parecida a una persona, avatar con la cara de alguien) en Clips, En vivo ni Asistente sin un paso de consentimiento explícito.
- Si alguna vez aparece en **Opciones avanzadas**, debe ir detrás de este paso (casilla obligatoria, desmarcada, registrada como evento `voice_likeness_consent` en `consent_events`):
  `ai.likeness.title` "Antes de usar una voz o imagen con IA" · `ai.likeness.body` "Vas a crear una voz o imagen con inteligencia artificial que se parece a una persona real. Solo puedes hacerlo con tu propia voz o imagen, o con el **acuerdo previo y por escrito** de la persona que aparece. Está prohibido usarla para engañar o hacerte pasar por alguien." · `ai.likeness.check` "☐ Confirmo que es mi voz o imagen, o que tengo el acuerdo por escrito de la persona, y acepto la [Política de Uso Aceptable]." · `ai.likeness.cta` "Continuar" · opcional: subir el acuerdo firmado.
- El Asistente se identifica como asistente automático; nunca se presenta como una persona real.

### 11.7 IVA
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Los montos visibles son totales con IVA incluido (`PRICES_INCLUDE_IVA=true`, PRICING-CARDS-SPEC §13.2); pie "Precios en MXN, IVA incluido." Sigue pendiente: residencia fiscal del operador y emisión de CFDI.

### 11.8 Quebec (decisión del dueño, **bloquea vender a residentes de Quebec**)
- Opción A: **traducir al francés** los documentos y el flujo de compra, aplicar las cláusulas especiales (Términos §16.4, 60 días de aviso para cierre, 30 días para cambios, Ley 25: persona responsable, evaluación s.17 antes de transferir datos fuera de Quebec).
- Opción B: **bloquear planes de pago para residentes de Quebec** (detección por dirección de facturación/país-provincia de la tarjeta + declaración en el registro) con el mensaje `quebec.blocked` "Por ahora los planes de pago no están disponibles en Quebec." (el plan Gratis sigue disponible si legal lo aprueba).
- Mientras no se decida, el build implementa la **Opción B detrás de un flag** (`QUEBEC_PAID_BLOCK`, nombre propuesto).

### 11.9 Otros requisitos de la revisión que tocan el código
- Datos de "Quién vende" visibles antes de pagar (art. 76 Bis fr. III). · Sin aceptación por simple uso (browsewrap). · Re-aceptación con modal por cambios de Términos. · Banner de cookies antes de cookies no esenciales. · Sin cláusulas ni flujos contra reseñas. · Decisiones automatizadas (antifraude de prueba) con revisión humana disponible. · Registro de contrato de adhesión ante PROFECO (tarea del dueño, no del código).

---

## 12. Decisiones abiertas para el dueño
| # | Decisión | Por qué importa | Default del build |
|---|---|---|---|
| D1 | ~~¿Los precios incluyen IVA?~~ Resuelto: $997 / $9,970 / $3,799 / $36,325 son totales con IVA. Precios: ver PRICING-CARDS-SPEC.md (fuente única) | Precio total visible obligatorio | UI dice "Precios en MXN, IVA incluido." |
| D2 | Quebec: traducir o bloquear planes de pago | LPC/Ley 25/Carta | Bloquear detrás de flag |
| D3 | Casilla en "Tu prueba" (paso 2) **o** en "Pago" (paso 3) | `trial-to-paid-path.md` §1 la pone en el paso 2 ("Continuar al pago" deshabilitado); `aceptacion-ux.md` §3.3 y los mockups 14/15 la ponen junto a "Empezar mis 7 días gratis" | Paso 3 (junto al botón que crea la suscripción); si el abogado lo pide, también en paso 2 |
| D4 | Botón como aceptación sin casilla | Solo con aprobación del abogado | Casilla obligatoria |
| D5 | Recordatorio extra el día 29 | Opcional | Apagado |
| D6 | Horario y SLA reales de "Hablar con una persona" | "Te respondemos en minutos" debe ser cierto | Usar `help.human.sub.alt` sin SLA |
| D7 | Bases del programa "Tienes la idea" (cómo se reparten ganancias) | Promesa comercial | Formulario sin promesa de % hasta tener bases |
| D8 | Créditos por plan (Gratis/Pro/VIP) y límites de duración de video | Copia de créditos y errores | Valores en `PRICING` |
| D9 | Número de clips recomendado | Mockups 03/06 dicen "Te recomendamos 5" pero las opciones son 3/6/10 | Usar "6" en producción (no se tocaron 03/06) |
| D10 | "Confianza alta/media" en señales | Es una etiqueta general, no personal; confirmar con legal | Mantener, igual para todos |
| D11 | Línea de juego responsable para Pronósticos | Recurso oficial no verificado | Sin enlace hasta validar |
| D12 | Promociones con premio / sorteos de planes | Requiere permiso SEGOB/abogado | Prohibido |

---

## 13. Índice de mockups
| # | Archivo | Pantalla | Fase |
|---|---|---|---|
| 00 | `mockups/00-overview.png` | Vista general original (01–08) | — |
| 01 | `mockups/01-inicio.png` | Inicio | 1 |
| 02 | `mockups/02-clips-paso1.png` | Clips · pegar enlace | 3 |
| 03 | `mockups/03-clips-paso2.png` | Clips · formato | 3 |
| 04 | `mockups/04-clips-creando.png` | Clips · creando | 3 |
| 05 | `mockups/05-clips-listos.png` | Clips · listos | 3 |
| 06 | `mockups/06-avanzado.png` | Clips · opciones avanzadas | 3 |
| 07 | `mockups/07-mi-cuenta.png` | Mi cuenta | 1 |
| 08 | `mockups/08-inicio-movil.png` | Inicio móvil | 1 |
| 09 | `mockups/09-overview-completo.png` | Hoja de contacto de todas las pantallas | — |
| 10 | `mockups/10-landing.png` | Landing (página completa) | 4 |
| 11 | `mockups/11-landing-movil.png` | Landing móvil | 4 |
| 12 | `mockups/12-planes.png` | Planes | 2/4 |
| 13 | `mockups/13-crear-cuenta.png` | Paso 1 · Crear cuenta | 2 |
| 14 | `mockups/14-tu-prueba.png` | Paso 2 · Tu prueba | 2 |
| 15 | `mockups/15-pago.png` | Paso 3 · Pago Mercado Pago | 2 |
| 16 | `mockups/16-listo.png` | ¡Listo! | 2 |
| 17 | `mockups/17-banners.png` | 4 avisos de prueba | 2 |
| 18 | `mockups/18-cancelar.png` | Cancelar (confirmar + hecho) | 2 |
| 19 | `mockups/19-mis-resultados.png` | Mis resultados | 3 |
| 20 | `mockups/20-senales-paso1.png` | Señales · monedas | 3 |
| 21 | `mockups/21-senales-listo.png` | Señales · activas | 3 |
| 22 | `mockups/22-en-vivo.png` | En vivo | 3 |
| 23 | `mockups/23-mas-herramientas.png` | Más herramientas (incluido / Gratis) | 3 |
| 24 | `mockups/24-vacio-y-error.png` | Vacío · error · falta un paso | 3 |
| 25 | `mockups/25-ayuda.png` | Ayuda | 3 |
| 26 | `mockups/26-notificaciones.png` | Avisos (móvil) | 3 |
| 27 | `mockups/27-admin-centro.png` | Panel · Centro de mando | 5 |
| 28 | `mockups/28-admin-personas.png` | Panel · Personas + confirmación | 5 |
| 29 | `mockups/29-admin-dinero.png` | Panel · Dinero | 5 |
| 30 | `mockups/30-mi-plan.png` | Mi plan · Pro anual pagado | 2 |
| 40 | `mockups/40-landing.png` | Landing v2 (página completa, ver LANDING-SPEC.md) | 4 |
| 41 | `mockups/41-landing-movil.png` | Landing v2 móvil | 4 |
| 42 | `mockups/42-landing-hero.png` | Landing v2 · primera pantalla 1440×900 | 4 |
| 43 | `mockups/43-landing-precios.png` (+ `43b-…-mensual`) | Landing v2 · Precios Anual / Mensual | 4 |
| 44 | `mockups/44-landing-movil-cta-fijo.png` | Landing v2 · botón fijo móvil | 4 |

**Orden de trabajo sugerido:** Fase 0 → 1 → 2 (con §11.1–11.3 y §10.3 en el mismo PR que el cobro) → 3 → 4 → 5 → 6. Ningún cobro real se activa antes de cerrar D1, D2 y la firma del abogado.
