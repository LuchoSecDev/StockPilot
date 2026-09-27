# Plan 20: Cobertura de pruebas real del backend

**Estado:** **Plan 20 completo — Nivel 1, sección 5 y Nivel 2, sin nada pendiente.** Los 7 flujos de integración del encargo original están hechos (ver sección 8). 149 → 196 pruebas unitarias + **47 de integración** contra Postgres real (`stockpilot_test`). En el camino se encontraron y corrigieron 4 bugs reales: sobreventa concurrente en `registrar-venta-carrito` (8.7), dependencia circular en `database/init_pg.sql` (8), respuesta engañosa en `suppliersController.update`/`.delete` (8.12), e inconsistencia en la degradación ante fallas de IA entre los 3 endpoints de `aiController.js` (8.13). Se limpiaron los `/* v8 ignore */` que ya no hacían falta (8.14) y se agregó un piso de `thresholds` de cobertura en `vitest.config.js` (8.15).
**Fecha:** 2026-09-25 (creación) — actualizado 2026-09-27 (plan cerrado por completo)
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

### 8.4 Hallazgo y arreglo: `app.js` no se podía importar para pruebas
`app.js` nunca exportaba la app de Express, y al final del archivo llamaba **incondicionalmente** a `startServer(PORT)` (abre un puerto real) y `scheduler.startScheduler()` (arranca los cron jobs reales) — pasaba lo mismo con solo hacer `require('../../app')`. Se envolvieron esas dos llamadas en `if (require.main === module) { ... }` (patrón estándar de Node) y se agregó `module.exports = app` al final. `require.main === module` es `true` exactamente en los mismos casos de siempre (`npm start`, `npm run dev`, producción) — verificado con un smoke test real (`node app.js` sigue arrancando el servidor y el scheduler igual que antes) y con un `require()` directo (ya no abre puerto ni arranca cron, y exporta la función de Express).

### 8.5 Hallazgo y arreglo: `.env.test` filtraba las credenciales reales de Redis y Resend
Al probar el `require('./app.js')` de 8.4 contra `.env.test`, la app se conectó al **Redis real de producción** (Upstash) y quedó lista para mandar correo por el **Resend real**. Causa: `config/redis.js` y `config/mailer.js` deciden con `if (process.env.REDIS_URL)` / `!!process.env.RESEND_API_KEY` — como esas dos variables no estaban en `.env.test`, el `require('dotenv').config()` (sin `override`) que hacen `app.js`/`config/database.js` internamente las completaba con los valores reales de `.env`, porque dotenv sin `override` solo respeta una variable si ya existe en `process.env`, y estas dos no existían. Se agregaron a `.env.test` como **vacías a propósito** (`REDIS_URL=`, `RESEND_API_KEY=`) — así sí "existen" (aunque vacías) y bloquean el `dotenv.config()` posterior; verificado que con esto la app cae a sus fallbacks locales (sesiones en PostgreSQL, correo por SMTP dummy que falla silenciosamente).

### 8.6 Flujo 6/7 — Autenticación (commit `ab64d46`)
Primer flujo escrito, `tests/integration/autenticacion.test.js`, 10 pruebas: login correcto (200, sesión funcional en `/api/session-info`), contraseña incorrecta y usuario inexistente (401 idéntico en ambos casos — no filtra si el usuario existe), campos faltantes (400), endpoint protegido sin sesión (401) y con sesión (200) usando `/api/caja/sesion` (pasa por el middleware real `requireLogin`, a diferencia de `/api/session-info`/`/api/perfil` que tienen su propio chequeo inline y no sirven para probar la invalidación de sesión concurrente), logout (CSRF token vía `/api/csrf-token` + header `X-CSRF-Token`, ya que `/api/logout` no está en la lista de rutas exentas de CSRF), bloqueo de segundo login para Tendero (409 `SESSION_ACTIVE`), invalidación real de la sesión vieja al forzar un segundo login (`force:true` → la sesión anterior da 401 `CONCURRENT_SESSION` en un endpoint con `requireLogin`), y Administrador sin bloqueo de sesiones concurrentes. Las 10 pasan contra `stockpilot_test`.

