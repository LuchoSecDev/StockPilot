# Plan 13: Del Consejero IA al borrador de orden de compra

**Estado:** Fases A a E implementadas y en `main` (`feature/orden-desde-consejero`; corregido el 9-oct-2026). La Fase E (recepción de mercancía y solicitudes del tendero) se detalla y verifica en `docs/planes/16_plan_consejero_ia_fase_e_cierre_del_ciclo.md`, junto con la revisión del punto de "Aprendizaje de la IA" del plan original (no se implementó tal como se propuso: duplicaba un mecanismo que ya existe).
**Fecha:** 2026-09-20
**Depende de:** plan 11 (`fix/consejero-ia-sugerido-cero`): el Consejero ya solo recomienda productos con `base_load > 0`.
> *Nota de rutas (9-oct-2026):* desde la fase R1 del plan 21 (8-oct), `utils/reposicion.js`, `utils/entradasMotor.js`, `utils/guardrailsIA.js` y `utils/sugerenciasStock.js` viven en `services/inventory/`, y la lógica de IA de `aiController.js` está en `services/ia/`. Este plan conserva las rutas de su fecha. `utils/recomendacionesDashboard.js` y `utils/promociones.js` siguen en `utils/`.
**Objetivo:** que una recomendación del Consejero IA se convierta, con un clic, en un **borrador de orden de compra** que el administrador revisa, aprueba y envía al proveedor, sin reescribir nada a mano.

---

## 1. Respuesta corta a "¿el borrador es solo de ese producto?"
**No.** Una orden de compra pertenece a **un proveedor** (`Ordenes_Compra.id_proveedor` es `NOT NULL`) y puede tener varias líneas. Por eso el diseño es:

| Acción en la tarjeta | Resultado |
|---|---|
| **"Agregar al pedido de {Proveedor}"** (por tarjeta) | Suma **ese producto** al **borrador abierto** de su proveedor. Si no hay borrador abierto, lo crea. Los demás productos del mismo proveedor pueden ir sumándose después. |
| **"Armar pedido con todo lo sugerido"** (botón general) | Crea o actualiza **un borrador por proveedor** con todas las tarjetas visibles, agrupadas por proveedor. |
| Producto **sin proveedor** asignado | No entra a ningún borrador; se le pide elegir proveedor (y se guarda en el producto para la próxima vez). |

Regla clave: **un solo borrador abierto por proveedor y tienda.** Así el tendero no termina con cinco borradores del mismo distribuidor. En la tienda de prueba los 18 productos tienen el mismo proveedor ("Distribuidora Global"), por lo que "todo lo sugerido" produciría un único borrador.

---

## 2. Punto de partida (hallazgos del código)

Lo que **ya existe** y se reutiliza:
- Tablas `Ordenes_Compra` (estado, presupuesto, riesgo, notas) y `Ordenes_Detalle` (`cantidad_sugerida`, `sugerencia_ia`, `cantidad_final`, `costo_unitario`).
- `Productos.id_proveedor`, `lead_time`, `stock_seguridad`, `costo_compra`.
- API de Proveedores: `POST /api/proveedores/:id/ordenes` (crea la orden), `GET /api/ordenes/historial`, `GET /api/ordenes/:id`, `PATCH /api/ordenes/:id/estado`, `POST /api/ordenes/:id/enviar-proveedor` (correo), pago y abonos.
- UI de historial y detalle de órdenes (`OrdenesHistory.jsx`) con aprobar / enviar.
- Precedente: el **Simulador** ya convierte una simulación en orden `Borrador` (`SimuladorPage.handleConvertToOrder`), pero **de un proveedor a la vez**.

Lo que **falta o está mal** y el plan corrige (importa porque el borrador hereda estos datos):

