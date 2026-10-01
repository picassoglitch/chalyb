# Chalyb: paquete de políticas legales (BORRADOR)

> **Resumen en palabras simples**
>
> - Estos 5 documentos son las reglas legales de Chalyb: Términos, Suscripción y cobros, Privacidad, Uso aceptable (con avisos financieros) y la guía de cómo se aceptan dentro del producto.
> - Protegen al máximo a la empresa **sin violar la ley mexicana**: lo que la ley no permite quitarle al consumidor no se le quita, porque esas cláusulas serían nulas.
> - Hay que **llenar los datos entre corchetes** (lista abajo) y tomar algunas decisiones.
> - **Es un borrador. Antes de publicarlo debe revisarlo un abogado con cédula profesional en México.**
> - La revisión legal con hallazgos priorizados, fuentes y lo que falta firmar está en [`REVISION-LEGAL.md`](REVISION-LEGAL.md). El original sin cambios está en `../legal-original-backup/`.

> ⚠️ **AVISO IMPORTANTE: BORRADOR, NO ES ASESORÍA LEGAL.** Este paquete se preparó como punto de partida y **debe ser revisado y aprobado por un abogado licenciado en México** (idealmente con experiencia en protección al consumidor, datos personales, comercio electrónico y regulación financiera) **antes de publicarse o usarse**. Las leyes citadas pueden cambiar; verifica la versión vigente. Para usuarios de EE. UU. y Canadá se requiere además la revisión de un abogado local.

---

## 1. Índice

| # | Archivo | Qué es | Contra qué protege |
|---|---|---|---|
| 1 | [`terminos-y-condiciones.md`](terminos-y-condiciones.md) | Contrato general de uso (chalyb.com/terminos) | Reclamaciones por errores de la IA ("tal cual"); uso indebido de la plataforma; copia o ingeniería inversa; responsabilidad ilimitada (tope = lo pagado en 12 meses, solo para usuarios empresariales; frente a consumidores el art. 90 LFPC no lo permite); daños por plataformas de terceros; demandas causadas por el contenido del usuario (indemnización); necesidad de cerrar cuentas abusivas; cambios de servicio; litigios en tribunales lejanos (jurisdicción [CIUDAD]) |
| 2 | [`terminos-de-suscripcion.md`](terminos-de-suscripcion.md) | Planes, prueba gratis, cobros, cancelación, reembolsos (chalyb.com/suscripcion) | Contracargos ("no autoricé el cobro"); quejas ante PROFECO por cobros recurrentes; abuso de pruebas gratis (una por persona/tarjeta/cuenta); exigencias de reembolsos proporcionales; reclamaciones por créditos no usados; pagos fallidos sin reglas claras |
| 3 | [`aviso-de-privacidad.md`](aviso-de-privacidad.md) | Aviso de privacidad integral + simplificado (chalyb.com/privacidad) | Multas bajo la LFPDPPP 2025 (hasta 320,000 UMA); falta de base para compartir datos con IA, Mercado Pago, hosting y correo; requisitos de Google/YouTube API (Uso Limitado); falta de consentimiento para datos financieros; reclamaciones por marketing no deseado |
| 4 | [`uso-aceptable-y-contenido.md`](uso-aceptable-y-contenido.md) | Reglas de contenido, derechos de autor y avisos de riesgo financiero (chalyb.com/uso-aceptable) | Responsabilidad por infracciones de derechos de autor de usuarios (aviso y retirada, art. 114 Octies LFDA); "strikes" y bloqueos por publicación automática; reclamaciones por pérdidas en cripto, apuestas, inversiones o inmuebles; riesgo de ser considerado asesor en inversiones no registrado |
| 5 | [`aceptacion-ux.md`](aceptacion-ux.md) | Guía interna: microcopy exacto, flujos y especificación del registro de evidencia (no se publica) | Que los Términos "no cuenten" por mala implementación; contracargos sin pruebas; incumplimiento del art. 76 Bis LFPC (cobros recurrentes); pruebas débiles ante PROFECO o en juicio |
| 6 | [`REVISION-LEGAL.md`](REVISION-LEGAL.md) | Revisión legal: hallazgos (crítico/alto/medio), fundamento con fuentes, cambios aplicados y puntos para firma de abogado | Para el abogado y el dueño |
| — | `chalyb-politicas-borrador.pdf` | Este índice, los 5 documentos y la revisión legal en un solo PDF con portada | Para enviar al abogado |