**Helpers nuevos, para reusar en los 6 flujos que faltan:**
- `tests/integration/helpers/db.js` — `limpiarBaseDePruebas()`: `TRUNCATE` de las 22 tablas con `RESTART IDENTITY CASCADE`, llamado en un `beforeEach` de cada archivo de prueba.
- `tests/integration/helpers/fixtures.js` — `crearTienda()`/`crearUsuario()`, usando `Store.create`/`User.create` reales (mismo hash bcrypt que producción), con sufijos únicos para no chocar con los `UNIQUE` de `correo`/`usuario` entre pruebas.

No se probó el límite de fuerza bruta de `authLimiter` (10 intentos fallidos/15min) — no es uno de los 7 flujos pedidos, y su contador en memoria es compartido por IP entre todas las pruebas del mismo archivo, así que mezclarlo con estas pruebas habría hecho el archivo frágil sin aportar a lo pedido.

### 8.7 Flujo 1/7 — Venta con concurrencia: bug real de sobreventa encontrado y corregido (commit `8863f4f`)
`tests/integration/venta_concurrencia.test.js`, 3 pruebas. La primera (`registrar-venta`, un solo producto) confirma que el `SELECT ... FOR UPDATE` que ya tenía protege bien: con stock=1 y 2 pedidos simultáneos, una gana (200) y la otra pierde (400 "Stock insuficiente"), stock final 0, una sola fila en `Ventas`.

**Bug encontrado en `registrar-venta-carrito` (POS, `SaleController.registerCartSale`):** su `SELECT` de stock **no tenía `FOR UPDATE`** (a diferencia de `registerSale`). Con 2 pedidos simultáneos contra stock=1 el problema no se notaba (la ventana de carrera es muy chica, salía bien "por suerte" en 8/8 corridas de prueba) — pero con **5 pedidos simultáneos contra stock=3, las 5 se registraban como exitosas** (100% reproducible en 6/6 corridas antes del arreglo): sobreventa real, inventario podía quedar negativo. Exactamente el escenario de varios vendedores en el mismo POS o una pestaña duplicada.

**Arreglo:** se agregó `FOR UPDATE` a esa consulta, mismo patrón que ya usaba `registerSale`. Verificado: la prueba de 5 pedidos/stock=3 pasó en 31/32 corridas después del arreglo (antes fallaba 6/6) — la única corrida que falló no se pudo reproducir en 15 intentos posteriores, consistente con la flakiness normal de este tipo de prueba (contención real de recursos en la máquina de desarrollo), no con que el bug siga presente.

**Pruebas:** 196 unitarias (sin cambio) + **13 de integración** (10 autenticación + 3 venta). Todas en verde.

### 8.8 Flujo 2/7 — Caja (commit `8b228ba`)
`tests/integration/caja.test.js`, 10 pruebas: abrir caja (éxito, refleja en `/api/caja/sesion`), abrir dos veces seguidas (400 la segunda), **5 aperturas simultáneas del mismo vendedor** (mismo tipo de prueba de contención dura que expuso el bug de la sección 8.7), cerrar sin abrir (400), cerrar sin descuadre (sin notificación), cerrar con descuadre >$5.000 (notificación de faltante, con el `titulo`/`mensaje` que arma `evaluarDescuadreCaja` del grupo C de la sección 5), egreso de Tendero dentro/fuera del límite de la tienda (`limite_egreso_tendero`, default $150.000), Administrador sin ese límite, y egreso sin caja abierta (400).

