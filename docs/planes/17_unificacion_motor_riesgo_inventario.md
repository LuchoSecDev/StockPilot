# Plan 17: Unificación del motor de riesgo de inventario

**Estado:** El hallazgo E1 ya se corrigió y subió a `main` (commit `c6ae00d`). Fases 0 a 6 implementadas y verificadas en `feature/unificacion-motor-riesgo`, ya mezclada en `main` (P17-03; corregido el 9-oct-2026). Plan cerrado salvo por dos consolidaciones descartadas por bajo beneficio (ver 8.7, Fase 6). Ver sección 8 para las decisiones finales y las fases actualizadas.
**Corrección 2026-09-25:** una revisión externa (Claude en Cowork) encontró que la fila "Fase 4" de 8.7 decía "Hecho" sin serlo del todo: los disparadores de `Alert.generate` cubrían `productController.js`, `inventoryController.js` y `saleController.js`, pero no `suppliersController.js` — recibir una orden de proveedor actualiza `Productos.cantidad`/`MovimientosStock` con SQL directo dentro de su propia transacción, sin pasar por ninguno de los otros controladores. Un producto recibido no actualizaba sus alertas hasta la siguiente venta (el hallazgo O2 original, sección 7.5, seguía parcialmente abierto). **Ya corregido:** se agregó `Alert.generate(tiendaId)` (fire-and-forget, mismo patrón que los demás disparadores) al final de `completarRecepcion` en `suppliersController.js`, después del `COMMIT`. O2 ahora sí está cerrado en las 4 rutas que mueven stock.
**Cierre 2026-09-24 (O8):** se construyó la red de seguridad que quedaba pendiente — ver sección 9.
**Fecha:** 2026-09-23 (v1) · 2026-09-24 (v2, segunda revisión externa verificada contra el código; v3, decisiones del usuario sobre las 6 preguntas abiertas, también verificadas; O8, red de seguridad) · 2026-09-25 (corrección del gap de O2 en `suppliersController.js`)
**Depende de / relacionado con:** plan 13 (`13_plan_consejero_ia_a_borrador_de_orden.md`) y plan 16 (`16_plan_consejero_ia_fase_e_cierre_del_ciclo.md`), que introdujeron `utils/reposicion.js` como motor único de reposición para el Consejero IA y Proveedores.

> *Nota de rutas (9-oct-2026):* desde la fase R1 del plan 21 (8-oct), `utils/reposicion.js`, `utils/entradasMotor.js`, `utils/guardrailsIA.js` y `utils/sugerenciasStock.js` viven en `services/inventory/`, y la lógica de IA de `aiController.js` está en `services/ia/`. Este plan conserva las rutas de su fecha. `utils/recomendacionesDashboard.js` y `utils/promociones.js` siguen en `utils/`.

---

## 0. Resumen ejecutivo

Hoy conviven **7 cálculos independientes** relacionados con "¿este producto tiene un problema de stock?" (6 de "riesgo/urgencia de quiebre" + 1 de "candidato a promoción" que se apoya en el mismo tipo de velocidad de venta pero resuelve una pregunta distinta y queda fuera del alcance de unificación de este plan).

| # | Fórmula | Ubicación exacta | Qué calcula | Pantallas/endpoints que alimenta |
|---|---|---|---|---|
| 1 | `Alert.determinarAlertaStock` | `models/Alert.js:200-204`, invocada desde `Alert.generate` en `models/Alert.js:81` | Compara **días para agotarse** (`cantidad / velocity_30d`) contra `lead_time` y `lead_time + frecuencia_compra_dias`. Persiste filas reales en `Alertas` (`critico`/`advertencia`). | `GET /api/alertas` y `/api/alertas/stats` (`controllers/alertController.js`) → Monitor Alertas (`frontend/src/pages/AlertasPage.jsx`), campanita (`frontend/src/components/NotificationCenter.jsx`), `alertasCriticas`/`alertasAdvertencia` del Dashboard (`controllers/dashboardController.js:24-26` → `getStats` → `frontend/src/pages/DashboardPage.jsx`), y el aviso superior de Catálogo (`frontend/src/hooks/useProductosPage.js:70-102`, función `verificarAlertas`) |
| 2 | `calcNivelStock` (hook) | `frontend/src/hooks/useProductosPage.js:147-159` | Cliente: `rop = velocity*leadTime + stockSeguridad`, `umbralCritico = max(stockSeguridad, ceil(velocity*2))`, `umbralBajo = max(rop, stockMinimo)`. | Solo **ordena** `listRender` (`useProductosPage.js:345-367`) por urgencia en Catálogo; no se muestra directamente en la UI |
| 3 | `calcNivelStock` (tabla) | `frontend/src/components/productos/ProductTable.jsx:26-30` | Cliente, regla simple: `cantidad <= stock_minimo` → crítico; `cantidad <= stock_minimo*1.5` → bajo. Ignora `velocity`, `lead_time` y `stock_seguridad` aunque le llegan en el objeto `p`. | Etiquetas **"Agotado"/"Por agotarse"/"Pedir Más"/"Suficiente"** y colores de cada fila de Catálogo (`ProductTable.jsx:66-109`) |
| 4 | `calcularReposicion` | `utils/reposicion.js:46-73` (puro, sin BD, con `tests/business_logic/reposicion.test.js`, 93 líneas) | `riesgo` (`CRÍTICO` si `stock <= stockSeguridad`; `MEDIO` si `stock <= rop`; si no `BAJO`), `urgencia` (`Pide hoy`/`Esta semana`/`Puede esperar`), `cantidadBase` a pedir, `rop`, `tendencia` (7d/30d acotada 0.5–2, solo con ≥5 unidades vendidas en 30 días). | Consejero IA (`controllers/aiController.js:187-195`, `getDashboardRecommendations`), Proveedores (`controllers/suppliersController.js:139-143`, `getSupplierForecast`), Detalle de Productos (`controllers/aiController.js:406-413`, `getAnalyticalSnapshot` → `frontend/src/pages/AnalisisDetalladoPage.jsx`, también enlazado desde el botón "Por agotarse"/"Pedir Más" de `ProductTable.jsx:99,104`) |
| 5 | Nivel de Servicio Estimado | `controllers/dashboardController.js:117-134`, función `getAdvancedStats` | SQL propio: `% productos con stock_actual > (velocity_30d*lead_time + stock_seguridad)`. Sin tendencia, sin `factorIA`, sin distinguir crítico/medio. | KPI "Nivel de Servicio Estimado" del Dashboard (`nivelServicio` en la respuesta de `/api/dashboard/advanced-stats` o ruta equivalente) |
| 6 | Ventanas de velocidad/tendencia distintas | Ver tabla de la sección 1.3 | 7 consultas SQL independientes recalculan `velocity_7d`/`velocity_30d` (y a veces 60d/90d) cada una a su manera | Todas las anteriores |
| (7, fuera de alcance) | `getPromotionSuggestions` | `controllers/aiController.js:461-511` | Candidatos a promoción: `trend = v7/v30 < 0.7 && stock>10` (baja rotación), vencimiento próximo, o sobrestock (`stock>50 && v30<1`) | `frontend` de Promociones (no es "riesgo de quiebre", es lo opuesto: exceso/lentitud; se documenta para que no se confunda con las 6 anteriores, no se toca en este plan) |

**Hallazgo adicional verificado (no estaba en el encargo original):** hoy `Alert.js` tiene un **hueco real**, no solo una inconsistencia estética. Ver sección 1.2.

---

## 1. Diagnóstico verificado contra el código real

### 1.1 Confirmación de la fórmula de `utils/reposicion.js`

`calcularReposicion` (`utils/reposicion.js:46-73`) hace, en orden:

```
tendencia = clamp(0.5, 2, v7/v30)          // solo si hay ≥5 unidades vendidas en 30 días, si no = 1
stockObjetivo = v30 * tendencia * diasCobertura[claseABC] + stockSeguridad   // diasCobertura: A=15, B=30, C=45
cantidadBase = max(0, ceil(stockObjetivo - stock))
rop = ceil((v30 * leadTime + stockSeguridad) * factorIA)
riesgo = stock <= stockSeguridad ? 'CRÍTICO' : (stock <= rop ? 'MEDIO' : 'BAJO')
diasParaAgotar = v30 > 0.01 ? floor(stock / v30) : null
urgencia = 'Pide hoy' si (stock<=0) o (sin ventas Y riesgo CRÍTICO) o (diasParaAgotar <= leadTime)
         = 'Esta semana' si diasParaAgotar <= leadTime + 7   // ojo: +7 fijo, no usa frecuencia_compra_dias
         = 'Puede esperar' en otro caso
```

