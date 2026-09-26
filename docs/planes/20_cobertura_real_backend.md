# Plan 20: Cobertura de pruebas real del backend

**Estado:** Hallazgos verificados y línea base (Paso 0) medida. **Sin implementar Nivel 1 ni Nivel 2** — pendiente de aprobación explícita, como se pidió.
**Fecha:** 2026-09-25
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

## 3. Antes de proponer el Nivel 1 y el Nivel 2

Con esta línea base ya tienes el número honesto de hoy. Antes de seguir necesito que confirmes:
1. La corrección de `dashboard_analytics.test.js` (sección 1.3) — ¿opción (a) (cambiar el test para que no reimplemente la fórmula, dejando la protección real al Nivel 2) o prefieres explorar mover el cálculo a JS aunque cambie el comportamiento de producción?
2. Si ya tienes pensado el Postgres local como la base de pruebas del Nivel 2 (parece que sí, dado que `.env` ya apunta ahí) o si prefieres una base separada exclusiva para pruebas, distinta de la que uses para desarrollo manual.
3. Una meta de cobertura por carpeta ahora que ves los números reales — la más urgente por dinero/stock/seguridad son `controllers/saleController.js`, `controllers/cashRegisterController.js`, `models/Product.js` y `middleware/auth.js`, pero la decisión final de metas es tuya.
