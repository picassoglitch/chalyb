# Chalyb · LANDING-SPEC: landing pública `/` (para Claude Code)

> Rediseño de https://www.chalyb.com/ con el mismo sistema visual del app aprobado.
> **Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Montos, prueba, insignia, toggle y pies de IVA salen de ahí.
> **Fuentes que mandan:** `BUILD-SPEC.md` (tokens §1, glosario §3, reglas de precio §6.2, requisitos legales §11, decisiones §12), `legal/aceptacion-ux.md` (cookies §9, aviso de riesgo §6) y `trial-to-paid-path.md`. Si algo de aquí choca con §11 de BUILD-SPEC, **gana §11**.
> **Este documento reemplaza a BUILD-SPEC §8.1** (landing de primera pasada, mockups 10/11). La página `/planes` (mockup 12, BUILD-SPEC §6.3) no cambia.

## 0. Mockups y HTML de referencia
| Archivo | Qué muestra |
|---|---|
| `mockups/40-landing.png` | Landing completa, escritorio 1440 (página entera) |
| `mockups/41-landing-movil.png` | Landing completa, móvil 390 (página entera) |
| `mockups/42-landing-hero.png` | Primera pantalla de escritorio, 1440×900 (lo que se ve sin scroll) |
| `mockups/43-landing-precios.png` | Sección Precios, toggle en **Anual** (estado por defecto) |
| `mockups/43b-landing-precios-mensual.png` | Sección Precios, toggle en **Mensual** |
| `mockups/44-landing-movil-cta-fijo.png` | Móvil 390×844 después del hero: botón fijo inferior |
| `mockups/landing-src/inicio-movil.png` | Pantalla de Inicio móvil (08) sin nombre de persona; se usa en el hero |

HTML: `html/40-landing.html`, `html/41-landing-movil.html` (código en `more_landing.py`; se genera con `python3 build.py` y se captura con `python3 render.py landing 40 41 42 43 44`). Las medidas en px del HTML son la referencia exacta de espaciado.

Captura del sitio actual (2 oct 2026): `/workspace/chalyb-landing/current/` (`desktop-1440-full.png`, `mobile-390-full.png`, versiones `-clean` sin banner de cookies, `-fold`, `extract.json` con enlaces/encabezados/meta, `body-text.txt`).

---

## 1. Reglas
1. **Mismo sistema que el app:** tokens de BUILD-SPEC §1 (`--bg #F5F5F7`, tarjetas blancas, `--accent #5B4BFF`, verde **solo** para "listo/hecho", Inter, botones de 60/68/72 px). Nada de colores nuevos.
2. **Una sola acción principal** por bloque: "Empezar mis 7 días gratis". Todo lo demás es secundario (botón blanco con borde o enlace).
3. **Producto establecido:** prohibido "próximamente", "beta", "coming soon", "en construcción", y etiquetas tipo "Nuevo" en herramientas.
4. **Nada inventado:** sin testimonios, sin nombres de personas, sin logos de clientes o medios, sin cifras de usuarios, ahorros de tiempo, ganancias, estrellas ni "+10,000 creadores". Las pantallas del app en el hero usan datos de demostración **sin nombre de persona**.
5. **Señales / Inversiones / Pronósticos:** nunca prometer rendimientos ni consejo personal. Siempre visible la leyenda junto a la tarjeta (ver §3.3). Prohibido: "gana dinero", "ganancias", "rendimiento", "garantizado", "te conviene", "sin riesgo", "copiar señales" / "copiar automáticamente", "apuesta" (única excepción: las leyendas exactas "…no es asesoría de apuestas").
6. **Precios** solo desde `PRICING` (PRICING-CARDS-SPEC.md, fuente única). **Ningún monto escrito a mano** en componentes, metadatos ni JSON-LD.
7. **Nombres de herramienta** sin prefijo (Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles, Inversiones). "Chalyb" solo como logo y en textos de marca.
8. `lang="es-MX"`, español de México, palabras simples.
9. **Visibilidad de herramientas:** cada tarjeta se pinta solo si la herramienta está activa en el panel (`/dashboard/herramientas`, BUILD-SPEC §9.1 / regla §0.3). El sitio actual solo muestra Clips, Señales y En vivo; el mockup muestra las 7 porque así lo pide el brief. **Si alguna no está terminada, su tarjeta no se muestra** y la rejilla se reacomoda (§3.3).

---

## 2. Ruta y arquitectura
- **Ruta:** `/` (la app ya usa `app/[locale]/…` con `es` por defecto y `/en` como alterno; se toca solo la página `es`). `/en` se queda como está hasta que se traduzca, **pero debe leer los mismos precios de `PRICING`**.
- **Render:** estático/ISR (sin datos de usuario en el HTML). Lo único del lado del cliente: toggle Mensual/Anual, acordeón (usar `<details>`), menú móvil, hoja de "Proponer mi idea", botón fijo móvil y analítica.
- **Estado con sesión** (lectura de cookie de sesión en el cliente, sin bloquear el render): "Iniciar sesión" → **"Abrir Chalyb"** (`/app`); botón "Prueba gratis" del nav → **"Abrir Chalyb"**; CTAs de prueba → `/app/prueba` si nunca usó prueba, o `/app/cuenta/plan` si ya tiene plan (mismos estados de BUILD-SPEC §6.3).
- **Componentes** (en `components/landing/`, reusando los de `components/ui/` de BUILD-SPEC §1.6):
  `PublicNav` (nueva versión) · `LandingHero` · `DeviceComposite` (`LaptopFrame`, `PhoneFrame`, `NotificationCard`) · `ToolBento` + `ToolCard` + `AllInOneCard` · `StepsWizard` + `StepCard` · `ClipGallery` (usa `Thumb`) · `AudienceGrid` · `TrustStrip` · `PricingSection` (`Segmented`, `PlanCard`, `PriceBlock`) · `FaqList` · `PartnerStrip` + `PartnerSheet` · `FinalCta` · `PublicFooter` (nueva versión) · `MobileStickyCta`.