Es el motor **más completo y más nuevo** (tiene ABC, tendencia, `factorIA` de aprendizaje vía `Feedback_IA`, y ya corrige el caso "producto sin ventas pero bajo el mínimo" — commit `a288976`). Confirmado como candidato natural a única fuente de verdad, tal como lo planteaba el encargo.

### 1.2 Hallazgo crítico: `Alert.js` puede **no generar ninguna alerta** para un producto agotado sin historial de ventas

`Alert.calcularDiasAgotamiento(cantidad, velocity30d)` (`models/Alert.js:196-198`) devuelve `999` cuando `velocity30d <= 0.01` (sin ventas). `determinarAlertaStock(diasAgotamiento, leadTime, freqCompra)` (`models/Alert.js:200-204`) solo dispara si `diasAgotamiento <= leadTime` o `<= leadTime + freqCompra`. Con `diasAgotamiento = 999` y valores típicos (`leadTime=3`, `freqCompra=7`), **nunca se cumple ninguna condición**, así que un producto con `cantidad = 0` y **sin ventas registradas** (ej. un producto nuevo, o de rotación tan baja que nunca vendió) **no genera ninguna fila en `Alertas`**: no aparece en Monitor Alertas, no suma a `alertasCriticas` del Dashboard, no dispara la campanita.

En cambio, ese mismo producto:
- En `ProductTable.jsx` sí se ve "Agotado" (`cantidad(0) <= stock_minimo` es trivialmente cierto).
- En el Consejero IA / Detalle de Productos, `calcularReposicion` sí marca `riesgo: 'CRÍTICO'` y `urgencia: 'Pide hoy'` (la rama `stock <= 0` de la línea 68 de `utils/reposicion.js` está pensada exactamente para esto).

Es decir: hoy mismo, para el mismo producto en la misma tienda, **Catálogo y el Consejero dicen "hay un problema urgente" y Monitor Alertas/campanita/Dashboard dicen "todo bien"**. Esto es más grave que una diferencia de umbral: es un falso negativo de notificación. Refuerza que la unificación de `Alert.js` no es solo estética, sino que corrige un bug de negocio real.

### 1.3 Ventanas de tendencia/velocidad: confirmadas 7 consultas SQL independientes

| Consumidor | v7 | v30 | v60/v90 | Otros |
|---|---|---|---|---|
| `models/Alert.js:49-50` (`generate`) | ✅ | ✅ | — | — |
| `controllers/aiController.js:104-134` (`getDashboardRecommendations`) | ✅ | ✅ | ✅/✅ | `qty_30d_total` para el umbral de confianza de tendencia (`ventas30Total`) |
| `controllers/aiController.js:361-372` (`getAnalyticalSnapshot`) | ✅ | ✅ | — | Ya corregido en el commit `80d6131` (antes sumaba TODO el historial en vez de 30 días; también corrigió `days_to_exhaust` llegando como `999999` crudo en vez de "Estable") |
| `controllers/suppliersController.js:94-102` (`getSupplierForecast`) | ✅ | ✅ | — | `factor_ia` desde `Feedback_IA` (últimas 5 evaluaciones) |
| `controllers/dashboardController.js:122` (`getAdvancedStats`) | — | ✅ | — | Sin v7, no puede calcular tendencia |
| `models/Product.js:8-16` (`findByStore`, alimenta `GET /api/productos`) | — | ✅ (`velocity`) | — | Es el campo que llega al frontend como `p.velocity` |
| `controllers/aiController.js:461-482` (`getPromotionSuggestions`, fuera de alcance) | ✅ | ✅ | — | — |

El bug real de esta sesión (`getAnalyticalSnapshot` sumando todo el historial) ya quedó corregido y con capturas de verificación en `docs/planes/img/analisis-*.jpg` (ver commit `80d6131`). Sigue habiendo **7 copias de la misma consulta SQL** con pequeñas variaciones; no es solo redundancia de fórmula sino redundancia de SQL, lo que fue justamente la causa raíz del bug ya corregido — cualquier consulta nueva que se agregue "a mano" corre el mismo riesgo.

### 1.4 Por qué `Alert.js` no se puede reemplazar 1:1 por `utils/reposicion.js`

`Alert.generate` (`models/Alert.js:8-113`) hace 4 cosas que no tienen relación con "¿hay riesgo de quiebre de stock?" y **no deben tocarse**:
- Marca como resueltas todas las alertas vigentes y regenera (ciclo de vida en `Alertas.resuelta`/`fecha_resolucion`).
- Calcula y persiste `clasificacion_abc` en `Productos` (con SQL de ventanas, `Alert.js:14-40`) — dato que además ya reutilizan `aiController` y `suppliersController` vía `p.clasificacion_abc`.
- `determinarAlertaVencimiento` (`Alert.js:206-213`, tipos `vencimiento_critico`/`vencimiento_proximo`) — vencimiento de producto, no relacionado con stock.
- `determinarSobrestock` (`Alert.js:215-217`, tipo `sobrestock`, severidad `info`) — "capital atrapado" (demasiado stock), lo opuesto de un problema de quiebre; `utils/reposicion.js` no calcula esto en absoluto.

Solo `determinarAlertaStock` (las líneas 200-204, invocadas en la línea 81) es candidata a unificarse. Confirma el criterio "quirúrgico" que pedía el encargo.

### 1.5 Riesgo de cambiar `ProductTable.jsx`

`calcNivelStock` de `ProductTable.jsx` (líneas 26-30) es la única de las 6 fórmulas que **no usa velocidad de venta en absoluto**, solo `stock_minimo` (campo editable por el administrador al crear/editar el producto, con default `5` en `database/init_pg.sql:85`). Si se reemplaza por algo basado en `utils/reposicion.js` (que usa `stock_seguridad`/`lead_time`/velocidad), el criterio de "Agotado"/"Por agotarse"/"Pedir Más" deja de depender de un número que el administrador fija a mano y empieza a depender de datos que hoy en algunos productos pueden estar en su valor por defecto (`stock_seguridad = 0`, `lead_time = 3`) sin que el administrador los haya revisado nunca. Esto puede **hacer que productos que hoy se ven "Suficiente" pasen a verse "Pedir Más"** simplemente porque nadie configuró `stock_seguridad`. Es el cambio de UX visible más delicado de todo el plan — necesita datos reales de la tienda de prueba antes de decidir.

---

## 2. Estrategia de unificación por fases

Principio general: **mover el cálculo al backend y dejar que el frontend solo pinte lo que el backend ya decidió**, en vez de intentar compartir código JS entre `utils/reposicion.js` (CommonJS, backend) y React/Vite (frontend), lo que requeriría reconfigurar el bundler para importar fuera de `frontend/src`. Esto también resuelve de una vez el problema de fondo: hoy `GET /api/productos` (`models/Product.js:5-22`) ya trae `velocity`, y el registro completo de `Productos` ya trae `stock_seguridad`, `lead_time` y `clasificacion_abc` (persistida por `Alert.generate`); solo falta que el backend haga la cuenta una vez y el frontend dejo de recalcular.

### Fase 1 — Preparación: extender `utils/reposicion.js` sin tocar ningún consumidor existente

**Qué cambia:** agregar a `utils/reposicion.js` una función pura nueva, p. ej. `clasificarNivelStock({ stock, stockSeguridad, rop })` que devuelva una etiqueta de 3 estados (`'agotado' | 'critico' | 'bajo' | 'ok'`, a definir con el dueño del producto en la pregunta abierta 1) reutilizando exactamente el mismo `riesgo` que ya calcula `calcularReposicion`. No se cambia la firma de `calcularReposicion` ni el `riesgo`/`urgencia` que ya usan el Consejero, Proveedores y Detalle de Productos.

**Archivos que toca:** `utils/reposicion.js`, `tests/business_logic/reposicion.test.js` (casos nuevos).

**Cómo se prueba:** solo pruebas unitarias nuevas en Vitest; cero superficie de UI tocada, cero riesgo de romper algo visible.

**Criterio de "listo":** `npm test` en verde, cobertura de los casos límite de la sección 3 (stock=0 sin ventas, `stockSeguridad=0` por defecto, producto sin `lead_time` configurado).

### Fase 2 — `GET /api/productos` expone el nivel de stock ya calculado (bajo una bandera nueva, sin quitar nada)

**Qué cambia:** `models/Product.js` (`findByStore`) agrega a la consulta las columnas que le faltan (`stock_seguridad`, `lead_time`, `clasificacion_abc`, ya están en `Productos`, solo hay que seleccionarlas — `SELECT p.*` ya las trae, revisar que no se pierdan al mapear) y, en el controlador (`controllers/productController.js`, la ruta que devuelve `GET /api/productos`), se le añade a cada fila un campo nuevo, por ejemplo `nivel_stock` y `urgencia`, calculado con la función de la Fase 1. **Los campos viejos (`cantidad`, `stock_minimo`, etc.) no se quitan.**