## 2. Cambios necesarios frente al plan original (importante)

1. **Recordatorio previo al cobro: 7 días antes, no 3.** La reforma al art. 76 Bis LFPC (fracciones VIII y IX; DOF 12-dic-2025, vigente desde el 13-dic-2025) exige avisar las renovaciones automáticas **con al menos 5 días naturales de anticipación**, consentimiento **expreso e informado** para cobros recurrentes y un mecanismo de **cancelación inmediata**. Un aviso 3 días antes **no cumple**. **Verificado** en el decreto publicado (ver `REVISION-LEGAL.md`). Los documentos y `trial-to-paid-path.md` ya dicen 7 días (día 23 de la prueba).
2. **Aviso antes de cada renovación**: mensual **7 días** antes (mínimo legal 5) y anual 30 días antes; recordatorio anual para planes mensuales; si un aviso obligatorio rebota, **no se cobra** hasta notificar por otro medio.
3. **Casilla de consentimiento de cobro** (desmarcada, obligatoria) en vez de solo "botón como aceptación": es la mejor evidencia de consentimiento expreso. `trial-to-paid-path.md` ya se corrigió (decía que no hacía falta).
6. **Aumentos de precio solo con aceptación expresa** y aviso exactamente 30 días antes (sin aceptación, no se renueva).
7. **Herramientas financieras: cambios de producto, no solo avisos** (ver `REVISION-LEGAL.md` C1/C2): sin recomendaciones basadas en saldos/posiciones/perfil del usuario, sin copiado automático de señales, automatizaciones solo con reglas del usuario, sin apuestas ni concursos con premio.
4. **Precios con IVA incluido.** El art. 7 Bis LFPC exige mostrar el **precio total** con impuestos. Si $749 / $7,490 / $2,499 son **antes** de IVA, los precios a mostrar serían $868.84 / $8,688.40 / $2,898.84. Confirma y ajusta `[IVA: CONFIRMAR]`.
5. **Plan anual preseleccionado:** es legal si el monto real ($7,490) y la periodicidad se muestran destacados y el usuario puede cambiarlo fácilmente; está diseñado así. Se recomienda la **cortesía de primer cobro anual** (sección 7.4 de Suscripción) para reducir contracargos.

## 3. Puntos de protección y sus límites legales

