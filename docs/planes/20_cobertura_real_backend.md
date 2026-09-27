# Plan 20: Cobertura de pruebas real del backend

**Estado:** Hallazgos verificados, línea base (Paso 0) medida, **Nivel 1 completo** y **sección 5 completa** (las 7 funciones puras candidatas extraídas de `aiController.js`, `suppliersController.js` y `cashRegisterController.js`, ver sección 7). De paso se encontró y corrigió un bug real de redondeo de punto flotante que ya existía antes de esta sesión (sección 7.4). 154 → **196 pruebas**. **Nivel 2 sin empezar** — falta decidir cuándo montar `stockpilot_test` y escribir las pruebas de integración.
**Fecha:** 2026-09-25 (creación) — actualizado 2026-09-27 (sección 5 completa + fix de redondeo)
**Origen:** tarea encargada por el usuario a partir de una sesión de Claude en Cowork, sobre la cobertura real de `vitest.config.js` (hoy `include` mide solo 5 archivos, reportando 99,27% que no refleja el backend completo).

---

## 1. Hallazgos — verificados contra el código actual

### 1.1 Confirmado: hay pruebas de `utils/` que no cuentan en `coverage.include`
`reposicion.test.js`, `ai_recomendaciones_dashboard.test.js` e `inventory_math.test.js` ejercitan `utils/reposicion.js`, `utils/ordenesBorrador.js` y `utils/recomendacionesDashboard.js` — ninguno de los tres estaba en `include`. Con el `include` ampliado (Paso 0), los tres muestran cobertura real y alta: `reposicion.js` 87,3%, `ordenesBorrador.js` 100%, `recomendacionesDashboard.js` 100% (de sentencias).

### 1.2 Confirmado: los tres bloques `/* v8 ignore */`
- `models/Alert.js:93-307` — cubre `generate()`, `dryRun()`, `findActive()`, `resolve()` y `getStats()` (todo lo que toca base de datos, agrupado en un solo bloque desde el cierre de plan 17/O8).
- `controllers/feedbackController.js:16-228` — prácticamente todo el archivo salvo el helper del inicio.
- `middleware/auth.js:17-57` — `requireLogin` y `requireAdmin` (las funciones Express reales); `evaluarAcceso`/`evaluarAdmin` (la lógica pura ya extraída) quedan fuera del bloque y sí se prueban.

### 1.3 Confirmado: `dashboard_analytics.test.js` reimplementa la fórmula en vez de importar
`calcularMargenPromedio` está definida **dentro del archivo de prueba** (línea 20), no importada de `dashboardController.js`. Pero hay un matiz importante que cambia la corrección propuesta: **la fórmula real de producción no vive en una función JS** — se calcula directamente en SQL (`dashboardController.js:18`, `AVG(((precio - costo_compra) / NULLIF(precio, 0)) * 100) as margen_avg`). No hay ninguna función JS de producción que "importar" — extraerla significaría **mover el cálculo de SQL a JS**, un cambio de arquitectura, no una extracción neutra. Alternativas, para que decidas en el Nivel 1:
  a) Dejar el test como una prueba de "fórmula esperada" (documenta la intención, no protege el código real) y mover la protección real del cálculo a una prueba de integración (Nivel 2) que compare el resultado de la consulta SQL contra datos sembrados conocidos.
  b) Mover el cálculo a JS (leer filas crudas y calcular en Node) — cambia el comportamiento de producción (una agregación en BD pasa a traer todas las filas y calcular en memoria); **no lo haría sin tu aprobación explícita**, tal como piden las reglas.
  Mi recomendación es (a): es más barato y no toca producción; el Nivel 2 ya contempla pruebas de integración con Postgres real donde esto encaja naturalmente.

### 1.4 Confirmado y con hallazgo adicional: a qué base se conectan las pruebas hoy
`config/database.js` hace `require('dotenv').config()` al cargarse, y `models/Alert.js` (importado por varios archivos de prueba) requiere `config/database.js` en la primera línea — así que **solo con importar el archivo de prueba, sin que ningún test corra código de BD, ya se dispara una conexión real** (y potencialmente la auto-migración de esquema) contra lo que sea que diga `DATABASE_URL` en `.env`.