**Archivos que toca:** `models/Product.js`, el controlador que sirve `GET /api/productos` (verificar nombre exacto — hoy la ruta vive fuera de `productController.js` según lo revisado; localizar el handler real de `router.get('/')` en `routes/productRoutes.js` antes de escribir código).

**Cómo se prueba:**
- Unitaria: ninguna nueva de peso (es una consulta + una llamada a función ya probada en Fase 1).
- Manual (Playwright, tienda de prueba): pedir `GET /api/productos` y confirmar que la respuesta trae el campo nuevo con el valor esperado para 2-3 productos conocidos (uno "Agotado", uno "Pedir Más", uno "Suficiente" según hoy), sin tocar nada del frontend todavía.

**Criterio de "listo":** el campo nuevo llega correcto y el resto de la respuesta es idéntico byte a byte a como era antes (diff de la respuesta JSON antes/después salvo el campo agregado).

### Fase 3 — Migrar `ProductTable.jsx` y el hook de ordenamiento a leer el campo del backend (cambio de UX visible)

**Qué cambia:** `ProductTable.jsx` deja de calcular `calcNivelStock` localmente y usa `p.nivel_stock`/`p.urgencia` del backend; `useProductosPage.js` hace lo mismo para ordenar `listRender`. Aquí es donde se decide (pregunta abierta 1) si el nuevo criterio puede mover productos entre categorías respecto a hoy.

**Archivos que toca:** `frontend/src/components/productos/ProductTable.jsx` (líneas 26-30 y 66-109), `frontend/src/hooks/useProductosPage.js` (líneas 147-159 y 354-367).

**Cómo se prueba:**
- Unitaria: si existe (o se crea) un test de componente para `ProductTable`, actualizarlo; si no existe, no es bloqueante (hoy no hay tests de componentes React en el repo, según lo revisado — la cobertura está en `tests/business_logic/*.test.js`, backend puro).
- Manual (Playwright, sesión admin, tienda de prueba, **sin tocar la BD a mano**): abrir Catálogo antes y después del cambio, capturar qué productos dicen "Agotado"/"Por agotarse"/"Pedir Más"/"Suficiente" en ambos casos y comparar la lista completa, no solo 2-3 productos. Prestar atención especial a productos con `stock_seguridad = 0` (default), que son los que más probablemente cambien de categoría.

**Criterio de "listo":** el usuario (dueño del producto) revisó la comparación antes/después y aprobó los cambios de categoría, o se ajustaron los umbrales para que coincidan con lo esperado.

### Fase 4 — Unificar `determinarAlertaStock` en `Alert.js` (mayor cuidado: cambia notificaciones)

**Qué cambia:** reemplazar la llamada de `models/Alert.js:81` (`Alert.determinarAlertaStock(diasAgotamiento, leadTime, freqCompra)`) por una que use el `riesgo`/`urgencia` de `calcularReposicion` (o la función de clasificación de la Fase 1), manteniendo intactas las reglas de vencimiento (`determinarAlertaVencimiento`) y sobrestock (`determinarSobrestock`) tal cual están. Esto corrige de paso el hueco descrito en la sección 1.2 (producto agotado sin ventas que hoy no genera alerta).

Como `Alert.generate` ya calcula `v30`/`v7` por su cuenta (`models/Alert.js:49-50`) y ya tiene `clasificacion_abc` recién actualizada en el mismo método, alimentar `calcularReposicion` ahí es directo — no hace falta traer datos nuevos.

**Archivos que toca:** `models/Alert.js` (líneas 62-108, específicamente 80-86), `tests/business_logic/inventory_math.test.js` (ya cubre `determinarAlertaStock` con 4 casos — líneas 123-142 — hay que decidir si se conservan como snapshot del comportamiento viejo o se actualizan al nuevo).

**Cómo se prueba:**
- Unitaria: adaptar/reemplazar los 4 casos de `inventory_math.test.js` (líneas 123-142: "genera stock_critico si se agota antes que el proveedor", "genera stock_bajo en ventana de reorden", "no genera alerta con stock suficiente", "crítico cuando agotamiento = lead time exacto") para reflejar la fórmula nueva, más un caso nuevo explícito para el hueco de la sección 1.2 (producto con `cantidad=0` y `velocity30d=0` **debe** generar `stock_critico`).
- Manual (Playwright, tienda de prueba, cuenta admin y cuenta tendero para ver la campanita de ambos roles): forzar una venta que reduzca el stock de un producto de prueba por debajo del nuevo umbral, disparar `Alert.generate` (vía venta real o `POST /api/alertas/generate` desde `AlertasPage.jsx`), y verificar en Monitor Alertas + campanita + Dashboard que aparece/desaparece exactamente lo esperado. Repetir con un producto sin ventas y stock en 0 para confirmar que ahora sí genera alerta.

**Criterio de "listo":** el conteo de alertas activas antes/después se revisó a mano para la tienda de prueba completa (no solo los productos de prueba), y el dueño del producto aprobó explícitamente cualquier alerta que aparezca o desaparezca respecto a hoy (pregunta abierta 2).

### Fase 5 — `getAdvancedStats` (Nivel de Servicio Estimado) usa el mismo criterio

**Qué cambia:** `controllers/dashboardController.js:117-134` deja de tener su propio SQL de "saludable" y, o bien reutiliza la misma clasificación (trayendo `v7`/`stock_seguridad`/`lead_time`/ABC por fila y aplicando `calcularReposicion` en Node en vez de en SQL), o bien se documenta explícitamente que esta métrica es una **aproximación agregada** (KPI de una sola cifra, no por producto) y se deja como está pero con el mismo `rop` que usa `calcularReposicion` (con `factorIA` y tendencia, si se quiere fidelidad total) en vez de un ROP simplificado sin tendencia.

**Archivos que toca:** `controllers/dashboardController.js` (líneas 117-134), `tests/business_logic/dashboard_analytics.test.js` (ya cubre "Nivel de Servicio Estimado" con 4 casos, líneas 68-93 — hay que decidir si migran a Vitest sobre la función pura extraída o se quedan como test de la fórmula SQL-equivalente).

**Cómo se prueba:**
- Unitaria: actualizar los 4 casos de `dashboard_analytics.test.js` si la fórmula cambia (100% saludable, 0%, 50%, "sin catálogo → 100%").
- Manual (Playwright, tienda de prueba): comparar el porcentaje de "Nivel de Servicio Estimado" antes/después con los mismos datos, y contrastarlo contra el conteo real de `alertasCriticas`/`alertasAdvertencia` del mismo Dashboard — hoy pueden decir cosas contradictorias (ej. "95% de servicio" y "3 alertas críticas" a la vez) porque usan criterios distintos; después de esta fase deberían ser consistentes entre sí.

**Criterio de "listo":** el % de servicio y el conteo de alertas del mismo Dashboard, para la misma tienda al mismo tiempo, cuentan una historia coherente (uno no dice "todo bien" mientras el otro dice "3 críticos").

### Fase 6 — Limpieza y consolidación de las consultas de velocidad (opcional, baja prioridad)

**Qué cambia:** una vez que los 4 consumidores de "riesgo de stock" (Alert, ProductTable, hook de ordenamiento, getAdvancedStats) ya pasan por el mismo cálculo, evaluar si vale la pena extraer las 7 consultas SQL de velocidad (sección 1.3) a una única vista de Postgres o función SQL reutilizable, para que un futuro bug como el de `getAnalyticalSnapshot` (sumar todo el historial) no se pueda repetir en un octavo lugar. Esto es una mejora de mantenibilidad, no de comportamiento — se incluye aquí porque el encargo lo menciona explícitamente, pero no es indispensable para cerrar el problema de negocio.

**Archivos que toca (si se decide hacer):** `database/init_pg.sql`, `config/database.js` (auto-migración), y cada uno de los 7 consumidores listados en la sección 1.3.

**Criterio de "listo":** todas las pantallas siguen mostrando los mismos números que al final de la Fase 5, con una sola definición de "velocidad de 30 días" en el esquema en vez de 7 copias en código de aplicación.

---

## 3. Preguntas abiertas para el usuario

> **Resueltas.** El usuario respondió las 6 preguntas el 2026-09-24 — ver sección 8 para las decisiones finales y la sección 8.7 para las fases ya actualizadas con ellas. Esta sección 3 se conserva tal cual para el historial (así se ve qué se preguntó exactamente).