- **Tope de responsabilidad, exclusión de garantías, cambios de términos y jurisdicción:** el art. 90 LFPC declara nulas, en contratos de adhesión, las cláusulas que permitan al proveedor modificar el contrato unilateralmente, liberarse de su responsabilidad civil, trasladarla al consumidor, o que obliguen a renunciar a la LFPC o sometan a tribunales extranjeros. Por eso los documentos dicen "en la máxima medida permitida por la ley", limitan el tope de responsabilidad a usuarios empresariales, excluyen dolo/negligencia grave, piden re-aceptación con derecho a cancelar en cambios relevantes y dejan a salvo a PROFECO. Esto **hace las cláusulas más defendibles**, no más débiles.
- **Contrato de adhesión:** debe estar en español, legible y con letra uniforme (art. 85 LFPC). No se encontró una NOM que obligue a registrar contratos de servicios digitales por suscripción (arts. 86–87 LFPC); el registro ante PROFECO sería **voluntario** (art. 88). Pregunta al abogado si conviene. Incluir cláusulas abusivas no solo las anula: es sancionable (art. 127 LFPC).
- **Evidencia electrónica:** Código de Comercio (comercio electrónico, mensajes de datos) y **NOM-151-SCFI-2016** (constancias de conservación). Ver `aceptacion-ux.md` §10.
- **Privacidad:** basada en la **nueva LFPDPPP** (DOF 20-mar-2025, vigente desde 21-mar-2025). La autoridad ahora es la **Secretaría Anticorrupción y Buen Gobierno** (sustituyó al INAI). Al 30-sep-2026 no se localizó un nuevo Reglamento publicado (Diputados aún lista el Reglamento de 2011); revisar antes de publicar.
- **Herramientas financieras:** los avisos ayudan, pero **no sustituyen el cumplimiento**. Si **Inversiones** ejecuta órdenes, administra carteras o da recomendaciones **individualizadas**, o si **Señales** se presenta como recomendación personal, podría requerirse registro como **asesor en inversiones ante la CNBV** (art. 225 Ley del Mercado de Valores). Chalyb no debe custodiar fondos ni criptoactivos (Ley Fintech / Banxico). **Pronósticos** no debe aceptar ni intermediar apuestas (Ley Federal de Juegos y Sorteos). También evaluar con el abogado si Inmuebles o Señales activan obligaciones de **actividades vulnerables** (Ley Antilavado). El marketing **no** debe prometer rendimientos ni aciertos (publicidad engañosa, art. 32 LFPC).
- **EE. UU. y Canadá:** revisar con abogado local las leyes de renovación automática (p. ej., California Automatic Renewal Law, ROSCA a nivel federal; Quebec/Ontario en Canadá). El diseño de `aceptacion-ux.md` (aviso claro, consentimiento afirmativo, correo de confirmación, cancelación en línea) ya va en esa dirección.

## 4. Datos y decisiones que debes llenar

### 4.1. Datos de la empresa

| Marcador | Qué poner |
|---|---|
| `[RAZÓN SOCIAL]` | Nombre legal de la sociedad o persona física que opera Chalyb |
| `[RFC]` | RFC de la empresa |
| `[DOMICILIO]` | Domicilio fiscal/físico completo (exigido por el art. 76 Bis LFPC y la LFPDPPP) |
| `[CORREO DE CONTACTO]` | Correo de soporte y aclaraciones (ej. soporte@chalyb.com) |
| `[CORREO DE PRIVACIDAD]` | Correo para derechos ARCO (ej. privacidad@chalyb.com) |
| `[CORREO DE DERECHOS DE AUTOR]` | Correo para avisos de retirada (ej. derechosdeautor@chalyb.com) |
| `[TELÉFONO]` | Teléfono de atención |
| `[HORARIO DE ATENCIÓN]` | Ej. lunes a viernes de 9:00 a 18:00 (hora del centro de México) |
| `[DEPARTAMENTO DE DATOS PERSONALES]` | Persona o área responsable de privacidad |
| `[CIUDAD]` | Ciudad de los tribunales competentes (ej. Ciudad de México) |
| `[FECHA]` | Fecha de entrada en vigor de cada documento |
| `[VERSIÓN]` | Número de versión (ej. 1.0) |

### 4.2. Precios, planes y cobros

| Marcador | Qué poner |
|---|---|
| `[IVA: CONFIRMAR]` | Confirmar que los precios incluyen IVA (o ajustar precios mostrados) |
| `[CRÉDITOS GRATIS]`, `[CRÉDITOS PRO]`, `[CRÉDITOS VIP]` | Créditos mensuales por plan |
| `[BENEFICIOS VIP]` | Qué incluye VIP adicional a Pro |
| `[VIGENCIA DE CRÉDITOS ADICIONALES]` | Vigencia de paquetes de créditos comprados (si existen; ej. 12 meses) |
| `[DÍAS DE GRACIA]` | Días para actualizar tarjeta tras un pago fallido (sugerido: 7) |
| `[conservarás / tendrás limitado]` | Si durante la gracia se conserva el acceso (Suscripción §8.2) |
| `[DÍAS DE CORTESÍA]` + bloque `[OPCIONAL RECOMENDADO…]` | Ventana de reembolso de cortesía tras el primer cobro anual (sugerido: 7) o eliminar el bloque |
| ~~`[OPCIONAL: Si el aumento es mayor a [X]%…]`~~ | Resuelto: ahora todo aumento requiere aceptación expresa (Suscripción §5.3) |
| `[30]`, `[15]`, `[5]` | Plazos de aviso sugeridos (renovación anual, retiro de funciones, cierre sin causa, respuesta a reembolsos); se pueden ajustar sin bajar de los mínimos legales. **No cambiar** los fijos: 7 días (fin de prueba y renovación mensual), 30 días exactos (precio y Términos), 60 días (cierre sin causa en Quebec). |
| `[MONTO MÍNIMO]` | Tope de responsabilidad para usuarios que no han pagado (ej. $1,000 MXN) |