1. **Dos motores de cantidad que no coinciden.** El Dashboard calcula `objetivo = ventas/día × tendencia × días de cobertura + seguridad − stock`. Proveedores calcula `ROP − stock` y, si el producto está sano, sugiere una semana de ventas (mínimo 1) aunque no haga falta. Un mismo producto puede aparecer con cantidades distintas en cada pantalla.
2. **El presupuesto usa el precio de venta, no el costo.** `getSupplierForecast` calcula `presupuesto_estimado = cantidad × precio` (precio de venta). La orden debería valorarse con `costo_compra`. Hoy el total de la orden sale inflado por el margen.
3. **Las recomendaciones del Consejero no traen `id_producto`** (solo nombre), así que no se pueden enlazar a un producto ni a un proveedor.
4. **No se garantiza un borrador por proveedor.** Cada envío crea una orden nueva.
5. **Estados desalineados.** El esquema documenta `Borrador/Enviada/Aprobada/Rechazada/Completada`, pero el flujo del Proveedores usa `Pendiente`, y `PATCH /estado` acepta cualquier texto (sin máquina de estados).
6. **Las APIs de proveedores solo exigen `requireLogin`**, aunque la página es solo de administrador (`AdminRoute`). Un tendero podría llamarlas directamente.
7. **Recibir la mercancía no actualiza el inventario:** no hay flujo de "Completada → entrada de stock". El ciclo termina en el correo y el tendero debe registrar la entrada a mano en **Movimientos** (la propia pantalla lo indica: "cuando recibes cajas o pedidos de proveedores…").
8. **Proveedor sin correo** (el de la tienda de prueba no tiene): hoy `enviar-proveedor` responde 400 "Falta email proveedor".
9. **El correo al proveedor usa la paleta vieja** (`#4f46e5`, índigo).

---

## 3. Flujo de usuario propuesto

1. En el Dashboard, cada tarjeta del Consejero muestra: producto, **cantidad sugerida**, **urgencia** ("Pide hoy" / "Esta semana" / "Puede esperar") y el botón **"Agregar al pedido de {Proveedor}"**.
2. Al pulsarlo, la tarjeta cambia a **"En borrador ✓ (Pedido #24)"** y aparece un aviso con **"Ver pedido"**. No se envía nada al proveedor.
3. Arriba de la lista: **"Armar pedido con todo lo sugerido (3 proveedores · $1.240.000)"**, que abre un resumen antes de crear.
4. **"Ver pedido"** lleva a `/proveedores` con el detalle abierto, donde el administrador **edita cantidades, quita líneas, aprueba y envía** (flujo que ya existe).
5. Si el proveedor no tiene correo: se ofrece **copiar el pedido como texto** (para WhatsApp) o **descargar PDF**, en lugar de fallar.

Nada se envía ni se aprueba solo: el Consejero **propone**, el administrador **decide**.

---

## 4. Diseño técnico por fases

### Fase A — Motor único de reposición (`utils/reposicion.js`) · base de todo
Extraer a un módulo puro (sin BD ni OpenAI, como `utils/recomendacionesDashboard.js`):

```
calcularReposicion({ ventasDia, tendencia, claseABC, stock, stockSeguridad, leadTime, factorIA })
  → { cantidadBase, stockObjetivo, rop, diasParaAgotar, riesgo, urgencia }
```
- **Cantidad:** la del Dashboard (objetivo por clase ABC) como fórmula única; el `factor_ia` de Feedback_IA se aplica igual en ambos lados.
- **Tendencia acotada** (p. ej. entre 0,5× y 2×) y con **mínimo de ventas** para no exagerar con muestras pequeñas (hoy 3,48× con 0,53 u/día).
- **Urgencia** (nuevo): `diasParaAgotar = stock / ventasDia`; si `diasParaAgotar ≤ leadTime` → **"Pide hoy"** (llegaría tarde); `≤ leadTime + 7` → **"Esta semana"**; si no → **"Puede esperar"**.
- **Costo** con `costo_compra` (si es 0 o nulo, se usa `precio × (1 − margen medio)` y se marca como estimado).

Se reemplazan los cálculos duplicados en `aiController.getDashboardRecommendations` y `suppliersController.getSupplierForecast`. Sin cambios de API todavía.

**Pruebas:** casos de tabla (stock sobrado, crítico, sin ventas, tendencia extrema, costo nulo) en `tests/business_logic/reposicion.test.js`. Criterio: ambas pantallas dan la misma cantidad para el mismo producto.