- **Textos:** todos en `messages/es-MX.json` bajo `landing.*` (llaves abajo). Montos con `formatMXN()` desde `PRICING`.

### 2.1 Anclas
`#herramientas` · `#como` · `#precios` (y un `<span id="planes">` dentro de la sección, para no romper enlaces viejos a `/#planes`) · `#preguntas` · `#idea`. Scroll suave con `scroll-margin-top: 96px` (alto del nav). Con `prefers-reduced-motion` el salto es instantáneo.

---

## 3. Secciones (en este orden), copia exacta y comportamiento

### 3.1 Nav · `PublicNav`
- **Escritorio (≥1024):** alto 80 px, fondo `rgba(255,255,255,.82)` + `backdrop-filter: saturate(180%) blur(20px)`, borde inferior `--line`, **fijo arriba** (`position: sticky; top: 0`).
  Izquierda: logo (componente `Logo` del app; mismo activo de marca que use el app, el sitio actual usa `/chalyb-mark.png`; deben coincidir). Enlaces 18 px/550 `--ink2`: `landing.nav.tools` **"Herramientas"** → `/#herramientas` · `landing.nav.pricing` **"Precios"** → `/#precios` · `landing.nav.help` **"Ayuda"** → `/contacto`.
  Derecha: `landing.nav.signin` **"Iniciar sesión"** (texto 18 px/600, objetivo táctil 50 px) → `/sign-in` · botón primario 50 px `landing.nav.trial` **"Prueba gratis"** → URL de prueba (§4).
- **Móvil (<1024):** barra de 60 px: logo · "Iniciar sesión" · botón hamburguesa (círculo 48 px, `aria-expanded`, `aria-controls`). El menú es una hoja que baja con: Herramientas · Precios · Ayuda · Iniciar sesión · botón `btn-xl` "Empezar mis 7 días gratis". Cierra con ✕, con Esc y al tocar un enlace. Trampa de foco mientras está abierto.
- Se conserva el enlace "Ir al contenido" (`#main`) como primer elemento enfocable.

### 3.2 Hero · `LandingHero` (mockup 42)
- **Copia:**
  - Eyebrow (pastilla blanca con etiqueta tint): `landing.hero.eyebrowTag` **"Todo incluido"** + `landing.hero.eyebrow` **"Un plan, todas las herramientas"** (móvil: solo una pastilla tint "Un plan, todas las herramientas").
  - `h1` `landing.hero.title`: **"Tú duermes."** (salto de línea) **"Tus bots trabajan."** (segunda línea con degradado de texto `90deg #5B4BFF → #8B5BFF`). Es el único `h1` de la página.
  - `landing.hero.sub`: **"Clips para tus redes, señales de cripto, tu transmisión y mucho más, en un solo plan."**
  - CTA primario 72 px (móvil 66 px, ancho completo) `landing.cta.trial`: **"Empezar mis 7 días gratis"** + ícono flecha.
  - Debajo `landing.hero.note`: **"Cancela cuando quieras."** (650, `--ink`) **"Hoy pagas $0."** (`--ink2`).
  - Sellos con check acento: **"En español"** · **"Sin saber de tecnología"** · **"Cancela en 1 clic"**.
- **Visual = composite real del app** (`DeviceComposite`):
  - Laptop (marco en CSS, no imagen) con la pantalla **"Tus clips están listos"** (mockup 05).
  - Teléfono (marco en CSS) encima a la derecha con **Inicio móvil** (mockup 08 sin nombre: saludo "Hola 👋", avatar genérico) → `mockups/landing-src/inicio-movil.png`.
  - Tarjeta de notificación tipo iOS sobre la esquina superior izquierda de la laptop: "CHALYB · ahora" / **"Tus clips están listos"** / "Ya tienen subtítulos. Descárgalos cuando quieras." (texto real de `notif.clipsReady`, sin cifras).
  - Halo radial suave `rgba(123,108,255,.28)` detrás. Sin animación obligatoria; si se agrega una entrada suave (≤400 ms, opacidad/translate 12 px), se desactiva con `prefers-reduced-motion`.
  - `alt` del grupo: "Chalyb en computadora y celular: la pantalla Tus clips están listos y la pantalla de Inicio."
- **Layout:** escritorio: contenedor 1360 px, rejilla `600px 1fr`, gap 36, `min-height` 740, contenido centrado verticalmente; el borde de la siguiente sección asoma en 1440×900. Laptop 560 px de ancho (pantalla 536×335), teléfono 200 px. 1024–1279: h1 56 px, laptop 480, teléfono 170. <1024: una columna, texto arriba, composite abajo (laptop 272 px + teléfono 108 px, notificación 262 px).
- **Prueba de la abuela:** en 390×844 el botón "Empezar mis 7 días gratis" se ve completo sin scroll (en el mockup 41 el botón termina en y≈520 de 844, contando la barra de estado de 50 px).