**Sobre la prueba de 5 aperturas simultáneas:** a diferencia de `registrar-venta-carrito` (sección 8.7), acá **no se reprodujo ningún duplicado** — 10/10 corridas dieron exactamente 1 sesión abierta (1×200 + 4×400). El código tampoco usa transacción ni `FOR UPDATE` acá (`openSession` hace un `SELECT` y después un `INSERT`, sin bloqueo explícito), así que no está *garantizado* por diseño — pero a diferencia del caso de ventas (que fallaba 100% de las veces bajo la misma prueba), acá la ventana de carrera es mucho más angosta (2 consultas simples vs. el loop de `registerCartSale`) y no logré forzar el bug ni con más contención. Lo dejo anotado como posible mejora futura de bajo riesgo (un índice único parcial `WHERE estado = 'Abierta'` en `SesionCaja` cerraría la duda de raíz), no como un bug confirmado — no lo implementé porque no hay una falla reproducida que lo justifique.

**Pruebas:** 196 unitarias + **23 de integración** (10 autenticación + 3 venta + 10 caja). Todas en verde.

### 8.9 Hallazgo y arreglo importante: fallas intermitentes reales entre archivos de prueba (no un bug de la app)
Al correr la suite de integración completa varias veces seguidas, entre 1 y 3 de cada 5 corridas fallaban con errores intermitentes — algunos en `autenticacion.test.js` (que ni toca ventas), del tipo "viola la llave foránea «usuarios_id_tienda_fkey»" y hasta un "se ha detectado un deadlock" real de Postgres. No era un bug de negocio: era la infraestructura de pruebas.

**Causa real, en dos capas:**
1. Vitest aísla cada archivo de prueba en su propio registro de módulos por defecto, así que `config/database.js` (con su propio `Pool` de conexiones **y** su IIFE de auto-migración) se volvía a cargar una vez por archivo — hasta 4 `Pool`s y 4 migraciones corriendo contra la misma base en la misma corrida.
2. Esa auto-migración ya de por sí no se espera (es un IIFE sin `await` desde ningún lado) y **reintenta cada 3 segundos si falla**. Si el primer `TRUNCATE` de un `beforeEach` corría mientras la migración de OTRO archivo seguía a mitad de camino, Postgres detectaba el choque de bloqueos (deadlock) o dejaba una fila a medio insertar (violación de FK) — y si la migración fallaba por eso, reintentaba y volvía a chocar con la prueba siguiente. Esto explica que las corridas fallidas tardaran 50s en vez de los ~16s normales.

**Arreglo, en dos partes:**
- `vitest.integration.config.js`: se agregó `isolate: false` (además del `fileParallelism: false` que ya tenía) — todos los archivos de prueba comparten un solo registro de módulos, así que `config/database.js` se carga una sola vez para toda la corrida (un solo `Pool`, una sola migración).
- `config/database.js`: la IIFE de auto-migración ahora se guarda en `db.migrationReady` (antes no estaba asignada a nada). Cambio de una línea, puramente aditivo — nada que ya use `db` se ve afectado, nadie más mira esa propiedad.
- `tests/integration/setupTestDb.js`: ahora espera `await db.migrationReady` antes de dejar correr cualquier prueba (se convirtió a sintaxis ESM con `import`/`import()` dinámico para poder usar `await` de nivel superior, manteniendo el orden crítico: primero el guard de seguridad, recién después cargar `config/database.js`).

**Verificado:** 31 corridas completas de la suite de integración, todas limpias, después del arreglo (antes fallaba entre 20% y 60% de las veces, según el lote). Sin este arreglo, cualquier flujo nuevo de Nivel 2 habría heredado esta fragilidad.

