# Plan 18: Unificar el Simulador de Escenarios con el motor de reposición

**Estado (actualizado el 9-oct-2026):** Implementado, fases 1 a 4 (P18-01): `calcularReposicion` acepta `diasCoberturaOverride`, `GET /api/ia/snapshot` recibe `?dias=N`, `SimuladorPage.jsx` usa `cantidad_recomendada` y la respuesta incluye `categoria`.
**Fecha:** 2026-09-23
**Depende de / relacionado con:** plan 17 (`17_unificacion_motor_riesgo_inventario.md`), que creó `utils/reposicion.js` y `utils/entradasMotor.js` como fuente única para Consejero, Proveedores y Detalle de Productos. El Simulador de Escenarios (`frontend/src/pages/SimuladorPage.jsx`) quedó fuera de esa unificación y es la única pantalla de "cuánto comprar" que sigue con su propia fórmula.

> *Nota de rutas (9-oct-2026):* desde la fase R1 del plan 21 (8-oct), `utils/reposicion.js`, `utils/entradasMotor.js`, `utils/guardrailsIA.js` y `utils/sugerenciasStock.js` viven en `services/inventory/`, y la lógica de IA de `aiController.js` está en `services/ia/`. Este plan conserva las rutas de su fecha. `utils/recomendacionesDashboard.js` y `utils/promociones.js` siguen en `utils/`.

---

## 1. Problema

`SimuladorPage.jsx` no usa `calcularReposicion`. Calcula la cantidad a comprar así (línea 57):

```js
const needed = Math.max(0, Math.ceil((p.velocity * days) - p.stock_actual));
```

Es decir: `ventas/día × días del slider − stock actual`. Esto tiene dos problemas, uno cosmético (ya corregido) y uno de fondo (este plan):

1. **Ya corregido:** el endpoint que consume (`GET /api/ia/snapshot`) empezó a devolver `days_to_exhaust: null` en vez de `Infinity` para productos sin ventas medibles, y el Simulador no lo sabía — rompía el orden de la tabla. Arreglado en `3c984c2`.
2. **Pendiente (este plan):** un producto sin ventas en los últimos 30 días siempre da `needed = 0`, sin importar cuánto se mueva el slider (7 a 90 días), porque `p.velocity` es `0` y `0 × días − stock` nunca es positivo. Verificado con los 18 productos de la tienda de prueba: ninguno supera el umbral ni en el peor caso (90 días, presupuesto sin usar). Esto contradice lo que ya muestran Catálogo, Consejero y Detalle: un producto puede estar `critico`/`agotado` (por `stock_seguridad` o por el piso de `stock_minimo`, plan 17 decisión 4) sin tener una sola venta reciente — precisamente el caso que más urge comprar, y es el que el Simulador nunca va a mostrar.

En corto: el Simulador es la séptima fórmula de "cuánto comprar" que quedaba sin unificar, y es la que peor se comporta con productos de baja o nula rotación (que es buena parte del catálogo real).

## 2. Qué NO hay que romper

- El slider "Días de Cobertura Deseada" es la razón de ser de esta pantalla: deja explorar "¿qué pasa si quiero cubrir 60 días en vez de 30?" sin tocar nada real. Cualquier solución tiene que seguir respondiendo al slider.
- La asignación de presupuesto (orden de prioridad A > B > C, luego greedy hasta agotar el presupuesto) es lógica propia de esta pantalla, no de "riesgo de quiebre" — se queda igual, tal como Promociones mantuvo su propia lógica de selección en el plan 17 (decisión 6).
- Consejero, Proveedores y Detalle no deben cambiar de comportamiento; el cambio es aditivo sobre el motor existente.

## 3. Diseño propuesto

### 3.1 Backend: `calcularReposicion` acepta un objetivo de cobertura opcional

Hoy la función usa siempre `DIAS_COBERTURA[claseABC]` (15/30/45 días fijos según A/B/C). Se le agrega un override opcional que, cuando llega, reemplaza esa tabla — sin cambiar el resultado para nadie que no lo use:

```js
function calcularReposicion(p, opciones = {}) {
  ...
  const dias = num(opciones.diasCoberturaOverride, null) ?? (DIAS_COBERTURA[p.claseABC] ?? DIAS_COBERTURA.C);
  const stockObjetivo = v30 * tendencia * dias + seguridad;
  ...
  // el piso de stock_minimo/stock_seguridad para productos sin ventas (línea 75-78) NO cambia:
  // no depende de `dias`, así que un producto crítico sin ventas muestra su piso sin importar
  // el valor del slider — es exactamente el comportamiento que falta hoy.
}
```

Consejero, Proveedores y Detalle siguen llamando `calcularReposicion(p)` sin el segundo argumento — nada cambia para ellos. Se agrega un test que confirme que el override cambia `stockObjetivo`/`cantidadBase` para un producto con ventas, y que el piso de un producto sin ventas es igual con o sin override (no depende de `dias`).

