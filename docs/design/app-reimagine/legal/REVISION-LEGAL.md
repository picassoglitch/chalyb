# Revisión legal del paquete de políticas de Chalyb

**Fecha de la revisión:** 30 de septiembre de 2026 · **Alcance:** `terminos-y-condiciones.md`, `terminos-de-suscripcion.md`, `aviso-de-privacidad.md`, `uso-aceptable-y-contenido.md`, `aceptacion-ux.md`, `README.md` y `../trial-to-paid-path.md` · **Respaldo del original:** `../legal-original-backup/`

> ⚠️ **No es asesoría legal.** La preparó un investigador que **no es abogado con cédula**. Se apoya en textos oficiales consultados el 30-sep-2026 (Cámara de Diputados, DOF, LégisQuébec, leginfo de California, NY Senate, FTC y LII/eCFR). Todo lo que no se pudo verificar en una fuente primaria aparece como **"No verificado"**. Antes de publicar, los puntos de la sección "Para firma de abogado mexicano" necesitan la firma de un abogado licenciado en México. Para usuarios de EE. UU. y Canadá se necesita además un abogado local.

**Cómo leer cada hallazgo:** Problema → Fundamento (con fuente) → Cambio aplicado (archivo y sección) → Estado de verificación.

---

## 0. Veredictos rápidos

### 0.1. ¿Existe la reforma de dic-2025 al art. 76 Bis LFPC? ¿Bastan 7 días?