**Verificado ahora mismo:** `DATABASE_URL` en `.env` apunta a `localhost:5432/stockpilot` (Postgres local), **no** a Neon — parece que ya la cambiaste (probablemente para el trabajo de Bases de Datos Avanzadas con Docker/Kubernetes local). Confirmé que ese Postgres local está corriendo y acepta conexiones.

**Esto no estaba protegido antes ni lo está ahora:** no hay ningún `.env.test` ni ninguna verificación de que `DATABASE_URL` no sea la de producción. Si `.env` volviera a apuntar a Neon (como estaba hace unos días en esta misma sesión), correr `npm test` dispararía la auto-migración contra la base compartida solo por *importar* el archivo, sin que ninguna prueba lo pida explícitamente. Esto confirma exactamente el riesgo que el Nivel 2 quiere cerrar con `.env.test` + la protección de "abortar si parece producción".

---

## 2. Paso 0 — Línea base (antes de cambiar nada)

Metodología: se amplió temporalmente `coverage.include` a `controllers/**`, `models/**`, `middleware/**`, `utils/**`, `services/**`, se corrió la suite completa (149 pruebas, sin escribir ninguna prueba nueva) con los `/* v8 ignore */` intactos, se registraron los números, se quitaron temporalmente los 3 bloques `/* v8 ignore */`, se corrió de nuevo, y se restauraron los 3 archivos a su estado exacto (`git diff` vacío después de restaurar). `vitest.config.js` también se dejó exactamente como estaba — todo lo de esta sección fue solo medición, nada quedó commiteado en el código de producción.

### 2.1 Totales por carpeta

| Carpeta | Con `v8 ignore` (sentencias) | Sin `v8 ignore` (sentencias) | Diferencia |
|---|---|---|---|
| `controllers/` | 1,2% (25/2156) | 1,2% (25/2156)* | Sin cambio — los ignore de esta carpeta están en un solo archivo, ver detalle |
| `middleware/` | 48,4% (15/31) | 31,3% (15/48) | Baja el % porque aparecen 17 sentencias nuevas sin cubrir (`requireLogin`/`requireAdmin`) |
| `models/` | 27,9% (100/358) | 22,5% (100/444) | Baja el % por las 86 sentencias de `Alert.js` que estaban ocultas |
| `services/` | 0,0% (0/80) | 0,0% (0/80) | Sin cambio (no tiene bloques ignore) |
| `utils/` | 52,7% (89/169) | 52,7% (89/169) | Sin cambio (no tiene bloques ignore) |
| **TOTAL** | **8,2% (229/2794)** | **7,7% (229/2973)** | El numerador (código realmente probado) no cambia — solo se agrandó el denominador real |

*`controllers/feedbackController.js` sí tiene un bloque ignore (16-228), pasa de 100% (25/25, con ignore) a 24,8% (25/101, sin ignore) — el total de la carpeta casi no se mueve porque `feedbackController.js` es pequeño comparado con los ~2150 sentencias de los otros 17 controladores, todos en 0%.

### 2.2 Los tres archivos con `v8 ignore`, antes/después

| Archivo | Con ignore | Sin ignore |
|---|---|---|
| `models/Alert.js` | 100% (53/53) | 38,1% (53/139) |
| `controllers/feedbackController.js` | 100% (25/25) | 24,8% (25/101) |
| `middleware/auth.js` | 91,7% (11/12) | 37,9% (11/29) |

### 2.3 Lo que este número realmente dice