1. **¿Cuántos niveles debe tener la etiqueta unificada de Catálogo?** Hoy `ProductTable.jsx` distingue 4 estados visuales ("Agotado" cuando `cantidad=0`, "Por agotarse", "Pedir Más", "Suficiente" — el primero y el segundo comparten el mismo `nivelStock='critico'` pero cambian el texto según `cantidad===0`). `calcularReposicion` solo tiene 3 (`CRÍTICO`/`MEDIO`/`BAJO`). ¿Se conserva la distinción "Agotado" (stock=0) vs "Por agotarse" (crítico pero >0) como una regla adicional sobre el `riesgo` de `utils/reposicion.js`, o se simplifica a 3 estados?
2. **Cuando dos fórmulas den umbrales distintos hoy para el mismo producto, ¿cuál "gana" al unificar?** En concreto: la ventana `stock_bajo` de `Alert.js` hoy es `lead_time + frecuencia_compra_dias` (variable por producto), mientras que la urgencia "Esta semana" de `utils/reposicion.js` usa `lead_time + 7` (fijo). Para productos con `frecuencia_compra_dias` distinto de 7 (el default), estas dos reglas van a divergir. ¿Se parametriza `calcularReposicion`/su urgencia para aceptar `frecuencia_compra_dias`, o se acepta el default de 7 para todos y se homogeniza el dato en `Productos`?
3. **¿Se deben re-generar/recalcular las alertas históricas ya resueltas, o solo las nuevas?** Al cambiar `determinarAlertaStock` en la Fase 4, las alertas ya marcadas `resuelta=1` con la fórmula vieja quedan en la tabla `Alertas` con `datos_json` que refleja el cálculo anterior. ¿Se dejan como registro histórico intacto (recomendado, no se toca nada retroactivo) o se necesita un script de recálculo?
4. **`stock_minimo` (campo manual del administrador) — ¿sigue existiendo un uso después de unificar `ProductTable.jsx`?** Hoy es la única entrada del administrador para el umbral de Catálogo. Si se reemplaza por `calcularReposicion` (que no usa `stock_minimo` en absoluto, usa `stock_seguridad`+`lead_time`+velocidad), ¿el campo `stock_minimo` se deja de usar del todo, se recicla como sinónimo/valor inicial de `stock_seguridad` para productos que nunca configuraron este último, o se conserva como un piso adicional (`umbralBajo = max(rop, stock_minimo)`, como ya hace el hook de ordenamiento hoy)?
5. **Para el "Nivel de Servicio Estimado" del Dashboard (Fase 5), ¿es aceptable que se vuelva más estricto?** Al día de hoy no usa tendencia ni `factorIA`; si se une al motor completo, algunos productos que hoy cuentan como "saludables" podrían dejar de estarlo (p. ej., productos con tendencia alcista). ¿Se prioriza fidelidad total con el resto del sistema, o se prefiere mantener esta métrica deliberadamente más optimista por ser un KPI de alto nivel?
6. **Alcance de `getPromotionSuggestions` (fórmula 7, hoy fuera de este plan):** ¿confirma el usuario que "candidatos a promoción" (baja rotación/sobrestock/vencimiento próximo) debe seguir siendo una lógica separada de "riesgo de quiebre", o también debería alimentarse del mismo dato de tendencia unificado en una fase futura?

---

## 4. Plan de pruebas (resumen)

**Unitarias nuevas en `tests/business_logic/`:**
- Fase 1: casos de la función de clasificación nueva en `reposicion.test.js` — cubrir explícitamente el caso "sin ventas y stock en 0" (el hallazgo de la sección 1.2).
- Fase 4: actualizar los 4 casos existentes de "Alertas de Stock Logístico" en `inventory_math.test.js` (líneas 123-142) + 1 caso nuevo para el hueco corregido.
- Fase 5: actualizar los 4 casos de "Nivel de Servicio Estimado" en `dashboard_analytics.test.js` (líneas 68-93) si la fórmula deja de ser SQL puro.

**Verificación manual con datos reales (Playwright + tienda de prueba, sin tocar la BD a mano), por fase:**
- Fase 2: comparar respuesta JSON de `GET /api/productos` campo por campo (antes/después, salvo el campo nuevo).
- Fase 3: captura de Catálogo completo (todas las filas, no solo 2-3 productos) antes/después, revisada por el dueño del producto.
- Fase 4: forzar venta real que cruce el nuevo umbral en un producto de prueba; verificar Monitor Alertas, campanita (roles admin y tendero) y contador del Dashboard; caso especial de producto sin ventas y stock 0.
- Fase 5: comparar el % de "Nivel de Servicio Estimado" contra el conteo de `alertasCriticas`/`alertasAdvertencia` del mismo Dashboard para que no se contradigan.

---

## 5. Checklist final de "no se rompió nada" (repetir después de cada fase)

- [ ] **Dashboard** (`frontend/src/pages/DashboardPage.jsx`): el banner de bienvenida, la tarjeta de alertas y el KPI "Nivel de Servicio Estimado" muestran números consistentes entre sí para la tienda de prueba.
- [ ] **Catálogo** (`frontend/src/pages/ProductosPage.jsx` + `ProductTable.jsx`): las etiquetas "Agotado"/"Por agotarse"/"Pedir Más"/"Suficiente" de cada fila, el aviso superior y el orden de la lista coinciden entre sí (mismo criterio) y con lo que espera el dueño del producto.
- [ ] **Monitor Alertas** (`frontend/src/pages/AlertasPage.jsx`): el conteo y contenido de alertas activas (`critico`/`advertencia`/`info`) es el esperado tras forzar `Alert.generate` manualmente.
- [ ] **Campanita de notificaciones** (`NotificationCenter.jsx`): el indicador de "urgente" y el listado de alertas recientes coinciden con Monitor Alertas, para cuenta admin y cuenta tendero.
- [ ] **Detalle de Productos** (`AnalisisDetalladoPage.jsx`): `risk`/`urgencia`/`cantidad_recomendada` de un producto de prueba no cambiaron (esta pantalla ya usa `utils/reposicion.js` desde antes de este plan; solo debe verse afectada si se cambia la firma o el comportamiento de `calcularReposicion` mismo, lo cual este plan evita).
- [ ] **Proveedores** (forecast por proveedor): `nivel_riesgo`/`urgencia`/`cantidad_sugerida` de un producto de prueba conocido no cambiaron por las fases 1-5 (mismo motivo que el punto anterior).
- [ ] `npm test` (Vitest) en verde, incluyendo los archivos tocados en cada fase.

---

## 6. Estimación de esfuerzo relativo por fase

| Fase | Complejidad | Motivo |
|---|---|---|
| 1. Extender `utils/reposicion.js` | **Baja** | Función pura nueva + tests; cero superficie de UI o BD |
| 2. `GET /api/productos` expone el nivel calculado | **Baja-Media** | Requiere ubicar el handler real de la ruta (no confirmado en esta exploración que sea `productController.js`) y verificar que no se rompa el contrato JSON existente |
| 3. Migrar `ProductTable.jsx` + hook de ordenamiento | **Media** | Cambio de UX visible; la parte cara es la verificación manual exhaustiva (todas las filas de Catálogo), no el código |
| 4. Unificar `Alert.js` (`determinarAlertaStock`) | **Media-Alta** | Cambia notificaciones reales a usuarios; requiere decisión de negocio (pregunta 2) antes de escribir código, y verificación en vivo con ventas reales |
| 5. `getAdvancedStats` (Nivel de Servicio) | **Media** | Cambiar de SQL agregado a cálculo por fila en Node tiene un costo de rendimiento a evaluar si el catálogo es grande; la lógica en sí es sencilla |
| 6. Consolidar las 7 consultas de velocidad | **Alta (opcional)** | Toca 7 archivos y potencialmente el esquema (vista SQL); alto riesgo de introducir de nuevo el tipo de bug que ya se corrigió si no se hace con cuidado; no bloquea el resto del plan |

**Orden recomendado:** 1 → 2 → 3 → 4 → 5, dejando 6 como mejora técnica separada y opcional, a decidir después de ver el impacto real de las fases 1-5 en la tienda de prueba.

---

## 7. Segunda revisión (2026-09-24): errores encontrados en la v1 y correcciones aplicadas

El usuario pidió una segunda opinión sobre este plan antes de implementarlo. Cada afirmación de esa revisión se comprobó de nuevo, directamente contra el código y ejecutando `utils/reposicion.js` con los mismos números — no se tomó nada por buena fe. **Las nueve afirmaciones técnicas (E1-E4, O2-O5) se confirmaron exactas al 100 %.** Esta sección reemplaza las partes de la v1 que quedaron mal.

### 7.1 E1 — Bug activo, ya en producción (el más urgente de todo el plan)