### Fase B — Borradores por proveedor (backend)
**Esquema** (en el bloque de auto-migración de `config/database.js`, con `IF NOT EXISTS`):
```sql
ALTER TABLE Ordenes_Compra ADD COLUMN IF NOT EXISTS origen VARCHAR(30) DEFAULT 'manual';  -- 'consejero' | 'simulador' | 'proveedores'
ALTER TABLE Ordenes_Detalle ADD COLUMN IF NOT EXISTS urgencia VARCHAR(20);
ALTER TABLE Ordenes_Detalle ADD COLUMN IF NOT EXISTS costo_estimado BOOLEAN DEFAULT FALSE;
-- Un solo borrador abierto por proveedor y tienda
CREATE UNIQUE INDEX IF NOT EXISTS ux_orden_borrador_proveedor
  ON Ordenes_Compra (id_tienda, id_proveedor) WHERE estado = 'Borrador';
-- Un producto aparece una sola vez por orden
CREATE UNIQUE INDEX IF NOT EXISTS ux_orden_detalle_producto ON Ordenes_Detalle (id_orden, id_producto);
```
Antes de crear el índice único, una consulta de consolidación fusiona borradores duplicados existentes (el Simulador puede haberlos creado) y se ejecuta una sola vez.

**Endpoints nuevos** (`routes/supplierRoutes.js`, todos con `requireAdmin`; ver Fase E para tenderos):

| Método y ruta | Qué hace |
|---|---|
| `POST /api/ordenes/borrador/desde-consejero` | Body: `{ items: [{ id_producto, cantidad? }] }`. Valida que cada producto sea de la tienda; **agrupa por proveedor**; por cada proveedor hace *upsert* del borrador y de sus líneas (`INSERT … ON CONFLICT (id_orden,id_producto) DO UPDATE`), en **una transacción**. Recalcula cantidad con el motor de la Fase A si no viene `cantidad`. Responde `{ borradores: [{ id_orden, id_proveedor, proveedor, lineas, total }], sin_proveedor: [id_producto] }`. |
| `GET /api/ordenes/borradores/resumen` | Por producto: `{ id_producto → { id_orden, cantidad } }` de los borradores abiertos, para pintar "En borrador ✓" en las tarjetas. |
| `PATCH /api/ordenes/:id/items/:idProducto` | Cambia cantidad de una línea (solo si la orden está en `Borrador`). |
| `DELETE /api/ordenes/:id/items/:idProducto` | Quita una línea; si la orden queda vacía, se elimina. |
| `PATCH /api/productos/:id/proveedor` | Asigna proveedor a un producto sin proveedor (para el caso "sin proveedor"). |

**Reglas de negocio:**
- Si el producto ya está en el borrador: **no se duplica**; se conserva la cantidad que el administrador ya editó (no se pisa) salvo que el cliente lo pida explícitamente.
- Solo se edita una orden en `Borrador`. Tras aprobar/enviar queda congelada y una recomendación nueva crea **otro** borrador.
- **Máquina de estados** en `PATCH /estado`: `Borrador → Pendiente|Aprobada → Enviada → Completada`, más `Rechazada`. Se unifica `Pendiente` con el resto y se rechazan saltos inválidos.
- `total` del borrador = Σ `cantidad_final × costo_unitario` (con `costo_compra`).
- Auditoría: cada creación registra en `Auditoria_IA` (`origen = consejero`) para que "Auditoría AI" muestre de dónde salió la orden.

**Respuesta del Consejero enriquecida** (`GET /api/ia/recommendations`): cada recomendación añade `id_producto`, `id_proveedor`, `proveedor`, `costo_unitario`, `urgencia`, `dias_para_agotar`. La clave de caché sube a `RECS_V3_` para no servir respuestas antiguas sin esos campos.

### Fase C — Interfaz del Consejero (`DashboardPage.jsx`)
- Tarjeta: chip de **urgencia**, botón **"Agregar al pedido de {Proveedor}"**; estado "En borrador ✓" leído de `borradores/resumen`.
- Botón general **"Armar pedido con todo lo sugerido"** con resumen previo (proveedores, líneas, total) y confirmación.
- Producto sin proveedor: selector de proveedor en la propia tarjeta.
- Tras crear: toast con enlace **"Ver pedido"** → `/proveedores?orden={id}` (abre el detalle).
- Solo visible para **Administrador**; el tendero ve las tarjetas sin botón.
- Estilo con los tokens actuales (`azul`, `titular`, chips en mayúsculas para urgencia, sin colores nuevos).