### 3.3 "Todo en un solo plan" · `ToolBento` · `#herramientas` (fondo blanco)
- Encabezado: label **"Herramientas"** · `h2` **"Todo en un solo plan"** · sub **"Cada herramienta hace una cosa y la hace por ti. Todas vienen incluidas en Pro."**
- Rejilla bento 3 columnas (gap 20, tarjetas `--bg`, radio 28, padding 30). Cada tarjeta: ícono de herramienta 60 px (color de BUILD-SPEC §1.1), `h3` 26 px, frase 18 px `--ink2`, al pie pastilla tint **"✓ Incluido en Pro"**.
  | Fila | Tarjeta | Copia |
  |---|---|---|
  | 1 | **Clips** (ocupa 2 columnas; a la derecha 3 miniaturas verticales `Thumb` inclinadas −7°/0°/+7°) | "Pega el enlace de tu stream y recibe clips cortos con subtítulos para TikTok, Reels y Shorts." |
  | 1 | **Señales** | "Te avisamos cuándo es buen momento para comprar o vender cripto." + leyenda ⓘ **"Informativo, no es asesoría financiera."** |
  | 2 | **En vivo + Asistente** (dos íconos encimados) | "Maneja tu transmisión con botones grandes. Y un Asistente que contesta a tus clientes y seguidores, de día y de noche." |
  | 2 | **Pronósticos** | "Los pronósticos deportivos del día, explicados en simple." + ⓘ **"Informativo, no es asesoría de apuestas."** |
  | 2 | **Inmuebles** | "Publica tus propiedades y atiende a interesados sin perder tiempo." |
  | 3 | **Inversiones** | "Tu exchange sigue las reglas que tú escribes. Nunca podemos retirar tu dinero." + ⓘ **"Informativo, no es asesoría financiera."** |
  | 3 | **Tarjeta "todo incluido"** (2 columnas, degradado de "Tarjeta de plan" BUILD-SPEC §1.1) | `h3` **"Fuiste por una cosa y te llevaste todo."** · "Entras por los clips y te quedas con las señales, tu transmisión, tu Asistente y más. Todo en el mismo plan, sin pagar extra." · fila con los íconos de las herramientas visibles · botón blanco **"Empezar mis 7 días gratis"** (móvil: "Entras por los clips y te quedas con todo lo demás. Mismo plan, sin pagar extra.") |
- Las leyendas ⓘ son texto real (15 px, `--ink2`), no tooltip.
- **Si una herramienta está oculta:** se quita su tarjeta; la tarjeta "todo incluido" ocupa el espacio restante de su fila (`grid-column: span N`) y su fila de íconos y la lista del CTA final se generan con las herramientas visibles. Si se oculta En vivo **o** Asistente, la tarjeta combinada muestra solo la que quede, con su frase de BUILD-SPEC §7.4.
- **Responsive:** ≥1100 como el mockup · 768–1099: 2 columnas (Clips y "todo incluido" ocupan 2) · <768: 1 columna (tarjetas con ícono 48 px y título en línea; Clips con 3 miniaturas debajo del texto) (mockup 41).

### 3.4 "Así de fácil: 3 pasos" · `StepsWizard` · `#como` (fondo `--bg`)
- Encabezado: label **"Cómo funciona"** · `h2` **"Así de fácil: 3 pasos"** · sub **"Tal como lo ves en el app. Así se hacen tus clips:"**
- 3 tarjetas blancas (radio 28). Arriba de cada una, **recorte real de la pantalla del asistente** (mockups 02, 03, 05) en un marco `--bg` con borde 1 px `--line`; debajo el mismo indicador del app: círculo numerado 44 px + barra de 3 segmentos + "Paso X de 3".
  1. **"Pega el enlace"**: "Copia la dirección de tu stream o video y pégala. Funciona con YouTube, Twitch, Kick y Facebook." (recorte de 02: título, campo de enlace, conectar y Continuar)
  2. **"Elige dónde lo vas a publicar"**: "TikTok, Reels, Shorts, YouTube o Instagram. Nosotros te recomendamos la mejor forma." (recorte de 03)
  3. **"Descarga tus clips"**: "Te avisamos cuando estén listos, ya con subtítulos. Descárgalos o compártelos." (recorte de 05)
- Debajo, pastilla blanca: **"Todas las herramientas funcionan igual: 3 pasos, botones grandes y palabras simples."**
- Responsive: 3 columnas ≥1024 · 1 columna abajo (mockup 41).

### 3.5 Galería de clips · `ClipGallery` (fondo blanco)
- label **"Clips"** · `h2` **"Así se ven tus clips"** · sub **"Verticales, con subtítulos y listos para publicar. Tú solo pegas el enlace."** (móvil: "Verticales, con subtítulos y listos para publicar.")
- 6 tarjetas (`--bg`, radio 24) con `Thumb` vertical 9:16, duración y subtítulo grande, título y "Vertical · con subtítulos": "El mejor momento del stream" · "Reacción épica" · "La jugada final" · "Respondiendo al chat" · "Risa con los amigos" · "El consejo del día" (mismos que la pantalla 05).
- Pastillas de plataforma: TikTok · Reels · Shorts (íconos de marca solo como indicador de formato, no como aval).
- Pie: **"Imágenes de ejemplo."** (una sola vez; se quita la etiqueta "EJEMPLO" de cada tarjeta del sitio actual).
- Si después se usan clips reales: póster estático, `preload="none"`, nunca autoplay con sonido, y solo con permiso escrito del creador.
- Responsive: 6 columnas ≥1200 · 3 columnas 768–1199 · <768 carrusel horizontal con `scroll-snap` (tarjetas de 156 px, se asoma la tercera).