- **17 de 18 controladores están en 0%** (`aiController.js`, `authController.js`, `productController.js`, `saleController.js`, `suppliersController.js`, etc.) — ninguno tiene una sola prueba, ni siquiera de sus posibles funciones puras internas.
- **La mayoría de los modelos están en 0%** (`Product.js`, `Sale.js`, `Store.js`, `CashRegister.js`, `InventoryMovement.js`, `Notification.js`, `Report.js`) salvo `Alert.js` (con ignore) y `User.js` (7,1%, prueba mínima).
- **`services/schedulerService.js` está en 0%** — nada del cron, el resumen semanal ni la evaluación de IA tiene pruebas.
- Lo que sí está bien probado, y va a servir de base para el Nivel 1, son justamente los `utils/` puros: `reposicion.js`, `ordenesBorrador.js`, `recomendacionesDashboard.js`, `securityUtils.js`, además de `Alert.evaluarProducto` (dentro de `Alert.js`) y `models/products/*` (Factory/polimorfismo), todos con pruebas reales que ya pasan.
- El 8,2%/7,7% no es un juicio de que el sistema esté mal probado en la práctica — es la cobertura real de **pruebas automatizadas de Vitest**, que es distinto de "el sistema funciona" (la app ya está en producción y funcionando). Es la métrica correcta para lo que pediste presentar en la práctica y en Bases de Datos Avanzadas, pero vale aclarar la diferencia si te preguntan.

---

## 3. Decisiones del usuario (2026-09-25)

1. **`dashboard_analytics.test.js`:** no mover el cálculo a JS. Además, el usuario encontró que la copia tampoco replicaba bien el `NULLIF`+`AVG` de SQL (contaba precio=0 como margen 0 en vez de excluirlo del promedio) — corregido en el Nivel 1 (sección 4.1).
2. **Bases de datos:** `stockpilot` local es la única que existe hoy y es la de desarrollo de Práctica de Ingeniería 5 — no crear nada nuevo todavía. Para el Nivel 2: `stockpilot_test` en el mismo servidor, inicializada con `database/init_pg.sql`, configurada en `.env.test`, con protección que aborte si el nombre no termina en `_test` o el host no es local. Lo de Bases de Datos Avanzadas (esquemas `ia`/`dw`, Docker Compose) es de los sprints 6-7 de `docs/plan_sprints_bases_datos_avanzadas.md` — no se toca en este plan.
3. **Nivel 1 aprobado**, con las condiciones de la sección 4.

---

## 4. Nivel 1 — hecho

### 4.1 `dashboard_analytics.test.js` corregido
La copia local de la fórmula ahora excluye del promedio los productos con `precio === 0` (en vez de contarlos como margen 0), igual que `NULLIF(precio, 0)` + `AVG()` en SQL. Se agregó un caso de prueba con múltiples productos, uno de ellos con precio 0, que antes no distinguía las dos implementaciones (con un solo producto ambas daban 0 por coincidencia). El `describe` externo se renombró a "Especificación de la fórmula: Margen Promedio (no prueba código de producción)" y el comentario superior explica por qué no hay una función de producción que importar (el cálculo real vive en SQL, no en JS).

### 4.2 Pruebas unitarias sin conexión a base de datos
Se confirmó que 3 de los 8 archivos de prueba disparaban una conexión real solo por import:
- `inventory_math.test.js` → importa `models/Alert.js` → `require('../config/database')`.
- `ai_feedback_metrics.test.js` → importa `controllers/feedbackController.js` → `require('../config/database')`.
- `security_auth_rules.test.js` → importa `middleware/auth.js` → `require('../models/User')` → `require('../config/database')`.

Se agregó `vi.mock('../../config/database.js', ...)` en los 3 (un objeto con `allAsync`/`getAsync`/`runAsync`/`getClient`/`pool` simulados con `vi.fn()`). Ninguna de las funciones que se prueban en esos archivos llama a `db` — son todas puras. **Confirmado:** `npm test` ya no imprime el log de auto-migración ni toca ningún Postgres, local o remoto.