### 3.2 Backend: `GET /api/ia/snapshot` acepta `?dias=N`

`getAnalyticalSnapshot` (que ya usa `leerEntradasMotor` + `calcularReposicion`, plan 17 Fase 0) lee `req.query.dias`, lo valida (entero, 7–90, igual que los límites del slider; si falta o es inválido, se ignora y cada producto usa su `DIAS_COBERTURA` normal por ABC — así Detalle de Productos, que llama este mismo endpoint sin `dias`, no cambia). Se pasa como `diasCoberturaOverride` a `calcularReposicion`. No hace falta un endpoint nuevo ni tocar caché (este endpoint no llama a OpenAI, se recalcula cada vez).

### 3.3 Frontend: `SimuladorPage.jsx` deja de recalcular y usa lo que ya manda el backend

- Al mover el slider, se pide `/api/ia/snapshot?dias=N` (con debounce ~250ms para no disparar una consulta por cada pixel arrastrado) en vez de recalcular `needed` en el navegador.
- `needed` pasa a ser directamente `p.cantidad_recomendada` (ya viene del motor único).
- `simulatedCost` pasa a ser `needed * p.costo_unitario` (el backend ya expone `costo_unitario`/`costo_estimado` vía `costoUnitario()`, la misma fórmula que usan Consejero y Proveedores) en vez del `unitPrice / 1.3` inventado que tiene hoy.
- El resto (slider de presupuesto, checkboxes de inclusión manual, orden A>B>C + greedy, modal de "Convertir en Orden Real") no cambia: sigue siendo un `useMemo` sobre los productos ya traídos, solo que ahora la cantidad y el costo de cada uno vienen del motor único en vez de inventarse en el `useMemo`.
- La columna "Alcanza Para" (`days_to_exhaust`) se queda igual — es información de cuánto dura el stock actual, no el objetivo del slider, y ya quedó corregida para `null`/`Infinity` en el commit anterior.

### 3.4 Extra menor, opcional (visto de pasada, no es parte del problema principal)

La columna de categoría del producto (debajo del nombre, ej. "Snacks") sale vacía hoy porque `getAnalyticalSnapshot` nunca incluyó `categoria` (el campo de texto libre) en su respuesta — solo `category` (la letra ABC). Es una línea (agregar `categoria: item.categoria` a la respuesta y a `leerEntradasMotor` si no la trae). Se puede incluir en la Fase 1 sin costo adicional, o dejarlo fuera si se prefiere no tocar nada que no sea el bug reportado.

## 4. Fases

| Fase | Contenido |
|---|---|
| **1** | `calcularReposicion` gana `diasCoberturaOverride` (opcional, sin cambiar el comportamiento por defecto). Tests: override cambia el resultado para un producto con ventas; el piso de un producto sin ventas es igual con y sin override. |
| **2** | `GET /api/ia/snapshot?dias=N` valida y pasa el override. Sin caché que invalidar. Test manual: Detalle de Productos (que llama el mismo endpoint sin `dias`) sigue mostrando los mismos números que hoy. |
| **3** | `SimuladorPage.jsx`: quita el cálculo local de `needed`/`simulatedCost`, pide `snapshot?dias=N` con debounce al mover el slider, usa `cantidad_recomendada`/`costo_unitario` directo. La asignación de presupuesto y el modal de conversión no cambian. |
| **4 (opcional)** | Agregar `categoria` a la respuesta de `getAnalyticalSnapshot` para que la tabla del Simulador (y cualquier otro consumidor futuro) deje de mostrar esa línea vacía. |

## 5. Plan de pruebas

- Unitaria (Fase 1): casos nuevos en `reposicion.test.js` para `diasCoberturaOverride`.
- Manual (Fase 3), con la tienda de prueba: mover el slider a 7, 30 y 90 días y confirmar que Yogurt Alpina 1L y Leche Alquería Entera 1L (críticos, sin ventas en 30 días) aparecen con una cantidad > 0 sin importar el slider; confirmar que subir el slider aumenta razonablemente la cantidad sugerida de un producto con ventas reales (ej. Arroz Diana); confirmar que "Convertir en Orden Real" deja de estar permanentemente deshabilitado cuando al menos un producto entra en el presupuesto.
- Regresión: Consejero, Proveedores y Detalle de Productos deben seguir mostrando exactamente los mismos números que antes de este plan (no llaman con `dias`, así que no deberían cambiar).

## 6. Nada de esto toca `Alert.js`

A diferencia de la Fase 4 del plan 17 (todavía pendiente), este plan no cambia notificaciones ni alertas — es una pantalla aislada (Simulador) más un parámetro opcional en una función pura ya cubierta por tests. Riesgo bajo.
