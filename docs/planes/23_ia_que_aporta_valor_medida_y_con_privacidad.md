# Plan 23: Hacer que la IA aporte valor real, que se pueda medir y que respete la privacidad

**Estado (6-oct-2026):** propuesta. Lo único implementado es el arreglo de privacidad del análisis de riesgo de un cliente (commit `afddd1d`, rama `feat/modo-basico-web`). Cada frente se aprueba por separado.
**Origen:** conversación del 6-oct con Luis. La IA fue la propuesta de valor del proyecto, aunque ni el programa ni el docente la exigen, así que «toca hacer que funcione con IA». A la vez, el piloto es corto y la IA necesita historial para aprender.
**Relacionado con:** plan 17 (motor único), plan 19 (modo básico y encuesta), plan 22 (función `ia` por tienda e I3), `docs/planes/16_plan_consejero_ia_fase_e_cierre_del_ciclo.md`.

---

## 0. Decisiones de Luis (6-oct-2026)

1. **La IA va disponible pero opcional en el piloto.** En el modo básico no se ve (ni se pide al servidor); con «Ver menú completo» aparecen el Consejero y las promociones. La prueba de usabilidad sigue simple y se puede medir cuántos tenderos usan la IA por su cuenta.
2. **Se invertirá en tres frentes:** corregir el evaluador y medir (A), darle contexto real al ajuste (B) y leer fotos de facturas (C). «Explicar el porqué» no se prioriza (ya existe en parte).
3. **Privacidad primero** (sección 4): ninguna función que mande datos personales o fotos se activa sin minimizar, sin aviso aceptado y sin política corregida.

---

## 1. Qué hace realmente la IA hoy (leído en el código, 6-oct)

- **El motor matemático hace casi todo:** cantidad base, urgencia, nivel (agotado, crítico, reponer), alertas, clasificación ABC, selección de qué promocionar y la pantalla `/pedir`. Vive en `utils/reposicion.js` y `utils/promociones.js`.
- **La IA (OpenAI, `gpt-4o-mini`) hace tres cosas, todas acotadas:**
  1. Propone un **ajuste porcentual** sobre la cantidad base (clase A hasta +100 %, B +50 %, C +20 %); el código lo recorta con `aplicarAjusteIA`. Consejero (`aiController.js`, `getDashboardRecommendations`) y copiloto de Proveedores (`suppliersController.js`, `generateSmartOrder`).
  2. En **promociones** elige tipo, descuento (máximo 30 %), duración y producto complementario, y redacta el texto. Si OpenAI falla, `determinarPromocionFallback` cubre el 100 %.
  3. En **Cartera** clasifica el riesgo de un cliente que fía. Es el único lugar sin respaldo de reglas.
- **La IA solo ve lo mismo que el motor** (stock, cantidad base, tendencia, clase, riesgo). Sin información externa, su ajuste no aporta nada nuevo: que mejore las compras es una suposición que hoy nadie mide.
- **El «aprendizaje» no es el modelo aprendiendo.** Es el promedio de las últimas 5 evaluaciones por producto (`Feedback_IA`, `utils/entradasMotor.js`), que corrige **solo el punto de reorden** (cuándo aparece «reponer»); no cambia cuánto se sugiere pedir. El modelo de lenguaje no recuerda nada entre llamadas. Lo único parecido a memoria: las promociones reciben las últimas 10 promociones manuales del dueño dentro del texto de la petición.

### Hallazgo: el evaluador compara un número equivocado (INFERRED, leído, no ejecutado)
`Ordenes_Detalle.sugerencia_ia` es un `INTEGER` que guarda el **porcentaje** de ajuste de la IA (`ordenBorradorController.js:102`, `suppliersController.js:208`; vale 0 cuando nadie ajustó). Pero `feedbackController.js:99` hace `sugerido = det.sugerencia_ia || det.cantidad_final` y lo trata como **cantidad**. Con un ajuste de +20 %, compara 20 unidades contra las ventas reales. Con ajuste 0 cae a `cantidad_final`, que es lo que terminó pidiendo el dueño, no lo que sugirió el motor ni la IA. Las pruebas existentes escriben una cantidad en esa columna, así que confirman la suposición del evaluador y no lo que escriben las órdenes reales. **Mientras no se corrija, el factor de aprendizaje no es confiable** en las órdenes con ajuste de IA. En el piloto no afecta (el modo básico no ajusta).