### 8.10 Flujo 3/7 — Cartera (commit `df940a0`)
`tests/integration/cartera.test.js`, 8 pruebas: crear cliente (éxito y sin nombre → 400), listar clientes con `saldo_pendiente` calculado, **flujo completo real** (venta a crédito con `metodo_pago:'Fiado'` crea deuda → `saldo_pendiente` correcto → un abono parcial la reduce → correcto también en el detalle y en el listado), abono a cliente inexistente (404), abono con monto inválido (400), venta Fiado sin `id_cliente` (400, ya cubierto a nivel unitario pero confirmado aquí de punta a punta), y **aislamiento por tienda** (un cliente de la tienda A no se puede ver, listar ni abonar desde la tienda B — 404 en los tres casos). Sin hallazgos nuevos: `clienteController.js` ya filtra correctamente por `id_tienda` en sus 4 endpoints. Las 8 pasan de la primera corrida.

**Pruebas:** 196 unitarias + **31 de integración** (10 autenticación + 3 venta + 10 caja + 8 cartera). Todas en verde, confirmado con corridas repetidas tras el arreglo de la sección 8.9.

### 8.11 Flujo 4/7 — `Alert.generate()` concurrente (commit `7d2cba7`)
`tests/integration/alert_generate_concurrencia.test.js`, 5 pruebas. A diferencia de los flujos de venta (sección 8.7, sin protección) y caja (sección 8.8, sin protección pero sin bug reproducido), `Alert.generate()` **ya tenía** una defensa explícita desde el plan 17 (hallazgo O3): `pg_advisory_xact_lock(tiendaId)` dentro de la transacción, para que dos regeneraciones de la misma tienda queden en fila en vez de pisarse.

- **5 llamadas concurrentes a `/api/alertas/generate` de la misma tienda:** nunca duplica la alerta del mismo producto — confirmado con 10 corridas repetidas de esta prueba puntual (después de lo aprendido en la sección 8.7, donde 2 pedidos "pasaban por suerte" y hacían falta 5 para exponer el bug real; acá 5 concurrentes nunca fallaron, ni una vez).
- **Dos tiendas distintas generando al mismo tiempo:** el lock es por tienda (usa `tiendaId` como clave del advisory lock) — ninguna bloquea a la otra y cada una termina con su propia alerta, sin mezclarse.
- **Generar dos veces seguidas (secuencial):** la alerta se actualiza en el mismo lugar (mismo `id_alerta`, misma `fecha_creacion`) en vez de duplicarse — confirma explícitamente el comportamiento "upsert" que ya se sabía por el código, ahora con una prueba real.
- **Producto que deja de estar crítico:** la siguiente generación resuelve la alerta vieja (`resuelta=1`), no queda activa.
- **`DISABLE_ALERT_ENGINE=true` (interruptor de emergencia, plan 17 O8):** `generate()` no crea nada y devuelve 0 — probado activando la variable en caliente dentro de la prueba y restaurándola en un `finally`.

Sin hallazgos nuevos — es el primer flujo de los 7 donde la protección de concurrencia ya existía y de verdad funciona como se esperaba.

**Pruebas:** 196 unitarias + **36 de integración** (10 autenticación + 3 venta + 10 caja + 8 cartera + 5 alertas). Todas en verde.

### 8.12 Flujo 5/7 — Aislamiento multi-tienda (commit `9b13f62`)
`tests/integration/aislamiento_multitienda.test.js`, 5 pruebas, complementando el chequeo puntual ya hecho en `cartera.test.js` (sección 8.10): productos (el listado de una tienda nunca incluye los de otra; ver/editar/eliminar por ID el producto de otra tienda da 404 — el guard `verifyProductOwnership`, con comentarios `🛡️ IDOR` explícitos en el código, funciona), ventas (comprar un producto de otra tienda da 404 y no mueve su stock; el listado de ventas nunca mezcla tiendas), y proveedores (el listado tampoco mezcla tiendas).