### 4.3 Ramas nuevas cubiertas
- `middleware/auth.js` línea 7 (`evaluarAcceso`, Administrador con sesión "no válida" — bypass de sesión concurrente).
- `models/Alert.js` línea 25 (`item.lead_time || 3`, valor por defecto).
- `models/Alert.js` líneas 44-46 (mensaje "No hay ventas recientes..." cuando el producto está en nivel crítico por `stock_seguridad` sin historial de ventas, pero con `stock_actual > 0` — antes solo se probaba el caso `stock_actual = 0`).
- `models/Alert.js` línea 59 (una fecha de vencimiento informada que NO genera alerta, por estar a más de 30 días).

`models/Alert.js` y `middleware/auth.js` quedan en 100% de sentencias y ramas dentro de lo que ya no está en `/* v8 ignore */` (que sigue intacto, tal como pediste — eso es Nivel 2).

### 4.4 `coverage.include` ampliado de forma permanente
`vitest.config.js` ahora mide `controllers/**`, `models/**`, `middleware/**`, `utils/**` y `services/**` — el backend completo, siempre. `scripts/`, `database/` y `config/` quedan fuera porque nunca estuvieron en el patrón (no hizo falta excluirlos explícitamente).

### 4.5 Tabla antes/después por carpeta

| Carpeta | Antes (línea base, Paso 0, con ignore) | Después (Nivel 1) |
|---|---|---|
| `controllers/` | 1,2% (25/2156) | 1,2% (25/2156) — sin cambio, no se extrajo nada todavía |
| `middleware/` | 48,4% (15/31) | **51,6% (16/31)** |
| `models/` | 27,9% (100/358) | 27,9% (100/358) — Alert.js ya estaba en 100% con ignore; lo que subió fue *branches*, no *statements* |
| `services/` | 0,0% (0/80) | 0,0% (0/80) — sin cambio, fuera del alcance del Nivel 1 |
| `utils/` | 52,7% (89/169) | **53,8% (91/169)** |
| **TOTAL (sentencias)** | **8,2% (229/2794)** | **8,3% (232/2794)** |
| **TOTAL (ramas)** | 11,87% (175/1474) | **12,48% (184/1474)** |

Archivos que llegan a 100% de sentencias y ramas (dentro de lo no ignorado): `middleware/auth.js`, `middleware/validation.js`, `models/Alert.js`, `models/products/*.js`, `controllers/feedbackController.js`, `utils/ordenesBorrador.js`* y `utils/recomendacionesDashboard.js`* (*100% de sentencias, ~90% de ramas).

**Pruebas:** 149 → **154** (5 nuevas: 1 en `dashboard_analytics.test.js`, 3 en `inventory_math.test.js`, 1 en `security_auth_rules.test.js`). Las 154 pasan.

**Nota sobre `controllers/`:** el número no se mueve todavía a propósito — extraer funciones a `utils/` es justo lo que pediste aprobar por separado (sección 5) antes de tocar código.

---

## 5. Funciones puras candidatas a extraer — para tu aprobación, nada tocado todavía

Revisé los 4 controladores pedidos. En `clienteController.js` no encontré lógica de cálculo/decisión pura — es sobre todo CRUD (crear/leer/actualizar clientes y abonos); no propongo ninguna extracción ahí. En los otros tres encontré 6 candidatas, dos de ellas **duplicadas literalmente entre archivos** (mismo hallazgo de tipo O2/O5 que ya vimos con el motor de riesgo en el plan 17):