### Fase D — Revisar y enviar
- `OrdenesHistory`: mostrar el origen ("Sugerida por el Consejero") y permitir editar cantidades del borrador (usa los endpoints de la Fase B).
- **Proveedor sin correo:** en lugar del 400, ofrecer *copiar como texto* y *descargar PDF* (ya existe `pdfkit` en dependencias).
- Actualizar la plantilla del correo a la paleta nueva (`azul #252C93`, `tinta`).
- Bloquear el botón "Enviar" si hay líneas con cantidad 0.

### Fase E — Cierre del ciclo (opcional, después del MVP)
- **Recepción de mercancía:** marcar `Completada` abre un formulario "¿Qué llegó?" (cantidad recibida por línea) y genera **entradas de stock** en `MovimientosStock` (ya existe el módulo). Sin esto el Consejero seguirá recomendando comprar lo que ya llegó.
- **Aprendizaje:** al aprobar con cantidades distintas a las sugeridas, guardar la diferencia (`cantidad_sugerida` vs `cantidad_final`, ya existen) y alimentar `Feedback_IA`, para que la "confianza" deje de estar en 50 %.
- **Permisos de tendero:** opción de que el tendero *solicite* un producto (crea línea en un borrador que el administrador aprueba). Requiere decidir el flujo de aprobación.

---

## 5. Casos borde

| Caso | Comportamiento |
|---|---|
| Producto **sin proveedor** | Se informa en `sin_proveedor`; la UI pide elegir uno y reintenta. |
| **Dos usuarios** agregan a la vez | Índice único parcial + `ON CONFLICT`: uno crea, el otro actualiza; nunca dos borradores. |
| El producto **ya no necesita reposición** al confirmar | El servidor **recalcula**; si `base_load = 0` no se agrega y se devuelve en `omitidos`. |
| Producto **ya está en el borrador** | No se duplica; se mantiene la cantidad editada. |
| Orden ya **enviada/aprobada** | No se modifica; se crea un borrador nuevo. |
| Proveedor **eliminado** | `id_proveedor` del producto queda `NULL` (FK `ON DELETE SET NULL`): vuelve al caso "sin proveedor". |
| Presupuesto excedido | La evaluación de riesgo existente (`Alto`) se muestra en el borrador; no bloquea, avisa. |
| **Costo de compra = 0** | Se estima con margen medio y se marca "costo estimado" en la línea. |

## 6. Seguridad
- Todos los endpoints nuevos con `requireAdmin` y filtro por `id_tienda` de la sesión (nunca del body).
- **Corregir de paso** que las rutas de proveedores/órdenes existentes usen `requireAdmin` (hoy solo `requireLogin`).
- Validar `id_producto`, cantidades enteras `> 0` y topes razonables; `sanitizeBody` ya existe.
- Transacciones con `BEGIN/COMMIT/ROLLBACK` (como `submitSmartOrder`); sin SQL concatenado.
- El límite de la IA (`/api/ia` 60/15 min) no afecta: crear el borrador **no llama a OpenAI**.

## 7. Pruebas y criterios de aceptación
- **Unitarias** (sin BD): `reposicion.test.js` (Fase A) y agrupación por proveedor / omitidos / no duplicar (`ordenes_borrador.test.js`, con la lógica pura separada del SQL).
- **Manual con Playwright y datos reales** (mismo método del plan 09: sesión reutilizada, TOTP generado, solo la tienda de prueba):
  1. Agregar un producto → aparece borrador `#N` en `/proveedores` con 1 línea.
  2. Agregar otro del mismo proveedor → **misma orden**, 2 líneas.
  3. "Armar todo" → sin duplicar líneas.
  4. Editar una cantidad, volver a agregar → **se conserva la editada**.
  5. Aprobar → el botón de la tarjeta deja de decir "En borrador".