> **Corregido el 2026-09-24** (commit en `main`): `urgencia = "Pide hoy"` ahora se decide antes que nada por `stock <= 0`, fuera del `if (cantidadBase > 0)`. Test nuevo en `tests/business_logic/reposicion.test.js` que reproduce exactamente este caso (`stock: 0, stockSeguridad: 0`, sin ventas) — 156 pruebas en verde. **Lo que queda sin resolver a propósito:** con `cantidadBase` en 0, el producto sigue sin aparecer en la lista del Consejero (que filtra por `base_load > 0`) ni sugiere cuánto pedir. Cerrar eso del todo requiere el piso de reposición con `stock_minimo` que describe la corrección más abajo, y eso depende de la pregunta 4 del plan (qué rol cumple `stock_minimo` tras la unificación) — se dejó pendiente de la revisión del plan, como se pidió.

**Esto no es un defecto del plan: es un bug real en código que ya está en `main`.** La v1 (§1.2) afirmaba que `calcularReposicion` con stock 0 y sin ventas da `CRÍTICO + "Pide hoy"`. Verificado que es falso en el caso más común (`stock_seguridad = 0`, el valor por defecto del esquema):

```
calcularReposicion({ ventasDia7:0, ventasDia30:0, stock:0, stockSeguridad:0, leadTime:3, claseABC:'C' })
→ { cantidadBase: 0, riesgo: 'CRÍTICO', urgencia: 'Puede esperar' }
```

Motivo: toda la lógica de `urgencia` en `utils/reposicion.js:63-70` vive dentro de `if (cantidadBase > 0)`. Con `stockSeguridad = 0`, el "stock objetivo" también es 0, así que `cantidadBase` es 0 y el `if` nunca se ejecuta — la urgencia se queda en su valor inicial, `"Puede esperar"`. El arreglo de esta misma sesión para "Leche Alquería" (commit `a288976`) no cubre este caso porque esa prueba usa `stockSeguridad: 4` (no 0).

**Efecto real:** un producto nuevo, sin historial de ventas y sin `stock_seguridad` configurado (el caso más común para cualquier producto recién creado) se ve `CRÍTICO` pero "Puede esperar" en el Consejero y en Detalle de Productos, **y el Consejero ni lo muestra** porque filtra por `base_load > 0` (`utils/recomendacionesDashboard.js`). Es decir: el producto que más necesita atención (agotado, sin datos) es justo el que el Consejero calla.

**Corrección para `utils/reposicion.js`:**
- `stock <= 0` debe dar `"Pide hoy"` siempre, sin pasar por el `if (cantidadBase > 0)`.
- Un producto sin historial de ventas necesita un piso de reposición aunque `stockObjetivo` salga en 0; usar `max(stockSeguridad, stockMinimo) - stock` como mínimo (ver también la pregunta 4 revisada, sección 7.5).

**Esto cambia lo que ya muestran el Consejero y Proveedores para este caso específico** (hoy: nada; después: aparecería). Hay que declararlo así en el checklist de la Fase 1 y probarlo con un producto real de la tienda de prueba en ese estado exacto (`stock_seguridad` en 0, sin ventas, stock 0), antes de dar la fase por lista.

### 7.2 E2 — El Consejero y Proveedores pueden pedir cantidades muy distintas del mismo producto, hoy mismo

La v1 (§1.4) decía que ambos reutilizan `Productos.clasificacion_abc` persistida. Verificado que **ninguno la lee**: cada uno recalcula el ABC con su propia consulta SQL, y la de `suppliersController.getSupplierForecast` (`suppliersController.js:91-133`) lo hace **solo entre los productos de ese proveedor** (`WHERE p.id_proveedor = ?`), mientras que `aiController` (Consejero y Detalle) lo hace con **toda la tienda**. Reproducido con los números exactos de la revisión (`v=2/día`, `stock=10`, `seguridad=4`, `leadTime=3`):

```
claseABC='A' (15 días de cobertura) → cantidadBase = 24
claseABC='C' (45 días de cobertura) → cantidadBase = 84
```

Un mismo producto puede clasificar A en el Consejero (top ventas de toda la tienda) y C en Proveedores (poco relevante dentro de ese proveedor en particular), y la cantidad a pedir sale 3,5 veces distinta. La promesa central de este plan y del plan 13 ("la misma cantidad en toda la app") **no se cumple hoy** para tiendas con más de un proveedor.

**Corrección:** el ABC es una entrada del motor, no un detalle de cada pantalla. Definir una sola fuente — la columna `Productos.clasificacion_abc` que ya persiste `Alert.generate` sobre toda la tienda — y que los tres controladores la lean en vez de recalcularla cada uno a su manera.

### 7.3 E3 — El factor de aprendizaje de la IA solo llega al motor desde una pantalla

Verificado: `suppliersController.getSupplierForecast` pasa `factorIA: item.factor_ia` (promedio de las últimas 5 evaluaciones de `Feedback_IA`) a `calcularReposicion`. **`aiController.getDashboardRecommendations` no pasa `factorIA` en ningún punto de su llamada** (`aiController.js:187-195` — se confirmó con `grep -n "factorIA" controllers/aiController.js`, cero resultados), así que el Consejero y Detalle de Productos siempre usan el valor por defecto (`1`, sin ajuste), aunque el Consejero sí calcula por su cuenta un `avg_precision` (con otra definición: promedio de *todo* el historial, no las últimas 5) que usa solo para mostrar el "% de confianza" en la tarjeta, nunca para el cálculo del ROP.

**Corrección:** decidir si el factor de aprendizaje debe aplicar en todas las pantallas o en ninguna, usar una sola definición (últimas 5 evaluaciones, como ya hace Proveedores), y pasarlo también en el Consejero. `Alert.generate` necesitaría este dato nuevo si también se unifica en la Fase 4.

### 7.4 E4 — La Fase 5 original apuntaba a una pantalla que no existe

Verificado con `grep` en todo `frontend/src`: nada llama a `/api/dashboard/stats/advanced` ni usa `nivelServicio`. Solo `/api/dashboard/stats` (la ruta básica, distinta) tiene consumidores reales (`Sidebar.jsx`, `AnalyticsDashboardPage.jsx`, `DashboardPage.jsx`). El "Nivel de Servicio Estimado" que describía la Fase 5 de la v1 es una respuesta de API sin nada en pantalla que la muestre.

**Corrección:** la Fase 5 cambia de "unificar la fórmula" a "decidir si se conecta a alguna pantalla o se elimina" (ver sección 7.6, Fase 5 revisada). De paso se confirmó lo mismo para dos endpoints más (`GET /api/ia/alerts` y `Product.findBelowMinStock`, sección 7.5, pregunta 6 / hallazgo adicional) — código sin ningún punto de entrada en el frontend, candidato a eliminar en vez de unificar.

### 7.5 Hallazgos adicionales verificados (no estaban en la v1)

- **O2 — Las alertas de `Alert.js` solo se recalculan tras una venta.** Confirmado por `grep`: `Alert.generate` solo se llama desde `saleController.js:166,286` (fire-and-forget, sin `await`) y manualmente desde `AlertasPage.jsx`. **No se llama** desde `suppliersController.js` (ni siquiera desde el `completarRecepcion` de la Fase E de esta misma sesión — un producto que se recibe hoy no actualiza sus alertas hasta la próxima venta), ni desde `productController.js` (crear/editar producto, agregar stock), ni desde ningún endpoint de `inventoryController.js`. Si se unifica la Fase 4 sin corregir esto, Catálogo (en vivo) y Monitor Alertas/campanita (solo tras venta) van a seguir diciendo cosas distintas después de recibir mercancía.
- **O3 — `Alert.generate` no es atómico.** Confirmado por lectura: no usa transacción ni bloqueo (`models/Alert.js:8-13`); resuelve *todas* las alertas activas de la tienda y las vuelve a insertar en cada llamada. Dos ventas casi simultáneas (común en el POS) pueden pisarse: alertas duplicadas, `fecha_creacion` reiniciada, conteos inflados. No se reprodujo la condición de carrera en vivo (haría falta forzar dos ventas al mismo milisegundo), pero el patrón de código (sin `pg_advisory_xact_lock`, sin *upsert*) es exactamente el que en esta sesión motivó usar ese candado en los endpoints nuevos de `ordenBorradorController.js`.
- **O4 — "Productos Agotados" del Dashboard mezcla vencimiento con quiebre de stock, y cuenta alertas, no productos.** Confirmado: `Alert.getStats` (`models/Alert.js:157-164`) agrupa `COUNT(*)` por `severidad`, sin distinguir `tipo` ni usar `DISTINCT id_producto`. Ese número alimenta literalmente el texto `"{N} Productos Agotados"` / `"Requieren reabastecimiento urgente"` en `DashboardPage.jsx:536`. Un producto a punto de vencer (no de agotarse) hoy suma a esa cifra y su nombre aparece bajo un texto que no le corresponde. Esto es un bug de redacción/datos independiente de la unificación, ya activo en producción.
- **O5 — Código muerto y valores por defecto que no coinciden.** Confirmado: `Product.findBelowMinStock` (`models/Product.js:137`) no tiene ningún llamador en todo el repositorio. `Product.findProAlerts`, en cambio, sí se usa (`aiController.js:692`, ruta `GET /api/ia/alerts`), pero **sin consumidor en el frontend** (verificado por `grep`), así que hoy no le llega a nadie. El endpoint de sugerencias de IA para el formulario de producto (`aiController.js:818-870`, `suggestStockAlerts`) sugiere `stock_seguridad: 2` como valor por defecto cuando no hay historial, mientras que el esquema (`database/init_pg.sql`) usa `0`. Y `clasificacion_abc` tiene el default `'C'` en el esquema (`init_pg.sql:97`) contra `'A'` cuando toda la tienda no ha vendido nada (`Alert.js:32`, el caso `totalRevenue = 0`).