### 3.6 Para quién · `AudienceGrid` + `TrustStrip` (fondo `--bg`)
- label **"Para quién"** · `h2` **"Para ti, y para tu mamá también"** · sub **"Si no tienes tiempo de editar, contestar o estar pendiente, Chalyb lo hace por ti."**
- 4 tarjetas blancas (ícono en cuadro tint 60 px):
  - **Streamers**: "Clips de cada transmisión y tus escenas de OBS con un toque."
  - **Creadores**: "Publica todos los días sin pasar horas editando."
  - **Negocios**: "Un Asistente que contesta a tus clientes, de día y de noche."
  - **Tu mamá también** (tarjeta con borde tint y corazón en `#FF375F`): "Botones grandes y palabras simples. Si sabe mandar un WhatsApp, sabe usar Chalyb."
- Franja: 🌐 **"En español, para México y Latinoamérica"** · 🛡 **"Pago seguro con Mercado Pago"** · ✓ **"Cancela en 1 clic, sin llamadas"** (móvil: lista agrupada estilo iOS).
- Sin fotos de personas.

### 3.7 Precios · `PricingSection` · `#precios` (fondo blanco) (mockups 43 y 43b)
**Precios: ver PRICING-CARDS-SPEC.md (fuente única).** Esta sección ya no define montos ni textos de precio; si algo de aquí choca con ese archivo, gana ese archivo. Resumen de lo que muestran 43 (Anual) y 43b (Mensual):
- label **"Precios"** · `h2` **"Empieza gratis, crece con Pro"** · sub **"Prueba Pro gratis 7 días. Cancela en 1 clic, sin llamadas."**
- Toggle **Mensual / Anual** (Anual por defecto en las tarjetas; es solo exhibición de precio, el checkout nunca preselecciona el anual) con pastilla **"Ahorra hasta 20%"**.
- 3 tarjetas (escritorio: Gratis · **Pro** · VIP; móvil: **Pro** · Gratis · VIP), botones alineados en la misma línea. Columnas `minmax(0,1fr) minmax(0,1.12fr) minmax(0,1fr)` para que no cambien de ancho al cambiar el toggle.
  - **Gratis:** "$0" · "Sin tarjeta · Para siempre" · [Crear cuenta gratis].
  - **Pro** (resaltada, insignia **"Más popular"**): Anual "$9,970 MXN al año" · "Se renueva cada año" · "o paga mes a mes: $997 MXN al mes (plan mensual)" · pastilla "Ahorras $1,994 al año · 16%". Mensual "$997 MXN al mes" · "Se renueva cada mes" · con `SHOW_REFERENCE_PRICE=false`: "Precio de lanzamiento: $997 MXN al mes". Botón **"Empezar mis 7 días gratis"** + nota "Hoy pagas $0. El {fecha} se cobran …" (texto exacto PRICING-CARDS-SPEC §16.1).
  - **VIP:** Anual "$36,325 MXN al año" · "Ahorras $9,263 al año · 20%" · [Elegir VIP anual]. Mensual "$3,799 MXN al mes" · [Elegir VIP mensual]. "Se cobra hoy. Sin prueba gratis. Cancela en 1 clic."
- Debajo: **"Precios en MXN, IVA incluido."** + "Pago seguro con Mercado Pago." + "Prueba Pro gratis 7 días: mensual o anual, una vez por cuenta y por tarjeta. VIP no tiene prueba." + enlace **"Ver todos los planes y qué incluyen"** → `/planes`.
- **Prohibido:** "2 meses gratis", "mes gratis", "equivale", "Mejor oferta", precio tachado fuera del componente con `SHOW_REFERENCE_PRICE`.

### 3.8 Preguntas frecuentes · `FaqList` · `#preguntas` (fondo `--bg`)
- label **"Preguntas"** · `h2` **"Preguntas frecuentes"**. Escritorio: 2 columnas de 4; móvil: lista agrupada. `<details>/<summary>`; abierta por defecto la 1 (y en escritorio también la 6). Botón circular de chevron 36 px; abierto = tint acento.
  1. **"¿De verdad los primeros 7 días son gratis?"**: "Sí, en Pro mensual y Pro anual. Hoy pagas $0 y hoy mismo te enviamos por correo el aviso de cobro, con la fecha y el monto. Si no quieres seguir, cancelas en 1 clic antes de esa fecha y no se te cobra nada."
  2. **"¿Cuánto pago después de los 7 días?"**: montos desde `PRICING` (Pro mensual / Pro anual; ver PRICING-CARDS-SPEC.md, fuente única) + "Antes de cada renovación te avisamos por correo."
  3. **"¿Cómo cancelo?"**: "Entra a Mi cuenta → Mi plan → Cancelar. Es 1 clic y 1 confirmación, sin llamadas. Sigues con tu plan hasta el final del periodo que pagaste."
  4. **"¿Necesito saber de tecnología?"**: "No. Cada herramienta te guía en 3 pasos, con botones grandes y palabras simples."
  5. **"¿Qué incluye el plan Pro?"**: "Todas las herramientas: Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones, con créditos nuevos cada mes. Sin pagos extra." (lista generada con las herramientas visibles)
  6. **"¿Las Señales me dicen en qué invertir?"**: "No. Son avisos informativos, iguales para todos, y no usan tus saldos ni tus inversiones. No son asesoría financiera: tú decides."
  7. **"¿Cómo pago?"**: "Con tarjeta de crédito o débito, de forma segura con Mercado Pago. Chalyb no guarda el número de tu tarjeta."
  8. **"¿Puedo cambiar de plan?"**: "Sí. Desde Mi cuenta → Mi plan puedes pasar de mensual a anual, subir a VIP o volver a Gratis cuando quieras."