- **Aceptación:** misma cantidad en Dashboard y Proveedores para el mismo producto; total del borrador con `costo_compra`; ningún envío ocurre sin acción explícita; `npm run lint` y `npx vitest run` en verde.

## 8. Orden de entrega y esfuerzo estimado
| Fase | Entrega | Esfuerzo |
|---|---|---|
| A | Motor único + urgencia + pruebas | 1 día |
| B | Esquema, endpoints, máquina de estados, permisos | 2 días |
| C | UI del Consejero (botones, estados, resumen) | 1,5 días |
| D | Edición de líneas, proveedor sin correo, plantilla de correo | 1 día |
| E | Recepción de mercancía y aprendizaje | 2–3 días (opcional) |

**MVP = A + B + C** (≈ 4,5 días): ya se puede pasar de la recomendación al borrador. D y E lo hacen cómodo y cierran el ciclo.
Cada fase en una rama secundaria propia (`feature/orden-desde-consejero-*`), sin tocar `main`.

## 9. Decisiones que necesito del usuario
1. ¿Un solo borrador por proveedor (recomendado) o uno nuevo cada vez?
2. ¿Los **tenderos** pueden solo *ver* las sugerencias, o también *solicitar* productos para que el administrador los apruebe?
3. Para el proveedor sin correo: ¿texto para WhatsApp, PDF o ambos?
4. ¿Se incluye la **Fase E** (recepción de mercancía → inventario) en esta entrega o queda para después?
5. ¿"Pide hoy / Esta semana / Puede esperar" con esos umbrales (`lead_time` y `lead_time + 7` días)?

---

## 10. Revisión del plan antes de implementarlo (2026-09-21) y qué se cambió

Al contrastar el plan con el código actual se ajustó lo siguiente. Las decisiones de la sección 9 se tomaron con la opción recomendada, a la espera de que el usuario indique otra cosa.

| # | Hallazgo / decisión | Qué se hizo |
|---|---|---|
| 1 | **Decisiones de la sección 9** sin respuesta. | Se asumió lo recomendado: un borrador por proveedor; el tendero solo **ve** las sugerencias; se deja fuera la Fase E; umbrales `lead_time` y `lead_time + 7`. Proveedor sin correo queda para la Fase D. |
| 2 | **Los índices únicos propuestos podían romper el arranque.** Si en producción ya hay dos borradores del mismo proveedor, `CREATE UNIQUE INDEX` falla y, al ser un bloque de varias sentencias, revierte toda la auto-migración (el mismo tipo de fallo del plan 15, Fiados). | No se crean índices únicos. La unicidad se garantiza dentro de la transacción con `pg_advisory_xact_lock(tienda, proveedor)` y buscando el borrador abierto más antiguo antes de insertar. Un índice parcial **no único** acelera esa búsqueda. |
| 3 | **El esquema vive en dos sitios** (`init_pg.sql` y la auto-migración) y solo el segundo corre en producción. | Las columnas nuevas (`origen`, `urgencia`, `costo_estimado`) están en **ambos**. Además la auto-migración crea `Ordenes_Compra` y `Ordenes_Detalle` si faltan. |
| 4 | **Cantidad recalculada en el servidor.** El plan proponía recalcular al confirmar; la clase ABC depende de toda la tienda y el cálculo es pesado. | El servidor **valida** (producto de la tienda, cantidad entera > 0, tope 100 000) y usa la cantidad de la recomendación. Un producto inexistente se informa en `no_encontrados`. El recálculo en servidor queda como mejora. |
| 5 | **Fuga de datos:** `GET /api/ordenes/:id` no filtraba por tienda. | Ahora exige que la orden sea de la tienda de la sesión. |
| 6 | **Permisos:** las APIs de órdenes y proveedores solo pedían sesión. | Pasan a `requireAdmin` (`GET /api/proveedores` queda para cualquier sesión, porque lo usan otros formularios). |
| 7 | **Orden de rutas:** `/api/ordenes/borradores/resumen` habría caído en `/api/ordenes/:ordenId`. | El router nuevo se registra antes que `supplierRoutes`. |
| 8 | **Producto sin proveedor:** el plan pedía un selector en la tarjeta. | La tarjeta avisa "Sin proveedor asignado: asígnalo en Productos". El endpoint `PATCH /api/productos/:id/proveedor` ya existe; el selector queda para la Fase D. |
| 9 | **Caché:** las recomendaciones antiguas no traen `id_producto`. | La clave sube a `RECS_V3_` y la interfaz oculta los botones en recomendaciones sin esos datos. |