---

## 2. Qué mide el piloto y qué no

- **Sí:** activación, adopción, embudo, utilidad de las alertas, exactitud de inventario (ninguno de los indicadores de la Tabla 3 depende de IA, según el documento de Intervención).
- **No se podrá afirmar nada sobre:** el bucle de aprendizaje, los ajustes de GPT, el Consejero ni el diferenciador frente a Treinta. Se declara como **«no evaluado en el piloto»**, no como incumplido.
- **Demostrable aunque el piloto sea corto:** que el ciclo completo funciona de punta a punta (sugerencia → pedido → recepción → evaluación → factor), una vez corregido el evaluador. Cuántas evaluaciones habrá depende del plazo de entrega de cada producto (UNKNOWN).

---

## 3. Los tres frentes

### A. Corregir el evaluador y medir (base de todo)
- **A1. Decidir qué se evalúa.** Propuesta: guardar y evaluar **las tres cantidades** de cada línea: lo que calculó el motor (`cantidad_sugerida`), lo que sugirió la IA ya ajustada, y lo que terminó pidiendo el dueño (`cantidad_final`). Comparar cada una contra lo vendido responde las dos preguntas que importan: ¿acierta el motor? y ¿mejora algo el ajuste de la IA o la decisión del dueño? **Decisión pendiente de Luis.** Probablemente requiere columnas nuevas en `Feedback_IA` (migración).
- **A2. Corregir `evaluateOrderInternal`** y sus pruebas, que hoy codifican la suposición equivocada. Cuidado: cambia el factor que ya usan alertas y Proveedores.
- **A3. Reporte comparativo** (sin IA nueva): por tienda y producto, error del motor, de la IA y del dueño frente a las ventas reales. Sirve también para el documento académico.
- **A4. (Opcional, nivel 1)** estadística sin modelo de lenguaje: tiempo real de entrega por proveedor (INFERRED: se calcula con fechas que ya se guardan, aprobación y recepción), variabilidad de la demanda y efecto del día de la semana o la quincena. Es lo más honesto para decir que el motor «se adapta».
- **Límite honesto:** con pocas semanas y pocas tiendas los datos no sostienen modelos sofisticados; se presenta como «motor adaptativo y medido», no como «IA que aprende».

### B. Darle contexto real al ajuste de la IA
- Pasarle calendario (quincena, festivos de Colombia, fechas comerciales) y vencimientos, que el motor no usa en la cantidad.
- Registrar en `Auditoria_IA` qué contexto recibió cada ajuste, para poder medirlo después con A3.
- **Condición:** A primero. Sin A no hay forma de saber si el contexto mejoró algo.

### C. Leer fotos de facturas del proveedor
- **Qué:** foto de la factura → entrada de mercancía o alta de catálogo. Es lo más cercano a la necesidad #1 de la encuesta (registro automatizado, 80 %) y ataca la barrera de activación (cargar al menos 20 productos).
- **Cómo, minimizando:** extraer el texto en el dispositivo o en el servidor y mandar a la IA solo las líneas (producto, cantidad, precio), sin el encabezado con NIT, nombres ni direcciones. **No guardar la imagen. Nunca fotos del cuaderno de fiados** (traen nombres de personas que deben dinero).
- **Antes de construir:** privacidad (sección 4), evaluación de costo por factura y una prueba de exactitud con facturas reales sin datos personales.
- Es el frente más grande.

---

## 4. Privacidad (Ley 1581 de 2012): reglas y estado

> Este plan no es asesoría jurídica. Lo que sigue lo puede resolver el equipo técnicamente; lo jurídico necesita revisión de alguien competente (por ejemplo, el consultorio jurídico de la universidad o el docente).

**Regla de entrada (decidida):** ninguna función que mande datos personales o fotos a un tercero se activa sin (1) minimizar lo que se envía, (2) aviso claro aceptado por el dueño, apagada por defecto, y (3) política de datos corregida.

**Lo que se envía a OpenAI hoy (verificado el 6-oct):**