- "¿Me dan factura?" **no se agrega** hasta que el dueño confirme la emisión de CFDI (BUILD-SPEC §11.7; el sitio actual tampoco la tiene).
- Opcional: JSON-LD `FAQPage` con exactamente estos textos.

### 3.9 Socios (ligero) · `PartnerStrip` · `#idea` (fondo `--bg`, **siempre después de Precios y de FAQ**)
- Franja blanca con borde tint 1.5 px (no es una sección grande): ícono foco en cuadro `#FFF4D6`/`#B07800`, label **"Socios"**, `h3` **"Tienes la idea, nosotros la construimos"**, texto **"Cuéntanos qué herramienta te haría la vida más fácil. La revisamos y te respondemos."**, botón secundario **"Proponer mi idea"**.
- El botón abre `PartnerSheet` (modal en escritorio, hoja inferior en móvil) con el **mismo formulario que hoy está incrustado en la página**: "Tu nombre" · "Tu correo" · "¿Qué herramienta te gustaría?" · aviso "Al enviar, aceptas que usemos tus datos para responderte, como dice el [Aviso de Privacidad]." · botón primario **"Enviar mi idea"** · éxito: "¡Gracias! Recibimos tu idea. Te escribimos a {correo}." Mismo endpoint actual (llega a Panel → Necesita tu atención).
- **Se quita "Si la hacemos, compartimos las ganancias contigo"** hasta que existan las bases del programa (decisión D7).

### 3.10 CTA final · `FinalCta`
- Banda con degradado de "Tarjeta de plan" (radio 36, círculos decorativos `rgba(255,255,255,.08–.10)`):
  `h2` **"Empieza hoy."** (salto) **"Mañana ya trabajan por ti."** · **"Clips, Señales, En vivo, Asistente, Pronósticos, Inmuebles e Inversiones. Todo en un solo plan."** (móvil: "Todas las herramientas en un solo plan.") · botón blanco 72 px **"Empezar mis 7 días gratis"** · **"Hoy pagas $0. Cancela cuando quieras."**

### 3.11 Footer · `PublicFooter`
- Columna marca: logo + "Herramientas que trabajan por ti, en español y sin saber de tecnología."
- **Herramientas:** Clips · Señales · En vivo · Ver todas (→ `/#herramientas`)
- **Chalyb:** Precios (`/#precios`; en otras páginas `/planes`) · Ayuda (`/contacto`) · Proponer una idea (`/#idea`) · Iniciar sesión (`/sign-in`)
- **Legal:** Términos y Condiciones (`/legal/terms`) · **Términos de Suscripción** · Aviso de Privacidad (`/legal/privacy`) · **Uso aceptable** · Quién vende (`/quien-vende`)
- **Contacto:** Escríbenos (`/contacto`)
- Caja gris: "Señales, Pronósticos e Inversiones son informativos: no son asesoría financiera ni de apuestas, y no garantizan resultados. Las decisiones y los riesgos son tuyos."
- Barra inferior: "© {año} Chalyb. Precios en pesos mexicanos (MXN), IVA incluido." · "Pago seguro con Mercado Pago" · **"Cookies"** (abre "Configurar" del banner) · "Español · English" (enlace a `/en`).
- **Rutas legales que faltan hoy:** `/suscripcion`, `/uso-aceptable`, `/legal/subscription` y `/legal/acceptable-use` responden **404** en producción. Crear `/legal/subscription` y `/legal/acceptable-use` (mismo patrón que `/legal/terms`) con los textos de `legal/terminos-de-suscripcion.md` y `legal/uso-aceptable-y-contenido.md` tal cual (tras firma del abogado), más redirecciones `/suscripcion` → `/legal/subscription` y `/uso-aceptable` → `/legal/acceptable-use` (igual que ya existe `/terminos` → `/legal/terms`), porque BUILD-SPEC enlaza `/suscripcion` desde la casilla de cobro. Agregarlas al `sitemap.xml`. Ningún enlace del footer puede dar 404.

### 3.12 Botón fijo móvil · `MobileStickyCta` (mockup 44)
- Solo <768. Aparece cuando el CTA del hero sale de la vista (IntersectionObserver) y **se oculta** mientras se ven las tarjetas de Precios o el CTA final, y mientras el banner de cookies esté abierto.
- Barra blanca `rgba(255,255,255,.97)` + desenfoque, borde superior `--line`, padding inferior `max(26px, env(safe-area-inset-bottom))`: botón 60 px **"Empezar mis 7 días gratis"** + "Hoy pagas $0. Cancela cuando quieras." (14 px).
- El contenido de la página agrega `padding-bottom` igual al alto de la barra para que no tape el footer.

### 3.13 Banner de cookies (se conserva)
Mismo texto y botones que hoy (`aceptacion-ux.md` §9): "Usamos cookies necesarias para que Chalyb funcione y, si aceptas, cookies de analítica y publicidad para mejorar y medir campañas. [Aviso de Privacidad]" · [Aceptar todas] [Solo necesarias] [Configurar]. Analítica y publicidad apagadas hasta aceptar.

---

## 4. CTAs y enlaces
Todas las CTAs de prueba llevan a registro con intención de prueba. Se conservan los parámetros que ya lee el sitio (`mode`, `plan`) y se agregan `intent`, `interval` y `from` (si el registro no los usa todavía, se guardan en la sesión para el paso "Tu prueba" y para atribución).