**Hallazgo — corregido (2026-09-27):** `suppliersController.update` y `.delete` sí filtraban su `UPDATE`/`UPDATE...estado='Inactivo'` por `WHERE id_proveedor = ? AND id_tienda = ?` — los datos quedaban seguros, nunca se modificaba lo de otra tienda —, pero no revisaban si la consulta afectó alguna fila: si el proveedor era de otra tienda, el endpoint respondía `{success:true, message:'Proveedor actualizado'}` igual, como si hubiera funcionado. Se corrigió revisando `result.changes` (que `db.runAsync` ya expone) y devolviendo 404 si es 0 — mismo patrón que `productController.verifyProductOwnership`. La prueba de este archivo se actualizó para esperar el 404, y se agregó una prueba nueva confirmando que actualizar el propio proveedor (misma tienda) sigue funcionando.

**Pruebas:** 196 unitarias + **41 de integración** (10 autenticación + 3 venta + 10 caja + 8 cartera + 5 alertas + 6 aislamiento). Todas en verde.

---

### 8.13 Flujo 7/7 — IA caída (commit `cad4517`)
`tests/integration/ia_caida.test.js`, 4 pruebas. `.env.test` deja `OPENAI_API_KEY` con un valor presente pero inválido a propósito (no un mock: la llamada a OpenAI se intenta de verdad y falla con un `401 Incorrect API key` real del servicio de OpenAI) — la forma más fiel de simular la IA caída sin inventar un doble falso.

- **`getDashboardRecommendations` (con productos para reponer, para forzar la llamada a OpenAI):** degrada con elegancia — responde **200** con `error:true` y una recomendación de reemplazo ("Motor IA en mantenimiento. Use el análisis de riesgo detallado."), no rompe la pantalla del usuario.
- **`getDashboardRecommendations` sin productos para reponer:** ni siquiera intenta llamar a OpenAI, responde `recommendations:[]` de una.
- **`getDashboardRecommendations` sin `OPENAI_API_KEY` configurada** (mutada en caliente dentro de la prueba, restaurada en un `finally`): 500 explícito "no está configurada", sin intentar la red.
- **`assessClientRisk` con OpenAI fallando:** propaga un **500** crudo.

**Hallazgo — corregido (2026-09-27):** de los 3 endpoints de IA que llaman a OpenAI directamente en `aiController.js`, solo `getDashboardRecommendations` degradaba con elegancia ante una falla de OpenAI — `getPromotionSuggestions` y `assessClientRisk` devolvían `res.status(500)` con el error crudo. Se corrigieron los dos:
- `getPromotionSuggestions`: ya tenía un motor de reglas deterministas (`determinarPromocionFallback`) para cubrir candidatos que la IA *omitía* en su respuesta. Se reutilizó ese mismo motor para cubrir el 100% de los candidatos cuando la llamada a OpenAI falla del todo (se envuelve solo esa llamada en su propio `try/catch`, y si falla se sigue como si `aiResponse.promotions` viniera vacío) — sigue devolviendo sugerencias reales, no un aviso genérico.
- `assessClientRisk`: no existe un motor determinista de riesgo crediticio, así que el fallback es un aviso de mantenimiento (mismo criterio que `getDashboardRecommendations`), con `{success:true, error:true, analisis:{riesgo:'Evaluando', ...}}`; se salta el registro en `Auditoria_IA` en ese caso (no hay nada real que auditar).

Pruebas actualizadas: `ia_caida.test.js` ahora espera 200 con degradación elegante en los 3 endpoints, y se agregó un caso nuevo para `getPromotionSuggestions`.

**Pruebas:** 196 unitarias + **47 de integración** (10 autenticación + 3 venta + 10 caja + 8 cartera + 5 alertas + 6 aislamiento + 5 IA caída — antes 4, se agregó el caso de promociones). Todas en verde. **Los 7 flujos del encargo original quedan completos, y los 2 hallazgos que quedaron pendientes ya están corregidos.**

### 8.14 Limpieza de `/* v8 ignore */` (commit `ab189e8`)
Se revisaron los 4 archivos con bloques `/* v8 ignore */` de todo el repo (no solo los 2 que había anotado el plan — se hizo `grep` completo para no dejar ninguno afuera):