## 11. Qué quedó implementado (MVP = A + B + C)

**Fase A: motor único.** `utils/reposicion.js` (`calcularReposicion`, `calcularTendencia`, `costoUnitario`) lo usan el Consejero (`aiController`) y Proveedores (`getSupplierForecast`). La tendencia se acota a 0,5×–2× y solo con al menos 5 unidades vendidas en 30 días. Urgencia: **Pide hoy** (stock para ≤ `lead_time` días, o sin stock), **Esta semana** (≤ `lead_time` + 7) o **Puede esperar**. El presupuesto de Proveedores ahora usa `costo_compra` (si es 0, precio × 0,75 y se marca como estimado).

**Fase B: backend.** `controllers/ordenBorradorController.js` y `routes/ordenBorradorRoutes.js`: `POST /api/ordenes/borrador/desde-consejero` (agrupa por proveedor, una transacción, sin duplicar líneas ni pisar cantidades editadas), `GET /api/ordenes/borradores/resumen`, `PATCH|DELETE /api/ordenes/:id/items/:idProducto` y `PATCH /api/productos/:id/proveedor`. Cada creación queda en `Auditoria_IA`.

**Fase C: interfaz** (`DashboardPage.jsx`, solo administrador): chip de urgencia y "Stock para ~N días", botón **Agregar al pedido de {proveedor}**, estado **En borrador · Pedido #N**, botón **Armar pedido con todo lo sugerido** con confirmación (proveedores, productos y total) y enlace **Ver pedido** que abre `/proveedores?orden=ID` con el detalle, donde ya existen Aprobar, Rechazar y Enviar.

**Verificación.** 13 pruebas unitarias nuevas (153 en total, todas pasan), lint del frontend en 0 y build correcto. Prueba real con Playwright contra la base de la tienda de prueba: 4 recomendaciones con proveedor y urgencia; agregar una crea el pedido; "armar todo" deja las 4 en **un** borrador; editar a 77 y volver a agregar conserva 77 sin duplicar; las entradas inválidas responden 400; un producto inexistente no crea nada; `/proveedores?orden=N` abre el detalle. Los borradores de prueba se eliminaron. Capturas en `docs/planes/img/dashboard-consejero-*.jpg` y `proveedores-detalle-borrador.jpg`.

**Observaciones (sin cambiar).**
- Con los datos actuales las 4 sugerencias salen "Puede esperar": el stock alcanza para muchos días y el Consejero las sugiere porque el stock queda por debajo del **stock de seguridad**. Conviene decidir si una sugerencia "puede esperar" debe mostrarse igual o ir en una sección aparte.
- Faltan la Fase D (editar cantidades desde el detalle, proveedor sin correo, plantilla de correo) y la E (recepción de mercancía).

## 12. Ajustes tras la primera revisión (2026-09-22)

- **Ajuste IA en 0 % y "Base: ud" vacío en el detalle.** Dos causas. (1) El borrador guardaba la cantidad ya ajustada como base y "0" como ajuste; ahora el Consejero envía su base y su ajuste real y se guardan en cantidad_sugerida y sugerencia_ia (ejemplo verificado: base 11, ajuste +20 %, final 14). (2) El detalle leía det.cantidad_base, una columna que no existe (la real es cantidad_sugerida), por lo que "Base" salía vacío también en las órdenes antiguas; corregido. Sin ajuste se muestra "Sin ajuste" en lugar de 0 %. Los borradores creados antes de este cambio conservan el 0 % guardado.
- **Sugerencias "Puede esperar" aparte.** La lista principal muestra solo "Pide hoy" y "Esta semana" (y "Armar pedido con todo lo sugerido" las usa solo a ellas). Las demás van en la sección plegada "Para reponer con calma", con su propio botón. Si no hay nada urgente se lee "Nada urgente por pedir hoy". Capturas: docs/planes/img/dashboard-calma-*.jpg y proveedores-detalle-ajuste.jpg.