**Sí, la reforma existe y está verificada.** Es el "Decreto por el que se adicionan las fracciones VIII y IX al artículo 76 Bis de la Ley Federal de Protección al Consumidor", publicado en el DOF el **12 de diciembre de 2025** y vigente **desde el día siguiente (13-dic-2025)**. También reformó la redacción de las fracciones VI y VII. Fuente: [LFPC_ref33_12dic25.pdf](https://www.diputados.gob.mx/LeyesBiblio/ref/lfpc/LFPC_ref33_12dic25.pdf) y el texto vigente de la [LFPC](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf).

Texto exacto:

- **Fr. VIII:** "El proveedor deberá informar de forma clara, destacada y accesible si el servicio contratado implica cobros automáticos recurrentes, su periodicidad, monto y fecha de cobro. Los cobros señalados en el párrafo anterior, requerirán consentimiento expreso e informado de la persona consumidora. En los casos en los que, de acuerdo al contrato, proceda la renovación automática del servicio, se deberá notificar al menos con cinco días naturales de anticipación, permitiendo su cancelación sin penalización"
- **Fr. IX:** "El proveedor deberá implementar mecanismos que, sin contravenir a las disposiciones contractuales, permita a la persona consumidora cancelar el servicio, suscripción o membresía de manera inmediata."

**Veredicto:**

- **El recordatorio a 7 días cumple** (el mínimo es de 5 días naturales). La ley no dice expresamente si el paso de prueba gratis a plan de pago es una "renovación automática". La revisión lo trata como si lo fuera, que es la lectura conservadora.
- **Brecha que se corrigió:** las renovaciones **mensuales** se avisaban exactamente a 5 días. Eso no deja margen para fallas de envío, zonas horarias o correos que rebotan. Ahora se avisan a **7 días**. Además, si un aviso no llega, no se cobra hasta notificar por otro medio.
- **Sanción:** el incumplimiento del art. 76 Bis se multa conforme al **art. 128 LFPC**, de **$1,093.02 a $4,274,960.73 MXN** (montos actualizados, DOF 23-12-2025, según el texto vigente en Diputados).

### 0.2. Señales, Pronósticos e Inversiones: ¿basta el aviso de riesgo?

**No. El aviso ayuda, pero lo que decide es cómo funciona el producto.**

- **Asesoría en inversiones (art. 225 LMV).** Se vuelve "asesor en inversiones" quien, de forma habitual y profesional, **administra carteras tomando decisiones a nombre y por cuenta de terceros**, o da **recomendaciones sobre valores "de manera individualizada"**. Para hacerlo hay que registrarse ante la CNBV. Un aviso que dice "no es asesoría" no cambia la naturaleza de un servicio que en los hechos sí es asesoría.
- **Inversiones (riesgo alto).** El borrador original recababa **"preferencias de riesgo", saldos y posiciones**, y permitía automatizaciones que envían órdenes. Eso lo acercaba a los dos supuestos del art. 225.
- **Pronósticos.** Vender pronósticos sin recibir apuestas **no es** por sí mismo un "juego con apuesta" (Ley Federal de Juegos y Sorteos). Se vuelve riesgoso si Chalyb recibe o intermedia apuestas, organiza concursos o quinielas con premio, hace sorteos sin permiso de SEGOB o promueve casas de apuestas sin permiso.
- **Cambios de producto necesarios** (ya redactados en los documentos):
  1. Las señales y los análisis deben ser **iguales para todos los usuarios de un plan**, sin usar saldos, posiciones ni perfil del usuario.
  2. Las automatizaciones solo deben ejecutar **reglas escritas por el usuario**. Nada de "copiar señal automáticamente".
  3. **Sin custodia** de fondos o activos.
  4. **Sin recibir ni intermediar apuestas, sin concursos con premio y sin sorteos.**
  5. Enlaces o afiliaciones **solo** a operadores con permiso de SEGOB, con los mensajes que exige el Reglamento.
  6. Si hay afiliaciones con brókers, exchanges o casas de apuestas, deben **divulgarse**.

---

## 1. Hallazgos CRÍTICOS (bloquean el lanzamiento)

### C1. Inversiones/Señales: riesgo de prestar asesoría en inversiones sin registro ante la CNBV

- **Problema:**
  - El Aviso de Privacidad recababa "preferencias de riesgo", saldos y posiciones para Señales e Inversiones. Usar esos datos para generar recomendaciones las vuelve **individualizadas**.
  - Las automatizaciones de Inversiones envían órdenes con las claves de API del usuario. Si la lógica de qué comprar o vender, cuánto y cuándo es de Chalyb (por ejemplo, ejecutar automáticamente las Señales), Chalyb estaría **tomando decisiones de inversión por cuenta de terceros**.
  - Los avisos de riesgo no cambian lo anterior.
- **Fundamento:**
  - **Art. 225 LMV:** asesoría individualizada o administración discrecional de carteras requiere registro ante la CNBV.
  - **Art. 227 LMV:** el asesor no puede tener custodia de los recursos de sus clientes ni garantizar rendimientos.
  - **Art. 227 Bis 1 LMV:** la CNBV puede emitir reglas para servicios automatizados de asesoría y gestión.
  - **Art. 392, fr. VII, inciso b) LMV:** multa de 30,000 a 150,000 días de salario por realizar actividades del art. 225 sin registro.
  - Fuente: [LMV](https://www.diputados.gob.mx/LeyesBiblio/pdf/LMV.pdf).
  - **Ley Fintech, art. 30:** solo las ITF pueden operar con activos virtuales que autorice Banxico. **Banxico, Circular 4/2019:** las instituciones financieras solo pueden usar activos virtuales en operaciones internas, sin ofrecer a clientes intercambio ni custodia. Fuentes: [LRITF](https://www.diputados.gob.mx/LeyesBiblio/pdf/LRITF.pdf), [Circular 4/2019 (DOF)](https://sidof.segob.gob.mx/notas/5552303).
  - **EE. UU.:**
    - La exclusión de "publisher" de la Investment Advisers Act, §202(a)(11)(D), exige que la publicación sea impersonal, de buena fe y de circulación general y regular ([15 USC 80b-2](https://www.law.cornell.edu/uscode/text/15/80b-2)).
    - La exención para asesores de operaciones de futuros (CTA) de la CFTC, [17 CFR 4.14(a)(9)](https://www.law.cornell.edu/cfr/text/17/4.14), exige no dirigir cuentas de clientes y no adaptar la asesoría a clientes concretos.
    - Ejecutar Señales de Chalyb en la cuenta del usuario rompería ambas.
  - **Canadá:** la exención de "advising generally" del NI 31-103 (s. 8.25) requiere asesoría que no se adapte a las necesidades de quien la recibe.
- **Cambio aplicado:**
  - `uso-aceptable-y-contenido.md`:
    - §6.2 reescrita: sin recomendaciones individualizadas, sin decisiones por el usuario, sin custodia, divulgación de afiliaciones y reglas para mostrar resultados históricos.
    - §6.3: Señales son generales.
    - §6.5: las automatizaciones solo ejecutan reglas del usuario; las Señales no se ejecutan solas; se rechazan claves con permiso de retiro.
    - §6.7: responsabilidad por fallas propias.
    - §6.7 bis nueva: usuarios fuera de México.
  - `aviso-de-privacidad.md` §2: se eliminó "preferencias de riesgo" y los datos financieros se limitan a "mostrar y ejecutar reglas del usuario".
  - `aceptacion-ux.md`:
    - §6: el modal dice que la información no usa saldos ni perfil.
    - §7: nuevo flujo "Activar una automatización" y lista de funciones **prohibidas sin validación**.
  - `terminos-y-condiciones.md` §6.4.
- **Lo que debe hacer producto:**
  1. Quitar cualquier botón de "copiar señal" o "auto-trading" ligado a Señales.
  2. No personalizar recomendaciones con datos del usuario.
  3. Si las Señales o Inversiones cubren **acciones, ETF, FIBRAs, deuda u otros valores**, la regla de no personalizar es **obligatoria**.
  4. Para solo cripto, el riesgo es menor (en general las criptomonedas no son "valores"), pero se recomienda la misma regla.
- **Verificación:**
  - Textos de los arts. 225, 227, 227 Bis 1 y 392 LMV y del art. 30 de la Ley Fintech: **verificados**.
  - Alcance de la Circular 4/2019: **verificado solo en su resumen oficial**, no se leyó completa.
  - Criterios específicos de la CNBV sobre asesoría automatizada o "robo-advisors": **no verificados**.
  - Si las criptomonedas pueden ser "valores" en casos concretos: **requiere abogado**.
  - NI 31-103 s. 8.25: **solo fuente secundaria**.

### C2. El flujo de la prueba (`trial-to-paid-path.md`) contradecía el paquete legal

- **Problema:**
  - El flujo decía "Checkbox not needed" y daba por buena la aceptación solo con el botón.
  - Pedía mostrar en grande **"$624/mes"** y no el cobro real de **$7,490**.
  - Ponía la etiqueta "2 meses gratis" junto a una prueba de "1 mes gratis".
  - Usaba un precio tachado ($8,988) sin decir qué era.
  - En la opción anual, el texto previo al cobro **no decía que el plan se renueva cada año**.
  - El equipo podía implementar este archivo y no `aceptacion-ux.md`.
- **Fundamento:**
  - **Art. 76 Bis fr. VIII LFPC:** periodicidad, monto y fecha "clara, destacada y accesible", con consentimiento **expreso** e informado.
  - **Art. 7 Bis LFPC:** precio total de forma notoria y visible.
  - **Art. 32 LFPC:** publicidad engañosa.
  - **Art. 10 LFPC:** no se puede cobrar sin consentimiento.
  - Sanciones: arts. 127 y 128 LFPC.
  - **ROSCA**, [15 USC 8403](https://www.law.cornell.edu/uscode/text/15/8403): términos materiales antes de pedir datos de cobro y consentimiento expreso e informado.
  - **California** [B&P §17602(a)](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602): "express affirmative consent".
- **Cambio aplicado:**
  - `trial-to-paid-path.md`:
    - Casilla **obligatoria** con el texto de `aceptacion-ux.md` §3.3.
    - El precio principal pasa a **"$7,490 MXN al año"**, con "$624/mes" como texto secundario.
    - "Ahorras $1,498 al año" en vez de "2 meses gratis".
    - Precio tachado rotulado como "$8,988 si pagas 12 meses de Pro mensual".
    - El texto de cobro ahora incluye "se renovará automáticamente cada año/mes hasta que canceles".
    - Datos del proveedor visibles antes de pagar.
    - Regla de rebote del aviso.
    - Oferta de retención con el botón de cancelar visible.
    - Correos 1 a 3 completados con renovación, folio y forma de cancelar.
  - `aceptacion-ux.md` §3.1: nota sobre "2 meses gratis" y el precio tachado.
- **Verificación:** fundamentos **verificados**. Si basta con el botón como aceptación (opción §3.4) es **criterio del abogado**. Se recomienda la casilla.

### C3. IVA sin confirmar: todos los precios visibles dependen de esto

- **Problema:** los documentos dicen "IVA incluido [IVA: CONFIRMAR]".
  - Si $749 / $7,490 / $2,499 son precios antes de IVA, todos los precios mostrados violarían el art. 7 Bis. Los totales correctos serían **$868.84 / $8,688.40 / $2,898.84**.
  - Si el operador **no reside en México**, los arts. 18-B a 18-D de la LIVA exigen trasladar el IVA "en forma expresa y por separado".
- **Fundamento:**
  - Art. 7 Bis LFPC (precio total con impuestos), sancionado por el art. 127: **$760.89 a $2,434,847.42**.
  - [LIVA](https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf): art. 16 (servicios que presta un residente en México se consideran prestados en territorio nacional); art. 29 (tasa 0% solo para exportaciones de servicios específicas); arts. 18-B a 18-D (plataformas digitales extranjeras).
- **Cambio aplicado:**
  - `terminos-de-suscripcion.md` §1.2 y §11.1: desglose del IVA en el resumen de pago y el comprobante; marcador ampliado para el contador.
  - `aceptacion-ux.md` principio 3: marcado como **bloqueante**.
  - `trial-to-paid-path.md` §3.
- **Verificación:** artículos **verificados**. Qué tasa aplica a usuarios del extranjero (0% vs. 16%) y la residencia fiscal del operador **requieren contador o abogado fiscal**.

---

## 2. Hallazgos ALTOS

### A1. El tope de responsabilidad y las exclusiones amplias son nulos frente a consumidores y además sancionables

- **Problema:** T&C §11.2 aplicaba el tope (lo pagado en 12 meses) a todos los usuarios. Uso Aceptable §6.7 decía "no será responsable de **ninguna** pérdida", sin excepción por fallas propias de Chalyb. T&C §13.2 terminaba la cuenta "sin responsabilidad".
- **Fundamento:**
  - **Art. 90 fr. II LFPC:** son nulas las cláusulas que liberen al proveedor de su responsabilidad civil.
  - Fr. I: modificación unilateral. Fr. III: trasladar responsabilidad al consumidor.
  - **Art. 85 LFPC:** contratos de adhesión sin cláusulas abusivas.
  - **Art. 127 LFPC:** violar los arts. 85 y 90 se multa. Una cláusula abusiva no solo se tiene por no puesta: **genera multa**.
  - **Art. 92 Ter LFPC:** bonificación de al menos 20%.
  - **Código Civil Federal** ([CCF](https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf)): art. 2106 (la renuncia a exigir responsabilidad por dolo es nula); art. 2110 (los daños deben ser consecuencia inmediata y directa). En esto se apoya la exclusión de daños indirectos.
  - **Quebec**, LPC [s.10](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1): está prohibido excluir la responsabilidad del comerciante por sus propios actos.
- **Cambio aplicado:**
  - `terminos-y-condiciones.md`:
    - Resumen ajustado.
    - §11.1: exclusiones atadas a "consecuencia inmediata y directa" y a decisiones del usuario cuando el servicio funcionó.
    - §11.2: tope **solo para usuarios empresariales**.
    - §11.3: protecciones expresas para consumidores (incumplimiento propio, bonificación mínima de 20%, daños y perjuicios).
    - §12.2 acotada.
    - §13.2 sin "sin responsabilidad".
  - `uso-aceptable-y-contenido.md` §6.7.
- **Verificación:** **verificado**. Que el tope para negocios funcione en la práctica depende de cómo se distinga al consumidor; lo debe validar el abogado.

### A2. Cambios de precio: aumento unilateral con aviso fuera de las ventanas de California y Quebec

- **Problema:** el aumento se aplicaba si el usuario no cancelaba (aceptación tácita), y el aviso era "al menos [30] días".
- **Fundamento:**
  - **México:** art. 90 fr. I LFPC (modificación unilateral). Art. 76 Bis fr. VIII (consentimiento expreso al **monto** de los cobros recurrentes).
  - **California** §17602(g)(2): el aviso de cambio de tarifa debe enviarse **no menos de 7 y no más de 30 días** antes.
  - **Nueva York** [GBL §527-a](https://www.nysenate.gov/legislation/laws/GBS/527-A): (b-1) consentimiento afirmativo antes de cobrar un precio mayor, o cancelación con reembolso proporcional; (g) aviso de cambios materiales.
  - **Quebec** LPC s.11.2: modificación unilateral solo con aviso escrito de **al menos 30 días** y derecho a cancelar.
  - **Única fecha que cumple con todos:** aviso **exactamente a 30 días**.
- **Cambio aplicado:**
  - `terminos-de-suscripcion.md` §5: aviso a 30 días; **todo aumento requiere aceptación expresa**; si no se acepta, el plan no se renueva y se pasa a Gratis; las bajas de precio se aplican solas.
  - §7.3: reembolso si se cobra un aumento no aceptado.
  - `aceptacion-ux.md` §4: botón "Acepto el nuevo precio", recordatorio 7 días antes y eventos `price_change_declined`.
  - Marcador [X]% resuelto en `README.md`.
- **Verificación:** México, California y Quebec **verificados**. En NY, la fecha de entrada en vigor de las últimas reformas al §527-a **no está verificada**; el texto se consultó en nysenate.gov.

### A3. Avisos de renovación: margen mínimo, sin regla para avisos fallidos y sin recordatorio anual

- **Problema:**
  - Las renovaciones mensuales se avisaban a 5 días exactos.
  - Que no se cobrara si el aviso rebotaba era una "decisión del dueño".
  - No había recordatorio anual para planes mensuales.
- **Fundamento:**
  - Art. 76 Bis fr. VIII LFPC (≥5 días naturales); art. 128 (multa).
  - California §17602(h): recordatorio anual con producto, frecuencia, monto y forma de cancelar. El texto se refiere a "annual automatic renewal agreement or continuous service agreement"; aplicarlo también a mensuales es la **lectura conservadora**.
  - California §17602(b): aviso antes de terminar la prueba **solo si dura más de 31 días**. La prueba de 30 días no lo activa, pero el recordatorio de 7 días no estorba.
  - Renovaciones anuales: aviso 15 a 45 días antes, según §17602(b)(2) y NY §527-a(f). Los 30 días caben en la ventana.
  - **Quebec**, Ley 10 (2026, c.16), nuevo art. 187.29 LPC y art. 79.6.9.1 del Reglamento: aviso escrito **2 a 10 días** antes de que termine un periodo gratuito o con descuento, con la fecha de fin y el nuevo precio. Vigente desde el 12-sep-2026; no aplica a contratos que ya estaban en curso ese día. **7 días cumple.**
- **Cambio aplicado:**
  - `terminos-de-suscripcion.md`:
    - Resumen.
    - §2.7: aviso a 7 días con su contenido.
    - **§2.7 bis nueva:** si el aviso no llega, no se cobra hasta 5 días después de una notificación efectiva.
    - §3.3: mensual a 7 días y recordatorio anual.
    - §7.3: reembolso si se cobra sin aviso.
    - §14 nueva: EE. UU., Canadá y Quebec.
  - `aceptacion-ux.md` §4 (tabla y regla de rebote obligatoria), §10.1 (eventos nuevos) y §11.
- **Verificación:** **verificado**, salvo lo indicado sobre NY.

### A4. Pronósticos: exposición a la Ley Federal de Juegos y Sorteos

- **Problema:** el borrador no prohibía concursos de pronósticos con premio, quinielas, sorteos ni enlaces de afiliado a casas de apuestas. La línea de ayuda seguía como marcador.
- **Fundamento:**
  - [LFJS](https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf): art. 1 (prohíbe juegos de azar y con apuesta); art. 2 (permite, entre otros, los deportes); art. 3 (la SEGOB regula juegos con apuesta y sorteos); art. 4 (se necesita permiso para cualquier juego con apuesta).
  - [Reglamento LFJS](https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFJS.pdf): art. 9 (publicidad de juegos con apuesta y sorteos solo con permiso, mostrando el número de permiso, la prohibición a menores y un mensaje de juego responsable); art. 85 (los permisionarios pueden captar apuestas en línea).
- **Cambio aplicado:**
  - `uso-aceptable-y-contenido.md` §6.2: sin apuestas, quinielas, concursos con premio, rifas ni sorteos.
  - §6.4: enlaces solo a operadores con permiso de SEGOB y con los mensajes del Reglamento.
  - §6.7 bis: bloqueo geográfico opcional.
  - `aceptacion-ux.md` §11.
- **Verificación:** LFJS y Reglamento **verificados**. Qué tratamiento tienen las "promociones" con premio en marketing (sorteos de planes gratis): **requiere abogado** antes de cualquier campaña. La línea de juego responsable sigue **pendiente**: no se verificó un recurso oficial vigente.

### A5. Aviso de privacidad: transferencias sin base legal y aviso simplificado incompleto

- **Problema:**
  1. El aviso decía que los datos podían transferirse a un **adquirente** del negocio sin consentimiento. Ese supuesto **no está** en el art. 36.
  2. Faltaba la **cláusula del art. 35**, en la que el titular indica si acepta o no las transferencias.
  3. El aviso simplificado **no listaba los datos tratados** (art. 15 fr. II) ni las opciones para limitar su uso (fr. IV).
  4. Faltaba el derecho de oposición al **tratamiento automatizado** (art. 26 fr. II), que importa porque las reglas antifraude pueden negar la prueba gratis.
  5. Faltaba la eliminación a los **72 meses** de los datos de incumplimiento (art. 10).
  6. El aviso de vulneraciones decía "sin demora"; la ley dice "de forma inmediata" (art. 19).
  7. Citaba "su Reglamento", aunque el Reglamento vigente es de 2011 y fue emitido para la ley anterior.
- **Fundamento:**
  - [LFPDPPP](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf), publicada en el DOF el 20-03-2025, vigente desde el 21-03-2025; última reforma DOF 14-11-2025. Arts. 10, 15, 16 fr. II, 19, 26 fr. II, 35 y 36.
  - Autoridad: la **Secretaría Anticorrupción y Buen Gobierno** (correcto en el borrador).
  - Multas del art. 59: 100 a 160,000 UMA y 200 a 320,000 UMA; el doble si se trata de datos sensibles.
  - Art. 76 Bis fr. I LFPC: no se puede transmitir información a otros proveedores sin autorización expresa.
- **Cambio aplicado:**
  - `aviso-de-privacidad.md`:
    - Encabezado sin la frase "su Reglamento".
    - §2: datos financieros acotados.
    - §3.1 punto 8: decisiones automatizadas con revisión humana.
    - §4.3 reescrita según el art. 36, con un párrafo sobre fusión o venta y la cláusula del art. 35.
    - §5.1: oposición al tratamiento automatizado.
    - §9.1: regla de 72 meses y evidencia bloqueada.
    - §9.2: aviso de vulneraciones "inmediato".
    - §11: Canadá y EE. UU.
    - Aviso simplificado: se agregaron los datos tratados, la ausencia de datos sensibles, las opciones para limitar el uso y "sin transferencias que requieran consentimiento".
- **Verificación:** artículos **verificados**. Que exista un **nuevo Reglamento** de la LFPDPPP de 2025: **no verificado**; Diputados sigue mostrando el de 2011. Cómo se tratan los datos en una fusión o adquisición (si el adquirente sucede al responsable o hay transferencia): **requiere abogado**.

### A6. Derechos de autor y nueva regla de IA (LFDA): requisitos del aviso, retiro duradero y clonación de voz o imagen

- **Problema:**
  - El procedimiento de aviso exigía, como obligatorios, documentos y declaraciones que la ley no pide.
  - Faltaba el deber de tomar **medidas razonables para que el contenido no se vuelva a subir**.
  - La política de reincidencia no tenía regla concreta.
  - No se mencionaba la **reforma de 2026 sobre clonación de voz e imagen con IA**, que importa para Clips, En vivo y Asistente.
- **Fundamento:** [LFDA](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf).
  - **Art. 114 Octies fr. II:**
    - a) retiro expedito tras un aviso o una resolución de autoridad, y "medidas razonables para prevenir que el mismo contenido que se reclama infractor se vuelva a subir";
    - b) avisar al usuario;
    - c) política pública de terminación de cuentas de infractores reincidentes.
  - **Art. 114 Octies fr. III:** el aviso contiene "como mínimo" 4 datos. El contra-aviso obliga a restablecer el contenido salvo que se inicie un procedimiento en 15 días hábiles.
  - **Reforma DOF 14-05-2026**, según la última reforma que muestra Diputados:
    - Art. 118 fr. VII: los artistas intérpretes pueden autorizar o prohibir su suplantación con sistemas de IA o clones que simulen su voz de forma identificable, salvo parodia, sátira o imitación creativa.
    - Art. 121: toda clonación o suplantación de voz o imagen con IA requiere un **acuerdo previo y por escrito**.
    - Art. 231 fr. II: infracción en materia de comercio, la sanciona el IMPI.
- **Cambio aplicado:**
  - `uso-aceptable-y-contenido.md`:
    - §3.3: prohibición de clonar voz o imagen con IA sin acuerdo escrito.
    - §5.1: los 4 datos mínimos de ley, y los demás como opcionales.
    - §5.2: retiro también por orden de autoridad y medidas contra la re-subida (huellas o hashes).
    - §5.4: marcador para la política de reincidencia.
  - `terminos-y-condiciones.md` §8.10.
- **Verificación:** texto vigente **verificado** en Diputados. El decreto de mayo de 2026 en el DOF no se consultó aparte; la fecha sale del encabezado "Última Reforma DOF 14-05-2026". Los formularios del reglamento de la LFDA para avisos: **no verificados**.

### A7. Quebec: idioma, ley aplicable, tribunales, plazos y Ley 25

- **Problema:** documentos solo en español, ley mexicana, tribunales de México, cierre sin causa con 30 días, y nada sobre la Ley 25.
- **Fundamento:** [LPC de Quebec (P-40.1)](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1).
  - s.10: no se excluye la responsabilidad por actos propios.
  - s.11.1: no se permite arbitraje obligatorio ni renuncia a acciones colectivas. El paquete no tiene ninguno de los dos.
  - s.11.2: modificación unilateral solo con 30 días de aviso.
  - **s.11.3:** el comerciante que cancela un contrato por tiempo indeterminado debe dar **60 días** de aviso.
  - **s.19:** prohibida la cláusula que elige una ley distinta a la de Quebec o Canadá.
  - s.19.1: una cláusula que no aplica en Quebec debe ir precedida de una mención expresa.
  - s.22.1: la elección de domicilio no se puede oponer al consumidor.
  - s.26: el contrato debe estar en francés.
  - ss.54.1 a 54.16: contratos a distancia.
  - **Ley 10 (2026, c.16):** botón de cancelación en línea (s.187.28), aviso de 2 a 10 días (s.187.29) y prohibición de cláusulas contra reseñas (s.25.11). Fuente: [2026C16F.PDF](https://www.publicationsduquebec.gouv.qc.ca/fileadmin/Fichiers_client/lois_et_reglements/LoisAnnuelles/fr/2026/2026C16F.PDF).
  - **Carta de la lengua francesa, s.55** (reforma de la Ley 96; francés primero en contratos de adhesión desde el 1-06-2023): **solo fuente secundaria**.
  - **Ley 25** ([P-39.1](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)):
    - s.3.1: persona responsable publicada.
    - s.3.3: evaluación de impacto.
    - s.8.1: perfilado.
    - s.12.1: decisiones automatizadas.
    - **s.17:** evaluación y acuerdo escrito antes de comunicar información fuera de Quebec.
    - s.32: respuesta en 30 días.
    - Sanciones administrativas de hasta $10M o 2% (s.90.12) y multas penales de hasta $25M o 4% (s.91).
- **Cambio aplicado:**
  - `terminos-y-condiciones.md`:
    - §13.3: 60 días en Quebec.
    - §14.2: 30 días.
    - §15.4: reseñas.
    - §16.4 nueva: mención expresa de las cláusulas que no aplican en Quebec, y francés.
    - §17.6: idioma.
  - `terminos-de-suscripcion.md` §14.2.
  - `aviso-de-privacidad.md` §11: persona responsable, s.17 y 30 días.
  - `aceptacion-ux.md` §8 y §11.
  - **Decisión del dueño:** traducir al francés **o** bloquear planes de pago para residentes de Quebec.
- **Verificación:** LPC, Ley 10 y Ley 25 **verificadas**. La s.55 de la Carta: **no verificada en fuente primaria**.

---

## 3. Hallazgos MEDIOS

### M1. Aceptación por simple uso (browsewrap)

- **Problema:** T&C §2.1(c) daba por aceptados los Términos con solo usar el servicio. Esto contradice el principio de aceptación con clic de `aceptacion-ux.md` y debilita la prueba del consentimiento.
- **Fundamento:** [CCF](https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf) arts. 1803 (consentimiento expreso o tácito; expreso por medios electrónicos) y 1834 bis; [CCom](https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf) arts. 89, 93 y 1298-A; ROSCA y California exigen consentimiento afirmativo.
- **Cambio:** `terminos-y-condiciones.md` §2.1 y resumen.
- **Estado:** verificado.

### M2. Revisar y corregir antes de aceptar, y copia del contrato

- **Problema:** no se ofrecía de forma expresa la oportunidad de corregir errores antes de confirmar.
- **Fundamento:**
  - **Ontario CPA 2002** (contratos por internet): divulgación, oportunidad expresa de aceptar o corregir, copia en 15 días. Los números de sección **no se verificaron**; el portal ontario.ca requiere JavaScript. La CPA 2023 tiene sanción real pero **no está en vigor** (según fuentes secundarias).
  - **Quebec LPC** ss.54.1 a 54.16 (contratos a distancia: información previa, aceptación expresa, copia en 15 días).
- **Cambio:** `terminos-y-condiciones.md` §2.3; `terminos-de-suscripcion.md` §2.6; `aceptacion-ux.md` principio 10.
- **Estado:** Quebec verificado; Ontario no verificado en fuente primaria.

### M3. Oferta de retención al cancelar

- **Problema:** se permitía una oferta de retención sin exigir que el botón de cancelar siguiera visible.
- **Fundamento:** California §17602(e)(2): se puede mostrar una oferta solo si al mismo tiempo se muestra un botón o enlace "click to cancel". Art. 76 Bis fr. IX LFPC (cancelación inmediata).
- **Cambio:** `terminos-de-suscripcion.md` §6.1; `aceptacion-ux.md` principio 6 y §5; `trial-to-paid-path.md`.
- **Estado:** verificado.

### M4. Cambios a los Términos

- **Problema:** el aviso de cambios relevantes era de [15] días y el cambio se aceptaba de forma tácita.
- **Fundamento:** art. 90 fr. I LFPC; Quebec s.11.2 (30 días).
- **Cambio:** `terminos-y-condiciones.md` §14.2 y §14.3 (30 días, aceptación expresa y, si no se acepta, no hay renovación); `aceptacion-ux.md` §8.
- **Estado:** verificado.

### M5. Retiro de funciones esenciales

- **Problema:** se podían retirar funciones esenciales sin aviso previo.
- **Fundamento:** art. 90 fr. I LFPC; art. 7 LFPC (respetar lo ofrecido); art. 92 Ter.
- **Cambio:** `terminos-y-condiciones.md` §7.3 (aviso de [30] días cuando sea posible, alternativa o reembolso a elección del usuario).
- **Estado:** verificado el fundamento; el plazo es una recomendación.

### M6. Suspensión por contracargo

- **Problema:** la suspensión de "tu suscripción" mientras se resuelve un contracargo podía leerse como castigo por ejercer un derecho.
- **Fundamento:** art. 1 LFPC (los derechos no se renuncian); art. 76 Bis fr. VIII (cancelación sin penalización). Es un cambio **prudencial**: no se encontró una norma que lo prohíba expresamente.
- **Cambio:** `terminos-de-suscripcion.md` §10.2 (solo se suspenden las funciones del periodo disputado; el plan Gratis y la descarga de contenido se mantienen).
- **Estado:** prudencial.

### M7. Datos del proveedor y seguridad antes de pagar

- **Problema:** razón social, domicilio y teléfono no estaban garantizados en el checkout.
- **Fundamento:** art. 76 Bis fr. III LFPC (domicilio físico, teléfonos y medios de reclamación **antes** de la transacción); fr. II (informar las características generales de los elementos de seguridad).
- **Cambio:** `aceptacion-ux.md` principio 9 y §11; `trial-to-paid-path.md`. **Pendiente de producto:** agregar en §3.5 una línea como "Conexión cifrada; tus datos de tarjeta los tokeniza Mercado Pago".
- **Estado:** verificado.

### M8. Prohibición de cláusulas contra reseñas

- **Fundamento:** Quebec s.25.11 (Ley 10).
- **Cambio:** `terminos-y-condiciones.md` §15.4.
- **Estado:** verificado. (La Consumer Review Fairness Act de EE. UU. **no se consultó**.)

### M9. Evidencia electrónica y conservación

- **Situación:** el diseño es sólido: registro de solo agregar, hashes y NOM-151.
- **Fundamento:**
  - Código de Comercio arts. 38 y 49 (conservar 10 años los mensajes de datos que contienen contratos, íntegros y accesibles), 89 a 114 (comercio electrónico), 1047 (prescripción ordinaria de 10 años) y 1298-A (valor probatorio).
  - **NOM-151-SCFI-2016** ([DOF 30-03-2017](https://www.dof.gob.mx/nota_detalle.php?codigo=5478024&fecha=30%2F03%2F2017)): constancias de conservación de un Prestador de Servicios de Certificación (PSC), con sello de tiempo.
- **Cambio:** `aceptacion-ux.md` §10.4.5 (fundamento, mínimo de California y excepción de 72 meses).
- **Estado:** verificado.

### M10. Registro del contrato de adhesión ante PROFECO

- **Situación:** no se encontró una NOM que **obligue** a registrar contratos de servicios digitales por suscripción (arts. 86 y 87 LFPC). El registro es **voluntario** (art. 88).
- **Cambio:** `README.md` §3.
- **Estado:** la ausencia de esa NOM **no se verificó de forma exhaustiva**.

### M11. Norma de comercio electrónico

- **Situación:** el art. 76 Bis 1 LFPC remite a la Norma Mexicana de comercio electrónico. La **NMX-COE-001-SCFI-2018** existe y es de cumplimiento **voluntario**; su declaratoria de vigencia es del DOF 30-04-2019, según el [SIDOF](https://sidof.segob.gob.mx/notas/docFuente/5559015).
- **Recomendación:** que el abogado coteje el checkout contra la NMX.
- **Estado:** existencia verificada por búsqueda; el contenido no se revisó.

### M12. Teléfonos de PROFECO

- **Situación:** 55 5568 8722 / 800 468 8722, confirmados en [gob.mx/profeco](https://www.gob.mx/profeco/articulos/telefono-del-consumidor).
- **Estado:** verificado.

### M13. Inmuebles y Ley Antilavado

- **Situación:** la intermediación inmobiliaria puede ser "actividad vulnerable" conforme a la LFPIORPI. Chalyb solo da herramientas de texto y estimación, lo que en principio no lo es.
- **Estado:** **no verificado** (no se revisaron las reformas de 2025). Requiere abogado.

### M14. EE. UU. (resumen)

- **FTC:** la regla "click-to-cancel" de 2024 fue **anulada** por el 8.º Circuito el 8-07-2025 por motivos de procedimiento. La FTC publicó un nuevo ANPRM el **11-03-2026** ([comunicado](https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option), [ANPRM](https://www.ftc.gov/system/files/ftc_gov/pdf/p064202negativeoptionruleanprm.pdf)). **No hay regla final.** Siguen vigentes la regla de 1973, ROSCA y la Sección 5 de la FTC Act.
- **ROSCA:** el diseño cumple (divulgación previa, casilla, cancelación sencilla).
- **California y Nueva York:** ver A2, A3 y M3.
- **Otras leyes estatales de renovación automática:** **no revisadas** una por una.
- **Leyes estatales de privacidad (CCPA/CPRA, etc.):** aplicación según umbrales **no verificada**; hay marcador en Privacidad §11.

### M15. Canadá, resto del país

- **PIPEDA:** **no consultada** en fuente primaria. Se agregó una mención general en Privacidad §11.
- **Ontario:** ver M2.
- **Valores (CSA):** ver C1.

---

## 4. Lo que ya estaba bien (se mantuvo)

- Sin arbitraje obligatorio ni renuncia a acciones colectivas. **Recomendación: no agregarlos.** Frente a consumidores mexicanos y de Quebec serían nulos o prohibidos, y podrían multarse por el art. 127.
- Cancelación en 1 clic con folio. Plan anual preseleccionado, pero mostrando el monto real. Casilla de marketing desmarcada.
- Cita correcta de la LFPDPPP de 2025 y de su autoridad. Una sola prueba por persona, tarjeta o cuenta.
- Indemnización limitada a los actos del usuario (art. 90 fr. III).
- Se salvaguarda el derecho a acudir a PROFECO. La versión en español prevalece (art. 85 LFPC).
- La regla de marca se respeta: no se encontró "ChalyClip" ni similares. "Chalyb Pro" se usa como nombre de plan o producto.

---

## 5. Para firma de abogado mexicano (prioridad)

1. **Límites de Inversiones y Señales frente a la LMV y la Ley Fintech.** Confirmar que, con las reglas de C1 (información igual para todos, automatizaciones solo con reglas del usuario, sin custodia), Chalyb queda fuera del art. 225 LMV, y qué cambia si se cubren valores y no solo cripto. Evaluar una consulta a la CNBV.
2. **Pronósticos y cualquier promoción con premio** frente a la LFJS y su Reglamento, incluidas afiliaciones con casas de apuestas.
3. **Responsabilidad:** que la nueva estructura de T&C §11 (tope solo para empresas), §12 y Uso Aceptable §6.7 no sea abusiva conforme a los arts. 85, 90 y 127 LFPC.
4. **Conversión de prueba a pago:**
   - si encaja en la fr. VIII del art. 76 Bis;
   - si la casilla es suficiente o el botón basta (aceptacion-ux §3.4);
   - plan anual preseleccionado;
   - regla de no cobrar cuando falla el aviso.
5. **Aumentos de precio** con aceptación expresa y no renovación (Suscripción §5).
6. **Tribunales y ley aplicable:** T&C §16.2, incluida la opción de que el consumidor demande en su domicilio, y §16.4 para extranjeros.
7. **Privacidad:**
   - tratamiento en fusión o adquisición (§4.3);
   - redacción de la cláusula del art. 35;
   - si aplica el Reglamento de 2011 o si ya hay uno nuevo;
   - decisiones automatizadas en el antifraude.
8. **IVA y residencia fiscal** (con contador): si los precios incluyen IVA, tasa para usuarios del extranjero, CFDI. Bloquea el lanzamiento.
9. **LFDA:** reforma de 2026 sobre clonación de voz e imagen con IA (por ejemplo, doblaje o voz sintética en Clips o En vivo), e implementación del puerto seguro (medidas contra la re-subida y política de reincidencia).
10. **Ley Antilavado** respecto de Inmuebles y, en su caso, Señales.
11. Si conviene **registrar voluntariamente** el contrato de adhesión ante PROFECO (art. 88) y cotejar con la NMX-COE-001-SCFI-2018.

**Para abogados de EE. UU. y Canadá:**

- Leyes de renovación automática estado por estado.
- Exclusión de "publisher" y CTA según el diseño final de Señales.
- Quebec: traducir o bloquear, y evaluación de impacto para la transferencia fuera de Quebec (s.17 Ley 25).
- Ontario: secciones aplicables de la CPA 2002.

---

## 6. Fuentes

**México (primarias):**
- LFPC, texto vigente: https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf
- Decreto de reforma al art. 76 Bis (DOF 12-12-2025): https://www.diputados.gob.mx/LeyesBiblio/ref/lfpc/LFPC_ref33_12dic25.pdf
- LFPDPPP (DOF 20-03-2025; reforma 14-11-2025): https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf
- Código de Comercio: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCom.pdf
- Código Civil Federal: https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf
- NOM-151-SCFI-2016 (DOF 30-03-2017): https://www.dof.gob.mx/nota_detalle.php?codigo=5478024&fecha=30%2F03%2F2017
- NMX-COE-001-SCFI-2018 (declaratoria, SIDOF): https://sidof.segob.gob.mx/notas/docFuente/5559015
- Ley Federal del Derecho de Autor (última reforma DOF 14-05-2026): https://www.diputados.gob.mx/LeyesBiblio/pdf/LFDA.pdf
- Ley del Mercado de Valores: https://www.diputados.gob.mx/LeyesBiblio/pdf/LMV.pdf
- Ley para Regular las Instituciones de Tecnología Financiera: https://www.diputados.gob.mx/LeyesBiblio/pdf/LRITF.pdf
- Banxico, Circular 4/2019 (DOF): https://sidof.segob.gob.mx/notas/5552303
- Ley del IVA: https://www.diputados.gob.mx/LeyesBiblio/pdf/LIVA.pdf
- Ley Federal de Juegos y Sorteos: https://www.diputados.gob.mx/LeyesBiblio/pdf/109.pdf
- Reglamento de la LFJS: https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LFJS.pdf
- PROFECO, Teléfono del Consumidor: https://www.gob.mx/profeco/articulos/telefono-del-consumidor

**EE. UU.:**
- ROSCA, 15 USC 8403: https://www.law.cornell.edu/uscode/text/15/8403
- FTC, ANPRM sobre la regla de opción negativa (11-03-2026): https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option · https://www.ftc.gov/system/files/ftc_gov/pdf/p064202negativeoptionruleanprm.pdf
- California, B&P §17602: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17602
- Nueva York, GBL §527-a: https://www.nysenate.gov/legislation/laws/GBS/527-A
- Investment Advisers Act, §202(a)(11) (15 USC 80b-2): https://www.law.cornell.edu/uscode/text/15/80b-2
- CFTC, 17 CFR 4.14: https://www.law.cornell.edu/cfr/text/17/4.14

**Canadá / Quebec:**
- Loi sur la protection du consommateur (P-40.1): https://www.legisquebec.gouv.qc.ca/en/document/cs/P-40.1
- Ley 10 (2026, c.16): https://www.publicationsduquebec.gouv.qc.ca/fileadmin/Fichiers_client/lois_et_reglements/LoisAnnuelles/fr/2026/2026C16F.PDF
- Ley sobre la protección de la información personal en el sector privado (P-39.1, Ley 25): https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1

**No verificado en fuente primaria:**
- Carta de la lengua francesa s.55 / Ley 96.
- Secciones de la CPA 2002 de Ontario y estado de la CPA 2023.
- PIPEDA.
- NI 31-103 s.8.25.
- Lowe v. SEC (1985).
- Securities Act §17(b).
- Consumer Review Fairness Act.
- Criterios de la CNBV sobre asesoría automatizada.
- Texto completo de la Circular 4/2019.
- Nuevo Reglamento de la LFPDPPP.
- Reformas de 2025 a la LFPIORPI.
- Recurso oficial vigente de juego responsable.