| `cta_id` | Texto | Destino |
|---|---|---|
| `nav_trial` | Prueba gratis | `/sign-in?mode=signup&plan=pro&intent=trial&interval={toggle}&from=nav_trial` |
| `nav_signin` | Iniciar sesión | `/sign-in` |
| `hero_trial` | Empezar mis 7 días gratis | `/sign-in?mode=signup&plan=pro&intent=trial&interval={toggle}&from=hero_trial` |
| `tools_trial` | Empezar mis 7 días gratis (tarjeta "todo incluido") | igual, `from=tools_trial` |
| `pricing_free` | Crear cuenta gratis | `/sign-in?mode=signup&plan=free&from=pricing_free` |
| `pricing_pro` | Empezar mis 7 días gratis | `/sign-in?mode=signup&plan=pro&intent=trial&interval={year\|month}&from=pricing_pro` |
| `pricing_vip` | Elegir VIP anual / Elegir VIP mensual | `/sign-in?mode=signup&plan=vip&interval={year\|month}&from=pricing_vip` |
| `pricing_all` | Ver todos los planes y qué incluyen | `/planes` |
| `partner_open` | Proponer mi idea | abre `PartnerSheet` |
| `final_trial` | Empezar mis 7 días gratis | igual, `from=final_trial` |
| `sticky_trial` | Empezar mis 7 días gratis (móvil) | igual, `from=sticky_trial` |
| `menu_trial` | Empezar mis 7 días gratis (menú móvil) | igual, `from=menu_trial` |

`{toggle}` = valor actual del toggle de precios (por defecto `year`). El paso "Tu prueba" (`/app/prueba`, mockup 14) **preselecciona Pro mensual (o nada), nunca el anual**, aunque llegue `interval=year` (PRICING-CARDS-SPEC §16.2); `interval` se guarda para analítica.

---

## 5. Analítica
- Usar el wrapper existente (`track()`); si no existe, crear `lib/analytics.ts`. **No envía nada hasta que el usuario acepte analítica** en el banner. Sin consentimiento, la atribución se hace en el servidor con el parámetro `from` (sin cookies).
- Propiedades comunes: `page: "landing"`, `locale`, `device` (`desktop|mobile`), `logged_in` (bool). Nunca correo, nombre ni IP en eventos.

| Evento | Cuándo | Propiedades |
|---|---|---|
| `landing_view` | carga de `/` | `referrer_domain`, `utm_*` |
| `landing_cta_click` | clic en cualquier CTA de §4 | `cta_id`, `plan` (`free\|pro\|vip`), `interval`, `section` |
| `landing_nav_click` | enlaces del nav/menú | `target` (`herramientas\|precios\|ayuda`) |
| `landing_signin_click` | Iniciar sesión | `location` (`nav\|menu\|footer`) |
| `landing_menu_open` | abre menú móvil | — |
| `landing_section_view` | 50 % de una sección visible, 1 vez por sección | `section` (`hero\|herramientas\|como\|galeria\|para_quien\|precios\|preguntas\|idea\|final`) |
| `landing_pricing_toggle` | cambia Mensual/Anual | `interval` |
| `landing_faq_open` | abre una pregunta | `faq_id` (1–8) |
| `landing_partner_open` / `landing_partner_submit` | abre hoja / envía | `result` (`ok\|error`) |
| `landing_footer_click` | enlaces del footer | `target` (`terminos\|suscripcion\|privacidad\|uso_aceptable\|quien_vende\|contacto\|cookies\|en`) |
| `landing_sticky_shown` | aparece el botón fijo | — |

---

## 6. SEO
- `<title>`: **"Chalyb: bots que trabajan por ti mientras duermes"** (49 caracteres; conserva la frase que ya posiciona).
- `meta description`: **"Clips para tus redes, señales de cripto, tu transmisión y más en un solo plan. Prueba Pro gratis 7 días y cancela cuando quieras. En español."** (≈145). Sin montos en el description.
- OG/Twitter: mismo título y descripción; `og:locale es_MX`; **imagen nueva 1200×630** hecha con el composite del hero (laptop + teléfono) sobre `--bg` con el h1; `summary_large_image`. Sin precios en la imagen.
- `canonical` `https://www.chalyb.com/`; se conservan los `hreflang` actuales (`es`, `en` → `/en`, `x-default`).
- Encabezados: un `h1` (hero), un `h2` por sección, `h3` en tarjetas. Los títulos de footer **no** deben ser `h2` (hoy lo son: "HERRAMIENTAS", "CHALYB", "LEGAL"); usar `<p>`/`<h3>` visualmente igual.
- JSON-LD: `Organization` (nombre, url, logo) y `WebSite`. `SoftwareApplication` con `offers` generado desde `PRICING` (PRICING-CARDS-SPEC.md, fuente única). `FAQPage` opcional (§3.8).
- `robots.txt` y `sitemap.xml` actuales se mantienen; agregar las rutas legales nuevas.

---

## 7. Rendimiento y recursos
- **Imágenes del hero** (LCP): se exportan desde las pantallas reales del app (o desde `mockups/05-clips-listos.png` y `mockups/landing-src/inicio-movil.png` mientras no haya capturas de producción con cuenta demo **sin nombre de persona**):
  - `public/landing/hero-laptop.avif` + `.webp`, 1072×670 (2× de 536 px) y 544×340 (1×, para móvil 272 px).
  - `public/landing/hero-phone.avif` + `.webp`, 400×866 (2× de 200 px) y 216×468.
  - `public/landing/paso-1|2|3.avif` + `.webp`, 680 px de ancho (2× de 340), ya recortadas como en el mockup.
  - Formato: **AVIF primero, WebP de respaldo** (con `next/image` o `<picture>`); calidad AVIF ~50, WebP ~75; sin PNG en producción.
  - `next/image` con `width`/`height` explícitos (cero CLS), `sizes="(max-width: 767px) 272px, 536px"` para la laptop; **`priority` / `fetchpriority="high"` solo en la laptop**; teléfono `loading="eager"` sin prioridad; pasos y todo lo de abajo `loading="lazy"`.
  - Presupuesto: hero ≤ 120 KB en total (AVIF, móvil); página completa ≤ 450 KB de imágenes en la primera carga.