| Llamada | Qué viaja | Estado |
|---|---|---|
| Análisis de riesgo de un cliente (Cartera) | Antes: **nombre del cliente**, fechas de compras y abonos, saldo. Ahora: id del cliente y su historial de pagos | **Corregido** (`afddd1d`, con `tests/integration/ia_privacidad.test.js`, confirmado en rojo antes del arreglo) |
| Consejero | Nombre de producto, **nombre del proveedor** (si es persona natural, es dato personal), stock, cantidades | **Pendiente:** mandar id o etiqueta genérica en vez del nombre del proveedor |
| Promociones | Productos y las últimas 10 promociones manuales con el **«motivo del dueño» (texto libre)** | **Pendiente:** el texto libre puede contener datos personales |

La política publicada (`PoliticaDatosPage.jsx`) dice «un resumen numérico sin datos personales» y «StockPilot no envía nombres, correos ni contraseñas a ese servicio». Hasta cerrar los dos pendientes, **no es del todo cierto**.

**Técnico (puede hacerlo el equipo):**
1. Lista cerrada de campos permitidos por llamada, con una prueba que falle si alguien agrega un campo personal (ya existe para Cartera; extender al Consejero y a promociones).
2. Aceptación explícita por función de IA, apagada por defecto (encaja con la función `ia` por tienda, plan 22 I3).
3. Fotos: sección 3.C.

**Para revisión jurídica (preguntas):**
- ¿Quién es el responsable del tratamiento (el tendero) y quién el encargado (StockPilot)? Los clientes que fían son titulares de datos que recogió el tendero.
- Si enviar datos a OpenAI (EE. UU.) es una transmisión internacional de datos y qué exige (autorización, contrato, nivel adecuado según la SIC).
- Si hay que registrar la base de datos ante la SIC (RNBD).
- Términos vigentes de OpenAI sobre retención y uso de los datos enviados por API (verificar; el equipo no los ha comprobado).
- Reescribir la política para que diga exactamente lo que se envía, a quién, para qué y por cuánto tiempo.

---

## 5. Orden y límites de tiempo

La producción se congela durante las 6 semanas del piloto (plan 22, sección 5, D): solo se corrigen errores. Por eso:

1. **Antes de arrancar el piloto:** los dos pendientes de privacidad (Consejero y promociones) y el texto de la política; A1 y A2 (el evaluador), porque el ciclo debe medirse desde el primer pedido real.
2. **Durante el piloto, en ramas, sin desplegar:** A3, A4, B y C.
3. **Después del piloto:** desplegar lo que haya salido bien y presentarlo con los datos reales.

---

## 6. Documentos académicos (decisiones de Luis)

- La propuesta de valor sigue siendo válida **por su resultado** («te dice qué pedir y cuánto»), pero no por la frase «usando IA». Conviene reposicionarla como motor propio, explicable y auditable, con la IA como capa opcional en evaluación.
- Tres frases ponen la IA como núcleo: el título («asistida por inteligencia artificial»), el objetivo general y el objetivo específico 3 («motor predictivo de demanda y copiloto de IA»). Consultar al docente antes de cambiarlas.
- **No reutilizar** las cifras sin respaldo: 85 % de interés en IA, 28 % y 22 % de reducciones, 4 horas semanales (marcadas así en `docs/contexto_revision_cowork_2026-09-23.md` y `docs/traspaso_cowork_2026-09-26.md`). La reducción de mermas del 4-5 % es una expectativa, no una meta medida.
- Lo que sustenta el producto con evidencia propia es la encuesta (n = 15): registro automatizado 80 %, alertas de caducidad 53 %, alertas de stock 40 %. Ninguna es de IA.
- Fuente: resumen de los `.docx` hecho por un agente de lectura; **verificar** las citas contra los documentos originales antes de usarlas.

---

## 7. Decisiones abiertas

| # | Decisión | Quién |
|---|---|---|
| 1 | ¿Qué cantidad(es) evalúa el evaluador? (propuesta: las tres) | Luis |
| 2 | Revisión jurídica de la sección 4 | Luis, con el docente o el consultorio jurídico |
| 3 | ¿Se corrigen ya los dos pendientes de privacidad (Consejero, promociones)? | Luis |
| 4 | Alcance de C: ¿solo facturas o también catálogo inicial? ¿Dónde corre el OCR? | Luis |
| 5 | Si el docente permite cambiar título y objetivos (sección 6) | Luis |