### 7.6 Fases revisadas

Se ajustan las fases 0-5 de la sección 2 así (los números de fase se mantienen; donde se agrega una fase nueva se marca):

- **Fase 0 (nueva, antes de la Fase 1):** resolver las preguntas 1, 2 y 4 (revisadas en 7.7) y construir una sola función `leerEntradasMotor(tiendaId, filtro)` — una consulta con `v7`, `v30`, `qty30`, ABC de toda la tienda y el factor de aprendizaje (últimas 5 evaluaciones) — que use el Consejero, Detalle de Productos y Proveedores. Esto corrige E2 y E3 antes de tocar ninguna pantalla.
- **Fase 1:** además de lo ya descrito, corrige E1 (`stock <= 0` → siempre "Pide hoy"; piso de reposición para productos sin historial) y define el nivel de Catálogo con una **matriz explícita** en vez de derivarlo solo de `riesgo`: **agotado** = `stock <= 0`; **crítico** = `urgencia === "Pide hoy"`; **bajo** = días para agotarse ≤ `lead_time + frecuencia_compra_dias`, o `stock <= max(rop, stock_minimo)`; **ok** = el resto. (Motivo: `riesgo` depende solo del stock, `urgencia`/`Alert.js` dependen del tiempo; con `stock_seguridad = 0` — el caso más común — divergen todo el tiempo. Basar el nivel únicamente en `riesgo` haría que la Fase 4 le quitara al usuario la mayoría de las alertas `stock_bajo` que ve hoy.) Tests con `stockSeguridad: 0` en todos los casos límite, no solo con valores ya "configurados".
- **Fase 2:** sin cambios de fondo, salvo que ya no hay que "verificar el nombre exacto del handler" — confirmado que es `ProductController.getProducts` (`productRoutes.js:47`). Hay que sumarle `v7` a la consulta (hoy `findByStore` solo trae `v30`) para que la matriz de la Fase 1 se pueda calcular completa.
- **Fase 2b (nueva):** diagnóstico de datos antes de tocar Catálogo — cuántos productos de la tienda de prueba (y, cuando aplique, de tiendas reales) tienen `stock_seguridad = 0` o `lead_time`/`frecuencia_compra_dias` en su valor por defecto, para anticipar cuántas etiquetas van a cambiar en la Fase 3.
- **Fase 3:** sin cambios de fondo, más O7: actualizar el tooltip de `stock_seguridad` en `ProductFormModal.jsx:631` (hoy promete algo que ninguna regla cumplía) y la columna "Alerta Mínima" del reporte Excel (`reportController.js:183`) para que reflejen la matriz final.
- **Fase 4:** se reordena en cuatro pasos internos, del más seguro al más delicado: **(a)** modo *dry-run* — calcular las alertas nuevas sin insertarlas y comparar contra las activas de hoy, para toda la tienda de prueba, en vez de revisar a mano; **(b)** envolver `Alert.generate` en una transacción con `pg_advisory_xact_lock(id_tienda)` y pasar de "resolver todo y reinsertar todo" a un *upsert* (corrige O3); **(c)** disparar `Alert.generate` también al recibir una orden de proveedor, al editar/crear un producto y en los movimientos manuales de inventario, no solo tras una venta (corrige O2); **(d)** `Alert.getStats` agrupado por `tipo` y con `COUNT(DISTINCT id_producto)`, y que el Dashboard y el banner de Catálogo separen alertas de stock de las de vencimiento (corrige O4).
- **Fase 5:** cambia de "unificar la fórmula de Nivel de Servicio" a **"decidir si `stats/advanced`, `GET /api/ia/alerts` y `Product.findBelowMinStock` se eliminan o se conectan a algo"** (corrige E4 y O5), ya que ninguno tiene consumidor real hoy. Si el usuario decide conservar el KPI de Nivel de Servicio, que sea "% de productos en nivel `ok`" del motor ya unificado, no una fórmula aparte.
- **Fase 6:** sin cambios (opcional, consolidar las consultas SQL de velocidad).

### 7.7 Preguntas abiertas: respuestas recomendadas (revisadas)

Las seis preguntas de la sección 3 se mantienen; esto es lo que se recomienda responder, a confirmar por el usuario antes de la Fase 0:

1. **Niveles de Catálogo:** cuatro (agotado/crítico/bajo/ok), con "agotado" (`stock <= 0`) como caso aparte porque es gratis de calcular y es el más accionable para un tendero.
2. **Ventana "Esta semana": `+7` fijo o `frecuencia_compra_dias`:** usar `frecuencia_compra_dias`. El campo ya existe, ya lo usa `Alert.js`, y su valor por defecto es 7 — así que para los productos que nunca lo configuraron el resultado no cambia respecto a hoy, y las notificaciones actuales no se alteran de golpe.
3. **Alertas históricas:** no se recalculan; se agrega un campo `motor: "v2"` en el `datos_json` de las alertas nuevas, para poder distinguir en auditoría cuáles se generaron con la fórmula unificada.
4. **`stock_minimo`:** se conserva como piso del nivel "bajo" (`max(rop, stock_minimo)`), tal como ya hace el hook de ordenamiento hoy, y sirve además de respaldo para el piso de reposición de productos sin historial (E1).
5. **Nivel de Servicio Estimado:** primero confirmar si el usuario quiere conservarlo en alguna pantalla (hoy no se muestra en ninguna, E4); si se conserva, que sea el % de productos en nivel `ok` del motor unificado, no una fórmula aparte que pueda contradecir las alertas reales.
6. **Promociones (`getPromotionSuggestions`):** se mantiene como lógica separada (no es "riesgo de quiebre", es lo opuesto), pero debería consumir las mismas entradas de velocidad de la Fase 0 en vez de tener su propia consulta SQL — evita una octava copia de la misma consulta.

### 7.8 Qué queda sin verificar

Esta revisión se hizo por lectura y ejecución aislada de funciones puras (`utils/reposicion.js`), igual que la anterior; no se reprodujo en vivo la condición de carrera de O3 (haría falta forzar dos ventas simultáneas contra la tienda de prueba), no se revisaron las páginas de autenticación ni la landing, y no se ejecutó la suite completa de Playwright de sesiones anteriores para confirmar que ninguna pantalla ya verificada (Consejero, Proveedores, Detalle de Productos) cambió de comportamiento — no debería, porque estas correcciones se proponen para la Fase 0/1, antes de que esas pantallas se vuelvan a tocar, pero queda como parte del checklist de la Fase 0 cuando se implemente.

---

## 8. Decisiones del usuario (2026-09-24) — plan final antes de implementar

El usuario respondió las 6 preguntas de la sección 3 (con los ajustes de la 7.7) de forma explícita y con detalle de implementación. Antes de dar el plan por cerrado se verificaron dos afirmaciones contra datos reales, como pidió.

### 8.0 Verificaciones previas a estas decisiones

- **`frecuencia_compra_dias` no es 7 para la mayoría de los productos.** `SELECT frecuencia_compra_dias, COUNT(*) FROM Productos GROUP BY 1` en la tienda de prueba:

  | Valor (días) | Productos |
  |---|---|
  | 2 | 1 |
  | 3 | 4 |
  | 5 | 2 |
  | 7 (default de la columna) | 8 |
  | 14 | 2 |
  | 30 | 1 |

  Solo 8 de 18 productos están en el valor por defecto. Esto confirma que la ventana **no** se queda semanal al parametrizarla (dispara la condición de la decisión 2: hay que renombrar "Esta semana"). También se confirmó que `frontend/src/components/productos/ProductFormModal.jsx` no tiene ningún campo para `frecuencia_compra_dias` — los valores no-default de la tienda de prueba vienen de `database/seed_test_data.js`, no de que alguien los haya configurado desde la interfaz. Esto no bloquea el plan, pero se anota como una limitación real: hoy nadie puede ajustar ese número desde la app (ver 8.8).