- **Marcos de laptop/teléfono, notificación y miniaturas de clip** se hacen con CSS (degradados del componente `Thumb`), **no imágenes**.
- Fuente: Inter con `next/font` (variable, `latin`, `display: swap`), sin cargar Google Fonts por red.
- JS del cliente mínimo (toggle, menú, hoja, botón fijo, analítica). Nada de librerías de animación o carrusel; el carrusel móvil es CSS `scroll-snap`.
- `backdrop-filter` solo en nav y botón fijo.
- Metas (móvil, 4G lento de Lighthouse): **LCP < 2.5 s, CLS < 0.05, INP < 200 ms, Lighthouse ≥ 90** en Rendimiento, Accesibilidad, Buenas prácticas y SEO.

---

## 8. Accesibilidad
- Contraste AA (el texto en degradado del h1 es texto grande; mínimo 3:1 contra `--bg`, se cumple). Texto mínimo 14 px; textos de precio y cobro ≥ 15.5 px.
- Objetivos táctiles ≥ 48 px. Foco visible (anillo 2 px acento + halo 5 px) en todos los enlaces y botones.
- Toggle: `role="radiogroup"` con `aria-checked`; al cambiar, el bloque de precio se anuncia con `aria-live="polite"`.
- Menú móvil y `PartnerSheet`: trampa de foco, Esc cierra, el foco vuelve al botón que los abrió.
- Imágenes del hero con `alt` descriptivo (§3.2); miniaturas decorativas `aria-hidden`.
- Todo usable con teclado; `prefers-reduced-motion` respetado.

---

## 9. Qué quitar o cambiar del landing actual (capturado el 2 oct 2026)
Inventario del sitio en vivo (2 oct 2026; **montos viejos**, solo como registro: Precios: ver PRICING-CARDS-SPEC.md (fuente única)): nav (Herramientas · Cómo funciona · Planes · Preguntas · Entrar · Prueba Pro gratis) → hero "Bots que trabajan por ti mientras duermes" con panel "MIENTRAS DORMÍAS · EJEMPLO" (Clips listos / Señal: Bitcoin / Tu transmisión) y un rectángulo morado vacío → Herramientas (Clips, Señales, En vivo + tarjeta "Tu idea") → Cómo funciona en 3 pasos (crear cuenta / elegir / listo) → Así se ven tus clips (6 marcos con etiqueta "EJEMPLO" cada uno) → Hecho para streamers, creadores y negocios (Streamers, Creadores, Quien invierte) + franja de 2 sellos → Planes "Un plan con todo incluido" (Gratis $0 · Pro **$8,688.40 MXN al año** "(equivale a $724 al mes)" "Ahorras $1,737.68 al año" "o $868.84 MXN al mes con Mensual" · VIP **$2,898.84 MXN al mes**; sin toggle) → **Socios con formulario incrustado** (nombre, correo, idea) → Preguntas frecuentes (5) → CTA final "Fuiste por una cosa y te llevaste todo. Clips, Señales y En vivo. Todo en un solo plan." → footer (Herramientas · Chalyb · Legal: Términos y Condiciones, Aviso de Privacidad, Quién vende) → banner de cookies.

**Quitar / reemplazar:**
1. Nav: quitar "Cómo funciona" y "Preguntas"; "Planes" → **"Precios"**; "Entrar" → **"Iniciar sesión"**; "Prueba Pro gratis" (nav) → **"Prueba gratis"**; agregar **"Ayuda"**.
2. Hero: quitar el panel "MIENTRAS DORMÍAS" con etiqueta "EJEMPLO" y el rectángulo morado sin contenido → composite real laptop + teléfono + notificación. `h1` nuevo (la frase vieja queda en `<title>`).
3. Herramientas: quitar la tarjeta "Tu idea" de la rejilla (la propuesta de ideas pasa a la franja de Socios, después de FAQ); pasar de 3 tarjetas a la rejilla bento con las herramientas activas + tarjeta "Fuiste por una cosa y te llevaste todo"; agregar leyendas "Informativo, no es asesoría…".
4. Cómo funciona: los 3 pasos de cuenta se reemplazan por los 3 pasos del asistente de Clips con recortes reales del app.
5. Galería: quitar la etiqueta "EJEMPLO" de cada clip → una sola nota "Imágenes de ejemplo."
6. Para quién: "Quien invierte" → **"Tu mamá también"**; título nuevo; franja de 2 sellos → 3 (agrega "Cancela en 1 clic, sin llamadas").
7. Precios: título "Un plan con todo incluido" → "Empieza gratis, crece con Pro"; agregar toggle Mensual/Anual; montos desde `PRICING` (Precios: ver PRICING-CARDS-SPEC.md, fuente única; §3.7); agregar lista "qué incluye" por plan.
8. Socios: quitar el formulario incrustado de la página (pasa a hoja/modal con los mismos campos) y moverlo **después** de Precios y FAQ; quitar "compartimos las ganancias contigo" (D7).
9. FAQ: de 5 a 8 preguntas; "¿Qué incluye el plan Pro?" ya no dice solo "Clips, Señales y En vivo".
10. CTA final: texto nuevo y lista de todas las herramientas visibles.
11. Footer: agregar **Términos de Suscripción**, **Uso aceptable**, columna **Contacto**, caja de leyenda de Señales/Pronósticos/Inversiones y enlace "Español · English"; títulos de columna dejan de ser `h2`.
12. Meta description: "Prueba Pro gratis 7 días" (§6), sin montos.