| # | Archivo(s) y líneas | Qué hace | Destino propuesto | Firma propuesta |
|---|---|---|---|---|
| 1 | `aiController.js:212-215` **y** `suppliersController.js:168-171` (duplicado, byte a byte) | Guardrail de ajuste de IA: recorta el `%` que sugiere la IA a ±100/50/20 según clase ABC, con piso de -50% | `utils/guardrailsIA.js` | `aplicarAjusteIA(baseLoad, adjNum, claseABC) → { clampedAdj, finalTotal }` |
| 2 | `aiController.js:497-500` | Corrección: un "2x1" sin `%` explícito implica 50% de descuento real | `utils/promociones.js` (nuevo) | `normalizarDescuento(type, discount) → effectiveDiscount` |
| 3 | `aiController.js:503-505` **y** `544/556` (duplicado dentro del mismo archivo) | Precio con descuento y capital liberado estimado | `utils/promociones.js` | `calcularImpactoPromocion(precio, stock, descuentoPct) → { discountedPrice, capitalLiberado }` |
| 4 | `aiController.js:524-542` | Reglas deterministas de promoción cuando la IA no cubre un candidato (liquidación/descuento/combo según días para vencer y stock) | `utils/promociones.js` | `determinarPromocionFallback(diasParaVencer, stock) → { type, discount, reason, duration_days }` |
| 5 | `aiController.js:781-787` | Umbrales sugeridos (`stock_seguridad`, `stock_minimo`) para un producto sin historial de ventas | `utils/sugerenciasStock.js` (nuevo) | `sugerirUmbralesStock(avgDailySales, leadTime) → { stockSeguridad, stockMinimo }` |
| 6 | `suppliersController.js:144-156` | Nivel de riesgo de una orden de compra (excede presupuesto / productos críticos / productos en alerta) | `utils/ordenesBorrador.js` (ya existe) | `evaluarRiesgoOrden(totalCost, budgetLimit, itemsCriticos, itemsNaranja) → { riskLevel, riskReason }` |
| 7 | `cashRegisterController.js:67-76` | Detecta descuadre de caja (>$5.000) y arma el título/mensaje de la notificación | `utils/cashRegisterHelpers.js` (nuevo) | `evaluarDescuadreCaja(diferencia, umbral = 5000) → { esSignificativo, esFaltante, titulo, mensaje }` |

**Ninguna cambiaría el comportamiento** — son extracciones literales de código ya existente a una función con nombre, llamada desde el mismo lugar. La única duda real es la #1: como está duplicada, extraerla implica que **ambos** controladores importen la misma función en vez de mantener cada uno su copia — técnicamente no cambia el resultado (son idénticas hoy), pero sí es el tipo de cambio que vale la pena que confirmes antes de tocar dos archivos a la vez.

Quedo pendiente de tu aprobación para extraer (todas, algunas, o ninguna) antes de escribir ese código.

---

## 7. Sección 5 ejecutada — las 7 extracciones + corrección de redondeo (2026-09-25 a 2026-09-27)

Aprobadas las 7, se hicieron en 3 tandas (grupo A/B/C) más un commit de corrección, cada uno verificado con la suite completa en verde antes de commitear. Todo en `feature/cobertura-nivel-1`, sin subir a `origin` ni mezclar a `main`.