### 4.3. Privacidad y proveedores

| Marcador | Qué poner |
|---|---|
| `[PROVEEDOR DE HOSTING]` | Ej. AWS, Google Cloud, Vercel (y país) |
| `[PROVEEDORES DE IA]` | Ej. proveedores de modelos de lenguaje, transcripción y video |
| `[PROVEEDOR DE CORREO]` | Ej. servicio de correo transaccional/marketing |
| `[PROVEEDOR DE ANALÍTICA]` | Ej. herramienta de analítica de producto |
| `[PROVEEDOR DE FACTURACIÓN / PAC]` | PAC para CFDI |
| `[PROVEEDOR PSC NOM-151, si aplica]` | Prestador de Servicios de Certificación para constancias NOM-151 |
| `[PLAZO DE CONSERVACIÓN DE CONTENIDO]` | Cuánto se guarda el contenido tras cerrar cuenta (sugerido: 30 días) |
| `[CONFIRMAR POLÍTICA]` | Confirmar que **no** se usa el contenido de usuarios para entrenar IA |
| `[CONFIRMAR CON CADA PROVEEDOR]` | Verificar que los contratos con proveedores de IA prohíben entrenar con datos de Chalyb |
| `[CONFIRMAR si se desea tratar como primaria la analítica básica]` | Decisión sobre analítica |

### 4.4. Otros

| Marcador | Qué poner |
|---|---|
| `[LÍNEA DE AYUDA SOBRE JUEGO RESPONSABLE]` | Recurso de ayuda para juego problemático (verificar uno vigente) |
| ~~`[DECISIÓN DEL DUEÑO, recomendado]`~~ | Resuelto: si rebota el aviso obligatorio no se cobra (Suscripción §2.7 bis) |
| `[DECISIÓN DEL DUEÑO: … Quebec …]` | Bloquear planes de pago en Quebec hasta tener versión en francés (T&C §16.4) |
| `[DECISIÓN DEL DUEÑO: … bloquear Pronósticos …]` | Bloqueo geográfico de Pronósticos / automatizaciones donde no se haya validado (Uso aceptable §6.7 bis) |
| `[NOMBRE / CARGO]` | Persona responsable de la protección de la información personal (Quebec, Ley 25) |
| `[POLÍTICA DE REINCIDENCIA…]` | Regla de cancelación de cuentas reincidentes en derechos de autor (Uso aceptable §5.4) |
| `[CONFIRMAR CON EL DUEÑO]` (afiliaciones) | Si existen acuerdos de afiliación con brókers, exchanges o casas de apuestas (Uso aceptable §6.2) |
| `[VALIDAR CON ABOGADO]` | Fuero del domicilio del consumidor (T&C §16.2) y transferencia de datos en fusión/venta (Privacidad §4.3) |

## 5. Pasos para publicar

1. Llenar los marcadores y tomar las decisiones de la sección 4.
2. Implementar en producto los cambios de `REVISION-LEGAL.md` (casilla, avisos de 7 días, rebote = no cobro, aumentos con aceptación, límites de herramientas financieras, aviso y retirada con medidas contra re-subida).
3. **Revisión por abogado mexicano** (y abogado de EE. UU./Canadá si se venderá allá).
4. Publicar con URL fija por versión y hash; activar el registro de evidencia (`aceptacion-ux.md` §10).
5. Probar el flujo completo: registro → prueba → recordatorio → cobro → cancelación → contracargo simulado.