## 13. Fase D: revisar y enviar (2026-09-22)

- **Editar cantidades y quitar líneas del borrador.** En `OrdenesHistory`, mientras la orden está en Borrador, cada línea muestra un campo de cantidad y un botón para quitarla (usan los endpoints de la Fase B, `PATCH`/`DELETE /api/ordenes/:id/items/:idProducto`). El presupuesto se recalcula al instante. Si se quita la última línea, el borrador se elimina.
- **Producto sin proveedor.** La tarjeta del Consejero ahora tiene "Sin proveedor asignado: elegir uno", que despliega un selector con los proveedores de la tienda; al guardar, asigna el proveedor al producto (`PATCH /api/productos/:id/proveedor`, de la Fase B) y de una vez lo agrega al pedido. No se pudo probar en vivo porque los 18 productos de la tienda de prueba ya tienen proveedor asignado; se verificó por revisión de código y con el mismo patrón que el resto del flujo, ya probado.
- **Proveedor sin correo.** Antes, enviar fallaba con "Falta email proveedor" (400). Ahora, si la orden está Aprobada y el proveedor no tiene correo, se muestra un aviso con tres opciones: **Copiar como texto** (para WhatsApp), **Descargar PDF** (nuevo endpoint `GET /api/ordenes/:id/pdf`, con `pdfkit`, ya usado en Reportes) y **Ya la envié: marcar como enviada** (pasa la orden a `Enviada` a mano). Se probó con la tienda de prueba real, cuyo único proveedor no tiene correo.
- **Plantilla del correo.** El color de cabecera pasó del índigo anterior (`#4f46e5`) al azul de la paleta (`#252C93`).
- **Verificación real (Playwright, sesión y datos de la tienda de prueba, sin tocar la BD a mano):** se editó una línea del borrador #6 (10→7 u), se quitó la otra línea, se aprobó, se copió el pedido al portapapeles ("Pedido #6 — Distribuidora Global…"), se descargó el PDF (200, `application/pdf`) y se marcó como enviada; el historial la muestra como "Enviada". De paso quedó corregida en los datos de prueba la orden con "Ajuste IA 0 %" que el usuario había visto (ahora "Sin ajuste"), porque se editó con el flujo real de la app. Capturas: `docs/planes/img/proveedores-sin-correo.jpg`, `proveedores-historial-final.jpg`.
- **Fuera de alcance de esta fase:** máquina de estados formal para `PATCH /estado` (sigue aceptando cualquier texto) y recepción de mercancía (Fase E).
  - *Actualización 9-oct-2026 (P13-01, ahora prioridad Alta):* la recepción ya existe (plan 16) y desde el 4-oct una orden puede quedar «Parcial» (P21-10). `updateOrderStatus` sigue rechazando solo «Completada»: una orden completada se puede devolver a «Borrador» o «Aprobada» y volver a recibirse. La máquina de estados de la Fase B debe incluir «Parcial» y no permitir salir de «Completada» ni de «Rechazada».

## 14. Urgencia sin historial de ventas (2026-09-23)

Leche Alquería (stock 3, mínimo de seguridad 12: riesgo **CRÍTICO**) aparecía como "Puede esperar" porque, sin ventas en 30 días, no hay `diasParaAgotar` que calcular y la urgencia se quedaba en el valor por defecto. Ahora, cuando no hay ventas que medir **y** el riesgo ya es CRÍTICO, la urgencia sube a **Pide hoy**: no hay que esperar a que se venda algo que ya está bajo el mínimo. Cuando sí hay ventas, manda el cálculo real de días (Papas Margarita, con 330 días de cobertura aunque esté bajo su mínimo, sigue en "Puede esperar"). La clave de caché de las recomendaciones sube a `RECS_V4_` para que las tiendas con datos sin cambios recalculen con la fórmula nueva. Verificado con la tienda de prueba real (antes/después) y con 2 pruebas unitarias nuevas (155 en total).