- **`stats/advanced` sigue sin ningún consumidor.** Se repitió la búsqueda en todo `frontend/src` (`grep -rn "stats/advanced|advancedStats|nivelServicio|getAdvancedStats"`): cero resultados. Confirmado otra vez, no cambió desde la v2.

### 8.1 Decisión 1 — Cuatro niveles, nombres neutros, calculados en el backend

**De acuerdo, sin reservas.** `agotado` (`stock <= 0`, sin importar ventas ni `cantidadBase`), `critico`, `reponer`, `ok`. La advertencia de no mapear el `BAJO` de `riesgo` (que en `utils/reposicion.js` significa "sano", lo opuesto de crítico) al `bajo` histórico de `ProductTable.jsx` (que hoy significa "Pedir Más") es exactamente el tipo de error que esta unificación debía evitar — gracias por marcarlo explícito, porque el nombre compartido ("bajo") es justo la clase de trampa que un merge apurado dejaría pasar. Los nombres `agotado`/`critico`/`reponer`/`ok` no chocan con ningún nombre ya usado en `riesgo` (`CRÍTICO`/`MEDIO`/`BAJO`) ni en `urgencia` (`Pide hoy`/`Esta semana`/`Puede esperar`), así que las tres capas de nomenclatura (riesgo interno, urgencia interna, nivel visible) quedan sin ambigüedad entre sí.

**Mapeo con las etiquetas visibles de hoy** (no hace falta que el texto cambie, solo qué lo decide): `agotado` → "Agotado", `critico` → "Por agotarse", `reponer` → "Pedir Más", `ok` → "Suficiente".

### 8.2 Decisión 2 — Ventana con `frecuencia_compra_dias`, revisión periódica T+L, Alert.js no cambia

**De acuerdo.** Confirmado en 8.0 que la mayoría de los productos no está en 7 días, así que aplica la cláusula condicional: **"Esta semana" se renombra a "En esta compra"** en `utils/reposicion.js` (la constante `URGENCIA.SEMANA`) y en cualquier texto de UI que la muestre (`DashboardPage.jsx`, `AnalisisDetalladoPage.jsx` — buscar todas las apariciones literales de `'Esta semana'` antes de implementar). La fórmula de `calcularReposicion` pasa de `diasParaAgotar <= leadTime + 7` a `diasParaAgotar <= leadTime + frecuenciaCompraDias` (nuevo parámetro `frecuenciaCompraDias`, con default 7 para no romper las pantallas que todavía no lo pasen explícitamente). Como `Alert.js` ya usa `lead_time + frecuencia_compra_dias` para su ventana `stock_bajo`, **no se le cambia nada** — es el motor el que se ajusta a su fórmula, tal como se pidió, y esto reduce todavía más la divergencia entre Alert.js y `calcularReposicion` que describía el hallazgo O1 (v1/v2), sin tocar Alert.js en absoluto.

### 8.3 Decisión 3 — No recalcular alertas resueltas; marca `"motor":"v2"` en las nuevas

**De acuerdo, sin cambios respecto a lo ya propuesto en 7.7.** Las alertas con `resuelta = 1` de la fórmula vieja quedan como registro histórico; las activas se regeneran solas la primera vez que corra `Alert.generate` después del cambio (ya sea por una venta o por el botón manual de Monitor Alertas). Se agrega `"motor": "v2"` al `datos_json` de cada alerta nueva para poder filtrar en auditoría cuáles se generaron con la fórmula unificada.

### 8.4 Decisión 4 — `stock_minimo` como piso solo de "reponer", nunca de "crítico" ni como sinónimo de `stock_seguridad`

**De acuerdo, y esto cierra la pieza que quedó pendiente a propósito en el arreglo de E1** (commit `c6ae00d`): ese arreglo corrigió la *urgencia* de un producto agotado, pero dejó dicho explícitamente que hacía falta esta decisión para que además le sugiera una cantidad y aparezca en el Consejero. Con esta regla: el nivel `reponer` usa `umbral = max(rop, stock_minimo)`; el nivel `critico`/`agotado` **nunca** consultan `stock_minimo` (siguen dependiendo solo de `stock_seguridad`, que es lo que ya hace `riesgo` hoy); y para un producto sin historial de ventas, el piso de `cantidadBase` pasa a ser `max(stock_seguridad, stock_minimo) - stock` en vez de depender únicamente de `stock_seguridad`. Esto es exactamente lo que necesitaba el caso "producto nuevo, agotado, sin `stock_seguridad` configurado" para que además de decir "Pide hoy" (ya corregido) también sugiera una cantidad y aparezca en la lista del Consejero (que filtra por `cantidadBase > 0`). **Pendiente para la implementación:** actualizar el tooltip de `stock_seguridad` en `ProductFormModal.jsx:631` (hoy dice "Si baja de aquí, se activa alerta roja (Agotado)", que ya no sería exacto: la alerta roja depende de `stock_seguridad` para crítico, pero la cantidad sugerida ahora también mira `stock_minimo`).

### 8.5 Decisión 5 — `stats/advanced`: eliminar (confirmado sin consumidores)

Con la verificación de 8.0 (cero referencias en `frontend/src`), aplica la rama "si no, propón eliminarlo" de la decisión. **Propuesta concreta:** quitar la ruta `GET /api/dashboard/stats/advanced` (`routes/dashboardRoutes.js`), el método `getAdvancedStats` (`controllers/dashboardController.js:117-134`) y sus 4 pruebas en `dashboard_analytics.test.js:68-93` (o migrarlas a una prueba de que la ruta ya no existe, si se prefiere dejar constancia). Esto reemplaza a la Fase 5 tal como estaba planteada — deja de ser "unificar una fórmula" y pasa a ser "borrar código sin uso", más simple y de menor riesgo que lo que decía la v1/v2. Si en el futuro se quiere un KPI de este estilo, queda documentado aquí que debe ser "% de productos con nivel `ok` del motor unificado", con el nombre **"% de productos sin necesidad de reponer"** (evita el término "servicio", que no es un concepto que el resto de la app use).

### 8.6 Decisión 6 — Promociones: una exclusión ahora, unificación de lectura después

**De acuerdo.** `getPromotionSuggestions` (`controllers/aiController.js:455-511`) hoy no trae `stock_seguridad`, `lead_time` ni `frecuencia_compra_dias` en su consulta — hay que agregarlos para poder calcular el nivel de cada candidato y excluir los que salgan `agotado`, `critico` o `reponer` (línea 496-502, donde ya se arma el filtro `isLowTurnover || isNearExpiry || isOverstock`; se le suma `&& nivel === 'ok'`). No se cambia la lógica de "candidato a promoción" en sí (baja rotación, vencimiento próximo, sobrestock), solo se le agrega esta exclusión. La unificación completa de su lectura de velocidad (v7/v30 con muestra mínima, para no tener una octava consulta SQL distinta) queda para una fase futura, fuera de este plan, tal como se pidió.

### 8.7 Fases finales (reemplaza las tablas de fases de las secciones 2 y 7.6)