**Se conserva:** "Ir al contenido" · logo → `/` · `/sign-in` · `/planes` · `/contacto` · `/quien-vende` · `/legal/terms` y `/legal/privacy` (y sus redirecciones) · banner de cookies y botón "Cookies" · `hreflang`/`/en` · canonical · OG/Twitter (con imagen nueva) · `robots.txt` · anclas `#herramientas`, `#como`, `#preguntas`, `#idea` (más `#planes` como alias de `#precios`) · parámetros `mode`/`plan` del registro · leyenda "Pago seguro con Mercado Pago".

---

## 10. Decisiones abiertas (dueño)
| # | Decisión | Default en el build |
|---|---|---|
| D1 | ~~¿Los precios incluyen IVA?~~ **Resuelto:** totales con IVA incluido. Precios: ver PRICING-CARDS-SPEC.md (fuente única) | Montos y leyenda "IVA incluido" desde `PRICING` |
| D6 | ¿Hay ayuda humana por WhatsApp con horario real? | No se menciona WhatsApp como canal de ayuda en la landing (el sitio actual ya lo quitó) |
| D7 | Bases del programa de socios | Formulario sin promesa de ganancias |
| L1 | ¿Están listas Asistente, Pronósticos, Inmuebles e Inversiones para venderse? (hoy el sitio solo muestra 3 herramientas) | Se pintan solo las activas en el panel |
| L2 | ¿Se emite CFDI? | Sin pregunta de factura en FAQ |
| L3 | Activo de logo: `/chalyb-mark.png` (sitio actual) vs. marca con degradado del app | Usar el mismo activo en app y sitio |

---

## 11. Criterios de aceptación
**Visual y contenido**
- [ ] En 1440×900 se ve el `h1`, el subtítulo, el CTA "Empezar mis 7 días gratis", los 3 sellos y el composite completo sin scroll (comparar con mockup 42).
- [ ] En 390×844 el CTA del hero se ve completo sin scroll (prueba de la abuela).
- [ ] Orden de secciones exactamente: nav → hero → herramientas → 3 pasos → galería → para quién → precios → FAQ → socios → CTA final → footer. Socios nunca aparece antes de Precios.
- [ ] Diferencia visual ≤ 2 % contra `40-landing.png` / `41-landing-movil.png` en prueba de regresión (Playwright, 2×, con datos de demostración), salvo precios si cambia PRICING-CARDS-SPEC.md.
- [ ] Las pantallas del composite no muestran ningún nombre de persona.

**Precios y legal (prueba automática que bloquea el despliegue)**
- [ ] Con toggle en Anual el número grande es el total anual ("$9,970" o el que diga `PRICING`) con "MXN al año", sin "equivale"; con Mensual: "$997 MXN al mes" + "Se renueva cada mes" y sin "Ahorras". Insignia "Más popular", nunca "Mejor oferta" (PRICING-CARDS-SPEC §16.6).
- [ ] El HTML/bundle de `/` no contiene: "2 meses gratis", "próximamente", "beta", "coming soon", "garantizado", "gana dinero", "rendimiento", "te conviene", "copiar automáticamente", "mes gratis", "equivale", "Mejor oferta", ni "apuesta" fuera de las leyendas exactas "no es asesoría de apuestas" / "ni de apuestas".
- [ ] Ningún monto aparece escrito en componentes (búsqueda de `\$\d` en `components/landing/**` = 0); cambiar `PRICING` cambia la landing.
- [ ] Las tarjetas Señales e Inversiones muestran "Informativo, no es asesoría financiera." y Pronósticos "Informativo, no es asesoría de apuestas."; la pregunta 6 está presente.
- [ ] La leyenda "Precios en MXN, IVA incluido." aparece bajo las tarjetas y en el footer (`PRICES_INCLUDE_IVA=true`).
- [ ] Sin testimonios, logos de terceros (salvo íconos de plataforma de formato), cifras de usuarios ni estadísticas.

**Enlaces y CTAs**
- [ ] Cada CTA de §4 lleva a su URL con `from` correcto; prueba E2E: clic en `hero_trial` → `/sign-in?mode=signup&plan=pro&intent=trial&interval=year&from=hero_trial`; tras cambiar a Mensual, `pricing_pro` lleva `interval=month`.
- [ ] Rastreo de enlaces internos de `/`: **0 respuestas 404** (incluye Términos de Suscripción y Uso aceptable); ningún `href="#"` ni `onClick` vacío.
- [ ] Con sesión iniciada, "Iniciar sesión" y "Prueba gratis" del nav dicen "Abrir Chalyb" y llevan a `/app`.
- [ ] Ningún evento de analítica sale antes de aceptar cookies de analítica (prueba con interceptor de red).

**Técnico**
- [ ] Lighthouse móvil ≥ 90 en las 4 categorías; LCP < 2.5 s; CLS < 0.05.
- [ ] Imágenes del hero en AVIF con respaldo WebP, con `width`/`height`; solo la laptop con prioridad.
- [ ] Un solo `h1`; `lang="es-MX"`; navegación completa con teclado; menú y hoja con trampa de foco.
- [ ] `title`, `description`, OG (imagen 1200×630 nueva), `canonical` y `hreflang` según §6.