### 7.1 Grupo A (commit `205be5e`)
- `aplicarAjusteIA` (#1, guardrail de ajuste de IA) → `utils/guardrailsIA.js`, usada por `aiController.js` y `suppliersController.js` (elimina la duplicación entre los dos archivos).
- `calcularImpactoPromocion` (#3) → `utils/promociones.js` (nuevo), usada dos veces dentro de `aiController.js` (elimina la duplicación interna).
- 154 → 164 pruebas.

### 7.2 Grupo B (commit `d54a9a6`)
- `determinarPromocionFallback` (#4) → `utils/promociones.js`.
- `sugerirUmbralesStock` (#5) → `utils/sugerenciasStock.js` (nuevo).
- 164 → 174 pruebas.

### 7.3 Corrección de redondeo, primera pasada (commit `d42dc4b`)
Al escribir las pruebas de `aplicarAjusteIA` apareció un bug real, ya existente en el código original desde antes de esta sesión (nadie lo había visto porque no tenía pruebas): `baseLoad * (1 + %/100)` puede dar p. ej. `220.00000000000003` en vez de `220` exacto (ruido de punto flotante de JS), y `Math.ceil` sube al entero siguiente (`221`) aunque el resultado real sea un entero. Se corrigió puntualmente en `guardrailsIA.js` con `Math.ceil(Number(x.toFixed(6)))`. 174 → 175 pruebas.

### 7.4 Grupo C + generalización de la corrección de redondeo (commits `2654924` y `d8bc841`)
- `normalizarDescuento` (#2), `evaluarRiesgoOrden` (#6, a `utils/ordenesBorrador.js` que ya existía) y `evaluarDescuadreCaja` (#7, `utils/cashRegisterHelpers.js` nuevo). 175 → 188 pruebas.
- Al auditar el resto del backend buscando el mismo patrón (`Math.ceil` sobre un cálculo con divisiones), se encontró el **mismo bug** en `utils/sugerenciasStock.js` (las dos líneas de `sugerirUmbralesStock`) y en `utils/reposicion.js` (`cantidadBase` línea 75 y, más importante, `rop` línea 85 — `rop` decide la clasificación de riesgo CRÍTICO/MEDIO/BAJO de un producto).
- Se creó **`techoSeguro(x)`** en `utils/redondeo.js` como reemplazo único de `Math.ceil` para este patrón, y se aplicó en los tres archivos: `guardrailsIA.js`, `sugerenciasStock.js` (2 líneas) y `reposicion.js` (líneas 75 y 85; la línea 82, el piso para productos sin ventas, se dejó igual — valores ya enteros, sin el mismo riesgo). Caso real verificado: `calcularReposicion` con `ventasDia30=2.2, leadTime=25, stockSeguridad=0, stock=56` pasaba de `nivel: "reponer"` (incorrecto, por `rop=56`) a `nivel: "ok"` (correcto, `rop=55`) con la corrección.
- 188 → 196 pruebas (8 nuevas: 2 en `sugerencias_stock.test.js`, 1 en `reposicion.test.js`, 5 en `redondeo.test.js` nuevo). Se confirmó explícitamente que ninguna prueba preexistente de `reposicion.test.js` (17 de `calcularReposicion` + las de `calcularTendencia`/`costoUnitario`/`agruparPorProveedor`) cambió de resultado.

**Nota sobre `controllers/`:** su cobertura casi no se movió con estas extracciones (~1.2%) — es esperado, ver nota de la sección 4.5: el código movido se prueba desde `utils/`, no desde el controlador que lo llama.

---

## 8. Nivel 2 — infraestructura lista (2026-09-27)

Antes de escribir pruebas de los 7 flujos se armó la base de todo el Nivel 2:

- **`tests/integration/setupTestDb.js`** — se registra como `setupFiles` de `vitest.integration.config.js` (corre antes que cualquier prueba). Carga `.env.test` con `override: true` y **aborta el proceso** si `DATABASE_URL` no es, de forma verificable, local (`localhost`/`127.0.0.1`) y con nombre de base terminado en `_test`. Probado a mano con 3 casos: `stockpilot_test` local (pasa), una URL de Neon (aborta), `stockpilot` local sin `_test` (aborta) — los tres se comportaron como se esperaba.
- **`.env.test`** (no versionado — ver hallazgo de `.gitignore` abajo) — mismo usuario/clave de Postgres que `.env`, apuntando a `stockpilot_test`; `OPENAI_API_KEY`, `EMAIL_*` y `RESEND_API_KEY` con valores dummy a propósito (las pruebas de integración no deben depender de servicios externos reales; el flujo "IA caída" necesita justamente que la clave de OpenAI no sea válida); sin `REDIS_URL` (la app cae a sesiones en Postgres/memoria).
- **`vitest.integration.config.js`** (nuevo, separado de `vitest.config.js`) — `include: tests/integration/**/*.test.js`, `fileParallelism: false` (varias pruebas van a compartir la misma base y alguna ejercita concurrencia real dentro de sí misma). `vitest.config.js` ahora excluye `tests/integration/**` para que `npm test` nunca las toque.
- **`npm run test:integration`** agregado a `package.json`, separado de `npm test`.
- **`supertest`** instalado como devDependency (no estaba).
- **`stockpilot_test`** creada en el Postgres local, con el esquema completo (22 tablas, verificado idéntico a `stockpilot`) — bootstrap con `database/init_pg.sql` + la auto-migración de `config/database.js` (esta corrió *contra la base de prueba*, protegida por el guard de arriba).

### 8.1 Hallazgo y arreglo: `database/init_pg.sql` no podía levantar una base nueva
Al intentar correr el script contra `stockpilot_test` (recién creada, vacía) falló con `no existe la relación «usuarios»`. Causa: dependencia circular entre `Tienda` (columna `id_propietario` con `REFERENCES Usuarios`, definida en la línea 23, antes de que `Usuarios` exista) y `Usuarios` (columna `id_tienda` con `REFERENCES Tienda`, línea 38). Es el único caso circular del archivo — se revisaron todos los `CREATE TABLE`/`REFERENCES` y el resto está en orden correcto. Nunca se había notado porque ni `stockpilot` (desarrollo) ni producción se armaron corriendo este script contra una base vacía — se fueron construyendo con `ALTER TABLE` incrementales vía la auto-migración de `config/database.js`.

**Arreglo:** se sacó el `REFERENCES` de `Tienda.id_propietario` (queda `INTEGER` simple ahí) y se agregó la FK con un `ALTER TABLE ... ADD CONSTRAINT` envuelto en `DO $$ ... IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)` (Postgres no soporta `ADD CONSTRAINT IF NOT EXISTS`) justo después de crear `Usuarios`. Cero riesgo para `stockpilot`/producción: ahí las tablas ya existen y `CREATE TABLE IF NOT EXISTS` no hace nada; el bug solo afectaba a una base nueva. Verificado de punta a punta: `stockpilot_test` recreada desde cero, `init_pg.sql` corrido limpio, auto-migración corrida encima, 22 tablas resultantes — comparadas y **idénticas** a las de `stockpilot`.

### 8.2 Hallazgo y arreglo: `.gitignore` no cubría `.env.test`
Solo excluía `.env` exacto. Se cambió a `.env` + `.env.*` + `!.env.example` (para no perder el ejemplo versionado). Sin esto, `.env.test` (con la misma contraseña de Postgres local que `.env`) hubiera quedado expuesto a un `git add` amplio.

### 8.3 Hallazgo, no corregido todavía: `config/database.js` no tiene ninguna protección
Su bloque de auto-migración corre automáticamente en cada `require`, contra lo que sea que diga `DATABASE_URL`, sin verificar nada — igual que `scripts/migrate.js`. Es justo el riesgo que este Nivel 2 busca cerrar, pero hoy la protección solo vive en el punto de entrada de las pruebas de integración (`setupTestDb.js`), no en `config/database.js` mismo (ese archivo lo usa también la app en producción). No se tocó — queda como decisión aparte si en algún momento se quiere un guard más permanente ahí.

---

## 6. Para continuar en la próxima sesión

**Rama:** `feature/cobertura-nivel-1` (creada a partir de `feature/cobertura-real-backend`, que solo tenía el Paso 0). Sin subir a `origin` ni mezclar a `main`.

**Pendiente, en orden:**
1. Escribir las pruebas de integración de los 7 flujos prioritarios (venta con concurrencia, caja, cartera, `Alert.generate` concurrente, aislamiento multi-tienda, autenticación, IA caída) en `tests/integration/`, contra `stockpilot_test` (ya armada, ver sección 8).
2. Definir la limpieza de datos entre pruebas (probablemente `TRUNCATE ... RESTART IDENTITY CASCADE` en un `beforeEach`/`afterEach`).
3. Recién con el Nivel 2 completo se quitan los `/* v8 ignore */` que ya no hagan falta (`models/Alert.js:93-307`, `controllers/feedbackController.js:16-228`) — los que queden, con un comentario explicando por qué.
4. Al cerrar el Nivel 2: agregar `thresholds` en `vitest.config.js` para que la cobertura no retroceda.

**Estado técnico verificado hoy (2026-09-27):** 196/196 pruebas unitarias en verde, sin conexión a base de datos desde `npm test`. `stockpilot_test` creada y con el esquema completo. Sección 5 cerrada por completo; Nivel 2 con la infraestructura lista, faltan los 7 flujos de pruebas.