| Fase | Contenido final | Estado |
|---|---|---|
| **0** | `leerEntradasMotor(tiendaId, filtro)`: una sola consulta con `v7`, `v30`, `qty30`, ABC de toda la tienda y factor de aprendizaje (últimas 5 evaluaciones). La usan Consejero, Detalle de Productos y Proveedores (corrige E2 y E3). | ✅ Hecho (`utils/entradasMotor.js`) |
| **1** | `calcularReposicion` gana el parámetro `frecuenciaCompraDias` (decisión 2) y el piso de `stock_minimo` (decisión 4); `urgencia.SEMANA` se renombra a "En esta compra". Nueva función `clasificarNivel()` → `'agotado' \| 'critico' \| 'reponer' \| 'ok'` (decisión 1), sin usar `stock_minimo` en `agotado`/`critico` (decisión 4). Tests con `stockSeguridad: 0`, `stock_minimo` variado, y `frecuenciaCompraDias` distinto de 7 en todos los casos límite. | ✅ Hecho (`utils/reposicion.js`, 20 tests en `reposicion.test.js`) |
| **2** | `GET /api/productos` (`ProductController.getProducts`, confirmado) expone `nivel_stock` y `urgencia` calculados con lo de la Fase 1. Suma `v7` a la consulta de `Product.findByStore` (hoy solo trae `v30`). | ✅ Hecho |
| **2b** | Diagnóstico de datos: cuántos productos tienen `stock_seguridad = 0`, y distribución de `frecuencia_compra_dias` (ya adelantado en 8.0) y `stock_minimo`, para anticipar cuántas etiquetas cambian en la Fase 3. | ✅ Hecho (verificado contra la tienda de prueba: 6 de 18 productos cambian a `reponer`/`critico`) |
| **3** | `ProductTable.jsx` y el hook de ordenamiento leen `nivel_stock`/`urgencia` del backend en vez de recalcular. Actualiza el tooltip de `stock_seguridad` (decisión 4) y la columna "Alerta Mínima" del Excel. Verificación manual de Catálogo completo, antes/después. | ✅ Hecho, verificado con captura (`docs/planes/img/catalogo-fase3.jpg`) |
| **4** | `Alert.js`, en 4 pasos: (a) *dry-run* comparando alertas nuevas vs. activas; (b) transacción + `pg_advisory_xact_lock` + *upsert* (corrige O3); (c) disparar `Alert.generate` también al recibir mercancía, crear/editar producto y en movimientos manuales (corrige O2); (d) `Alert.getStats` por `tipo` y `COUNT(DISTINCT id_producto)`, separando alertas de stock de las de vencimiento en el Dashboard y el banner de Catálogo (corrige O4). Marca `"motor":"v2"` en las alertas nuevas (decisión 3); no se recalculan las resueltas. | ✅ Hecho — dry-run de solo lectura confirmó el único cambio esperado (Yogurt Alpina y Leche Alquería, sin ventas registradas, empiezan a generar `stock_critico`, el mismo hueco E1 ya corregido en el resto del motor); reescrito con transacción + `pg_advisory_xact_lock` + upsert (verificado con 15 corridas concurrentes sin duplicados); disparadores agregados en `createProduct`, `updateProduct`, `addStock`, las 3 rutas de `inventoryController.js` (entrada/salida/ajuste) y, tras la corrección del 2026-09-25, también en `completarRecepcion` de `suppliersController.js` (recibir orden de proveedor) — las 4 rutas que mueven stock ahora disparan el motor; `getStats` separa stock de vencimiento y cuenta por producto distinto, verificado contra los datos reales. `calcularDiasAgotamiento`/`determinarAlertaStock` se eliminaron (reemplazados por `calcularReposicion`, ya con su propia batería de tests) |
| **5** | Eliminar `stats/advanced` (decisión 5): ruta, controlador y sus tests actuales. | ✅ Hecho |
| **6** | Opcional: consolidar las 7 consultas de velocidad en una sola definición (además de darle a Promociones la exclusión de la decisión 6 como paso previo, más simple, dentro de esta misma fase o antes). | ✅ Hecho lo de bajo riesgo — `getPromotionSuggestions` ahora usa `leerEntradasMotor` en vez de su propia consulta SQL (una copia menos); de paso se eliminó código muerto encontrado en la misma revisión: `Product.findBelowMinStock` (sin ningún llamador) y `Product.findProAlerts`/`GET /api/ia/alerts` (sin consumidor en el frontend, mismo patrón que `stats/advanced`). Quedan sin tocar `Product.findByStore` (alimenta Catálogo con más columnas de las que trae `leerEntradasMotor`, no es un reemplazo limpio) y `suggestAlerts` (necesita estimar un producto que todavía no existe en la base de datos, caso que `leerEntradasMotor` no puede resolver) — ambas evaluadas y descartadas por bajo beneficio/alto costo. |

### 8.8 Notas para el usuario (no bloquean el plan, quedan para cuando se implemente)

- ~~`frecuencia_compra_dias` no se puede editar desde la interfaz hoy~~ — **resuelto**: se agregó el campo "Frecuencia de Compra" a `ProductFormModal.jsx` (sección "Configuración de Alertas y Stock Mínimo"), a pedido del usuario, junto con esta implementación.
- ~~La exclusión de Promociones (decisión 6) necesita 3 columnas nuevas en la consulta de `getPromotionSuggestions`~~ — **resuelto**, ya están agregadas y la exclusión está activa.
- **Hallazgo nuevo, no relacionado con este plan:** el campo "Código de Barras" en `ProductFormModal.jsx` es obligatorio (`required`) tanto para crear como para editar, pero los 18 productos de la tienda de prueba tienen `codigo_barras = null` (dato de seed, `database/seed_test_data.js`). Esto bloquea silenciosamente cualquier edición desde la UI de un producto sin código de barras: el navegador impide el envío del formulario y no aparece ningún mensaje de error. No se tocó en esta ronda por ser ajeno al plan 17; si en la tienda real de producción hay productos sin código de barras, tendrían el mismo problema al editarlos.

---

## 9. O8 — Red de seguridad (cierre, 2026-09-24)

El hallazgo O8 original (`docs/contexto_revision_cowork_2026-09-23.md`, sección 2.2; ese archivo ya no está en el repositorio tras la limpieza de `docs/`) proponía tres piezas para blindar `Alert.js` contra futuros cambios, ninguna implementada hasta ahora: extraer la lógica a una función pura, un modo *dry-run* reutilizable (el de la Fase 4 fue una corrida única, no una capacidad que quedó en el código) y una variable de entorno para revertir el comportamiento. Las tres quedaron construidas:

1. **Función pura `Alert.evaluarProducto(item, extra, hoy)`** (`models/Alert.js`) — recibe una fila de `leerEntradasMotor` más los datos de vencimiento/stock máximo, y devuelve el arreglo de alertas (stock, vencimiento, sobrestock) sin tocar la base de datos. Extraída literalmente de lo que antes vivía inline dentro del `for` de `generate()`; tanto `generate()` como el nuevo `dryRun()` (punto 2) llaman a esta misma función, así que no hay una segunda copia de las reglas que se pueda desincronizar de la primera. Está fuera del bloque `/* v8 ignore */` a propósito — es la primera lógica de `Alert.js` con pruebas unitarias directas (`tests/business_logic/inventory_math.test.js`, 7 casos nuevos, cubriendo el caso E1, stock_bajo, sano, vencimiento crítico/próximo, sobrestock, y la combinación de dos alertas para el mismo producto).
2. **`Alert.dryRun(tiendaId)`** — calcula qué generaría `generate()` ahora mismo y lo compara contra las alertas activas (`nuevas`, `actualizadas`, `resueltas`, `sinCambios`), sin escribir nada. Expuesto en `GET /api/alertas/dry-run` (`requireAdmin`), para poder auditar el estado o revisar el impacto de un cambio futuro al motor sin necesitar un script de un solo uso como el de la Fase 4.
3. **`DISABLE_ALERT_ENGINE`** (variable de entorno, documentada en `.env.example`) — si se pone en `"true"`, `generate()` no hace nada (log de advertencia, retorna 0), tanto para los disparadores automáticos como para el botón manual. **Desviación deliberada de la redacción original ("volver atrás"):** no reactiva la lógica vieja de `determinarAlertaStock`/`calcularDiasAgotamiento` — esa tenía el hueco E1 y ya se eliminó del código; reintroducirla para un "rollback" habría revivido a propósito un bug ya corregido. En su lugar es un interruptor de emergencia: apaga el motor por completo si se detecta un problema en producción, sin necesidad de desplegar código nuevo, mientras se investiga.

**Estado de las pruebas tras este cambio:** 149/149 (antes 142), con `models/Alert.js` en 100% de sentencias y líneas dentro del alcance de cobertura del proyecto (ver `vitest.config.js`).

---

#### Actualización del 9-oct-2026: la regla de conteo de alertas pasa a severidad (reemplaza la decisión del hallazgo O4)

La Fase 4 había dejado `Alert.getStats` con `critico`/`advertencia` **solo de stock** (y los vencimientos críticos en `info`) para no inflar el rótulo «Productos Agotados» del Dashboard. Luis decidió el 9-oct que **todas las críticas van juntas**: `critico` = stock crítico + vencimiento crítico; `advertencia` = stock bajo + próximas a vencer; `info` = sobrestock y avisos; siempre por producto distinto. El Monitor de Alertas parte cada grupo en secciones por tipo (separadores), el Dashboard ya no dice «Productos Agotados» sino «Productos en Estado Crítico», y la campanita lista todas las alertas (antes pedía 5 y mostraba «+9»).

- **Código:** `models/Alert.js` (`getStats`), `frontend/src/utils/alertas.js` (la única copia de la regla en el frontend), `NotificationCenter.jsx`, `AlertasPage.jsx`, `DashboardPage.jsx`.
- **Contrato [A1] de la app:** los campos de `GET /api/alertas/stats` son los mismos, pero cambia lo que cuentan (ver `docs/contrato_api_app_tendero.md`). Hay que **avisar al equipo de la app**.
- **Pruebas:** `tests/business_logic/alertas_utils.test.js` y `tests/integration/alertas_conteo_coherente.test.js` (compara el frontend con el servidor).
- **Seguimiento:** P17-04 (arreglo de la campanita) y P17-05 (esta regla).