- **`models/Alert.js`:** el bloque original cubría `generate`, `dryRun`, `findActive`, `resolve` y `getStats` juntos. Se separó: `generate()` y `findActive()` (cubiertas por `alert_generate_concurrencia.test.js`) quedan sin ignorar; `dryRun()`, `resolve()` y `getStats()` (sin ningún test todavía) quedan en dos bloques más chicos, cada uno con un comentario explicando por qué.
- **`middleware/validation.js`:** el bloque cubría las 7 funciones de validación juntas. `sanitizeBody`, `validateLogin`, `validateProduct`, `validateSale` y `validateCartSale` quedan sin ignorar (cubiertas por los flujos de autenticación/ventas/aislamiento); `validateRegister` y `validateReport` (ningún flujo toca `/api/registro` ni reportes manuales) quedan cada una en su propio bloque, con comentario.
- **`middleware/auth.js`:** `requireLogin` (probada a fondo: sin sesión, con sesión, sesión concurrente) y `requireAdmin` (probada en su camino de éxito) quedan sin ignorar — el bloque completo se quitó.
- **`controllers/feedbackController.js`:** sin cambios — ningún flujo del Nivel 2 toca este módulo. Se le agregó el comentario explicando por qué sigue ignorado, que antes no tenía.

Verificado: 196 unitarias + 47 de integración en verde después de la reestructuración (solo se movieron comentarios/marcadores, ninguna lógica cambió).

### 8.15 `thresholds` en `vitest.config.js` (commit `f98de10`)
Medida la cobertura real (`npm run test:coverage`, solo unitarias) tras cerrar las secciones 8.1-8.14: **10,53% statements / 15,69% branches / 19,55% functions / 9,75% lines**. Se agregó `coverage.thresholds` en `vitest.config.js` fijado un poco por debajo de esos números (10/15/19/9) — un piso de regresión, no una meta a alcanzar. Verificado que el mecanismo funciona de verdad: se subió `statements` a 99 a propósito, `npm run test:coverage` falló con `ERROR: Coverage for statements (10.53%) does not meet global threshold (99%)`, y se revirtió al valor real.

**Nota importante para no confundirse en el futuro:** este threshold solo mide `npm test`/`npm run test:coverage` (unitarias, `tests/integration/**` sigue excluido de `vitest.config.js` a propósito). Las 47 pruebas de integración (`npm run test:integration`) cubren código real que este número no refleja (`Alert.generate`/`findActive`, `requireLogin`/`requireAdmin`, la mayoría de `middleware/validation.js`, etc. — ver sección 8.14). Si en el futuro se mueve código de un archivo cubierto por unitarias a uno que solo prueban las de integración, este número bajará aunque la cobertura *real* no haya empeorado — hay que mirar los comentarios que se dejaron en cada `/* v8 ignore */` para saber qué está probado por cuál suite antes de asumir una regresión real.

**Pruebas:** 196 unitarias + 47 de integración en verde, sin cambios de conteo (solo se agregó configuración, ninguna prueba nueva).

---

## 6. Para continuar en la próxima sesión

**Rama:** `feature/cobertura-nivel-1` (creada a partir de `feature/cobertura-real-backend`, que solo tenía el Paso 0). Sin subir a `origin` ni mezclar a `main`.

**Todo el plan 20 está completo:** Nivel 1, sección 5, Nivel 2 (los 7 flujos + los 2 hallazgos corregidos), limpieza de `/* v8 ignore */` y `thresholds` de cobertura. No queda ningún pendiente abierto en este plan — cualquier trabajo nuevo (Nivel 3, otro módulo, etc.) sería un plan aparte.

**Estado técnico verificado hoy (2026-09-27):** 196 unitarias + 47 de integración en verde. `stockpilot_test` creada y con el esquema completo. `coverage.thresholds` en `vitest.config.js` protegiendo el piso real medido hoy.
