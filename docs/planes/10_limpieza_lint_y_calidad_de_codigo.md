# Plan 10: Limpieza de ESLint y Revisión de Calidad de Código (Frontend + Backend)

**Estado:** Implementado y Verificado
**Fecha:** 2026-09-19
**Commit:** `8ae43d7` (`chore(lint): eliminar los 79 hallazgos de ESLint en frontend y backend`)
**Pendientes (revisado el 9-oct-2026):** P10-01 (`eslint.config.js` en el backend), P10-02 (tono de la plantilla de `generar_reporte.js`) y P10-03 (`test_disable_2fa.js`). El riesgo de `seed_test_data.js` (sección 3.1) quedó resuelto el 28-sep con `database/guardiaSemilla.js` (P10-04).

---

## 1. Contexto
`npm run lint` en `frontend/` reportaba **55 problemas (49 errores, 6 advertencias)** ya antes del rediseño visual (plan 09). El proyecto **no tiene configuración de ESLint para el backend**, por lo que nunca se había analizado. Este plan elimina los hallazgos del frontend y extiende el análisis a todo el código Node.

| Alcance | Antes | Después |
|---|---|---|
| Frontend (`npm run lint`) | 55 (49 errores + 6 advertencias) | **0** |
| Backend, scripts, pruebas y e2e (análisis ad hoc) | 24 errores | **0** |
| Pruebas unitarias (`npx vitest run`) | 132 ✅ | 132 ✅ |
| `node --check` sobre `app.js`, `controllers/`, `models/`, `routes/`, `services/`, `middleware/`, `utils/`, `config/`, `scripts/` | — | sin errores de sintaxis |
| `npm run build` (frontend) | ✅ | ✅ |

## 2. Cómo se analizó el backend
No se añadió configuración al repositorio. Se usó, desde fuera del repo, el ESLint que ya trae `frontend/node_modules` con `@eslint/js` (reglas `recommended`) y `globals.node`, con `sourceType: commonjs` para el backend y `module` para `tests/` y `vitest.config.js`:

```bash
# desde la raíz del repo, con un eslint.config.mjs temporal fuera del repositorio
node frontend/node_modules/eslint/bin/eslint.js -c <config-temporal> .
```
Ignorados: `node_modules`, `frontend/` (tiene su propia config), `coverage`, `playwright-report`, `test-results`, `backups`, `exports`, `logs`.

> **Recomendación:** si se quiere que el backend quede cubierto en CI, agregar un `eslint.config.js` en la raíz con esas mismas reglas y una dependencia de desarrollo `eslint` en el `package.json` raíz.

## 3. Hallazgos por tipo

| Regla | Cantidad | Tratamiento |
|---|---|---|
| `no-unused-vars` | 38 front + 19 back | `catch (e)` sin usar → `catch`; variables, imports y desestructuraciones sin usar eliminados |
| `no-undef` | 6 front + 3 back | **Bugs reales** (ver 3.1) y un falso positivo (`document` dentro de `page.evaluate` en un e2e → `/* global document */`) |
| `react-hooks/exhaustive-deps` | 6 (advertencias) | `useCallback` donde es seguro; `eslint-disable` justificado donde agregar la dependencia rompería el comportamiento |
| `react-refresh/only-export-components` | 3 | `eslint-disable` justificado (el hook se exporta junto a su Provider) |
| `react-hooks/purity` | 1 | `Date.now()` fuera del render |
| `react-hooks/immutability` + `set-state-in-effect` | 2 | Generación del QR de 2FA dentro del efecto, con bandera de cancelación |
| `no-empty` | 2 | Bloques `catch` de la caché de IA con comentario explicando por qué se ignoran |

### 3.1 Bugs reales encontrados
1. **`database/seed_test_data.js` — riesgo destructivo.** Usaba `productosData` sin definirla. Como el script ejecuta primero `TRUNCATE … CASCADE` de todas las tablas y **después** falla con `ReferenceError`, ejecutar `npm run seed` vaciaba la BD y dejaba el sistema sin datos. Ahora define `const productosData = getProductos();`. *(Sigue siendo un script destructivo por diseño: solo debe correrse sobre una BD de pruebas.)*
2. **`hooks/useProductosPage.js` — función muerta y rota.** `submitAgregarStock` usaba estado que no existe (`stockLoading`, `stockProducto`, `setStockModalOpen`…) y nadie la llamaba (resto de una funcionalidad eliminada). Se elimina junto con el import `useRef` sin uso.

### 3.2 Decisiones que conviene conocer
- **Manejador de errores de Express (`app.js`):** Express identifica los manejadores de error por su aridad (4 argumentos). `next` se renombró `_next` en vez de eliminarlo, o Express dejaría de tratarlo como manejador de errores.
- **`CashRegisterModal` y `ProductFormModal`:** el `useEffect` debe correr **solo al abrir**. Sus dependencias "faltantes" (`fetchSession`, `defaultData`) se recrean en cada render; agregarlas reiniciaría el formulario o recargaría sin parar. Se dejó `eslint-disable-next-line react-hooks/exhaustive-deps` con la explicación.
- **`CajaRapidaTab`:** `addToCart` pasó a `useCallback` (solo usa `setCart` funcional y `toast`, ambos estables) y se declara antes de `handleBarcodeScan`, que ahora lo lista como dependencia. Comportamiento idéntico, sin cierres obsoletos con el lector de códigos de barras.
- **`HistorialVentasTab.cargarMasVentas`:** se conserva con un `TODO`. La paginación "cargar más" nunca se conectó a un botón, así que el historial solo muestra la primera página. Es una funcionalidad pendiente, no código muerto que convenga borrar.
- **`test_disable_2fa.js` (raíz):** solo se limpiaron imports. Es un script de prueba manual que **inserta datos** en la BD real; no forma parte de la suite (`vitest` ignora la raíz).

## 4. Pendiente / observaciones
- Agregar `eslint.config.js` al backend (ver recomendación en la sección 2).
- `react-router-dom` y `axios` están en `devDependencies` del frontend siendo dependencias de ejecución.
- `Documentacion/Reporte_Pruebas_StockPilot.md` (hoy `docs/Reporte_Pruebas_StockPilot.md`, que ya regenera `generar_reporte.js`: P21-17) se mantenía a mano: se actualizaron fecha y conteos (124 → **132** pruebas, todas aprobadas) tomados de `npm run test:evidence`. **No** se regeneró con `generar_reporte.js` porque su plantilla sobrescribiría ajustes manuales del documento (p. ej. escribe "Vitest v3" cuando el proyecto usa v4 y omite el motor de cobertura).
