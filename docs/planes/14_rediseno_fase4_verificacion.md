# Plan 14: Rediseño Visual — Fase 4 (Verificación: contraste, estados y tamaños de pantalla)

**Estado:** Implementado y verificado con datos reales. **Rama `feature/rediseno-fase4` (sale de `feature/rediseno-fase3`): mezclada en `main` (P14-04; corregido el 9-oct-2026).**
**Fecha:** 2026-09-21
**Continúa:** plan 12 (Fase 3). Guía de origen: Fase 4 de `docs/rediseno/files/rediseno-visual-recomendaciones.md` (matriz pantallas × estados × viewports y revisión de contraste).

---

## 1. Método
La guía pide una matriz de pantallas × estados × tamaños y una revisión de contraste "a ojo". En lugar de revisar a mano 57 combinaciones, se midió **en el navegador real** (Playwright + Chromium) contra el backend y los datos de la tienda de prueba:

| Comprobación | Cómo se mide |
|---|---|
| **Contraste** | Para cada texto visible: color efectivo (incluye opacidad de los ancestros) sobre el fondo compuesto real (capas semitransparentes) → razón WCAG. Umbral 4,5:1 (3:1 si el texto es grande). Se excluyen textos deshabilitados, ocultos y decorativos (`aria-hidden`). |
| **Desborde de página** | `scrollWidth > innerWidth`. |
| **Contenido que se sale de su caja** | Hijos que sobresalen del contenedor, cifras partidas en varias líneas. |
| **Foco con teclado** | Se pulsa Tab por los primeros 30 elementos interactivos de cada pantalla y se compara la firma de estilos (contorno, sombra, borde, fondo) antes/después del foco. |
| **Hover** | Se pasa el mouse por los primeros 14 botones/enlaces visibles y se compara la firma de estilos. |
| **Estados** | Capturas de error, cargando, vacío, deshabilitado y modales. Los errores se simulan **en el navegador** (`page.route`); ninguna petición de escritura llegó al backend. |

Alcance: **19 pantallas × 3 tamaños (1440, 1024 y 390 px) = 57 combinaciones**. Mismo método de acceso del plan 09 (sesión reutilizada, código TOTP generado desde el secreto sin desactivar el 2FA, solo lectura). Para no agotar los límites de peticiones del backend, las GET se cachean y se reutilizan entre tamaños.

## 2. Resultados

| Métrica | Primera pasada | Pasada final |
|---|---:|---:|
| Textos bajo el umbral de contraste | **807** (132 combinaciones distintas) | **0** |
| Desborde horizontal de la página | 0 | 0 |
| Errores JS de página | 0 | 0 |
| Foco con Tab sin indicador visible | 5 de 468 (campos de texto) | 0 de 468 |
| Hover sin cambio visible | 12 de 228 | 12 de 228 (todos el enlace activo del menú, correcto) |
| Contenido que se salía de su caja | ver 3.3 | 0 |
| Tests unitarios / lint frontend / lint backend / build | — | 140 ✅ / 0 / 0 / ✅ (CSS 79,5 kB) |

> El foco depende del auto-enfoque de algunos campos al cargar la página, por lo que ese conteo puede variar entre pasadas; el indicador global (`:focus-visible`, contorno de 3 px en azul, blanco sobre superficies oscuras) se confirmó a ojo en `estados/foco-*.jpg`.

## 3. Qué se corrigió

### 3.1 Contraste
- **Token `slate-500`: `#6A6F99` → `#62678F`.** Sobre `papel` (`#EEF0F8`) daba 4,25:1; ahora ≈ 4,8:1 (5,4:1 sobre blanco). Corrige de una vez las 155 apariciones de `text-slate-500` sin tocar el JSX.
- **Texto informativo en gris claro:** `text-slate-400` (222 usos, 2,96:1) → `text-slate-500`; `text-slate-300` como texto (1,67:1 en algunas etiquetas) → `text-slate-500`. Los íconos (etiquetas en mayúscula y `<svg>`) no se tocaron. Sobre superficies **oscuras** se conservan `slate-300/400` (barra lateral, cabecera de Aprendizaje, banner del Perfil, leyendas de Analítica).
- **Estados en texto:** `text-amber-500/600` → `text-aviso`; `text-rose-400/500` → `text-peligro`; `text-emerald-500` → `text-exito`. `ambar` queda solo para rellenos, como manda el plan. Botones `bg-emerald-500` con texto blanco (4,3:1) → `bg-exito`.
- **Opacidad sobre texto:** se quitó donde bajaba el contraste (fechas de alertas, notas de Comunicados, campos de solo lectura del Perfil, etc.); las filas excluidas del Simulador pasan de `opacity-75` a `opacity-90`.
- **Glifos decorativos** (`▼`, `📅`): `aria-hidden`.
- **Colores de serie usados como texto** (conteos de la Analítica): pasan a `text-tinta`; el color de la serie queda en el punto de la leyenda.

### 3.2 Estados que faltaban
- **Pantalla de carga inicial (`AppLoader`).** El proveedor de sesión hacía `{!loading && children}`: mientras se verificaba la sesión la aplicación quedaba **completamente en blanco**. Si el servidor tarda (arranque en frío de la base de datos) parecía rota. Ahora muestra un spinner y "Cargando StockPilot…" (`role="status"`).
- **Estado de error de carga (`ErrorState`).** Antes, si la petición fallaba, Cartera decía "No hay clientes registrados." y Productos "No se encontraron productos registrados": **un error se presentaba como una lista vacía** y el total de la cartera mostraba `$0`. Ahora ambas pantallas muestran "No pudimos cargar…" con botón **Reintentar**, y el total muestra "—". Es exactamente lo que vio el usuario cuando falló Fiados en producción (plan 15).

### 3.3 Tamaños de pantalla (1024 y 390 px)
La medición de desborde de página no veía contenido recortado o partido dentro de las tarjetas. La pasada de "contenido que se sale de su caja" encontró y se corrigió:

| Pantalla | Problema | Corrección |
|---|---|---|
| Dashboard | Cifras del KPI partidas (`$2.343.07` / `0`) por `break-all`; tarjetas del Consejero de 175 px con chips que se salían; "Ver detalles →" partido; propuestas de venta en 3 columnas de 220 px | `whitespace-nowrap` y tamaño escalado; a < 1280 px el Consejero ocupa el ancho completo (2 columnas) y los widgets laterales pasan debajo; propuestas en 2 columnas hasta `xl` |
| Punto de venta | La barra de pestañas se cortaba en móvil (la primera quedaba a medias) | Desplazable horizontalmente, sin partir textos |
| Perfil | Chips "Administrador" / "ACTIVO" y banner oscuro salían de la tarjeta | `flex-wrap` |
| Auditoría | Filtros cortados a la derecha en móvil | `flex-wrap` |
| Analítica | Leyendas en una sola fila que se salían | `flex-wrap` |
| Reportes | A 1024 px el formulario quedaba en 200 px y la tabla, cortada | Una columna hasta `xl` |

## 4. Matriz de verificación

| Estado | Pantallas / casos | Evidencia | Resultado |
|---|---|---|---|
| **Vista en 3 tamaños** | Las 19 (login, recuperación, registro + 16 autenticadas) | `capturas/fase4/{pantalla}-1024.jpg` y `-390.jpg`; 1440 en `capturas/fase3/` | ✅ sin desborde ni errores JS |
| **Contraste** | Las 57 combinaciones | auditoría en navegador | ✅ 0 textos bajo el umbral |
| **Foco (Tab)** | 468 elementos en 19 pantallas | `estados/foco-login-input`, `foco-login-boton`, `foco-sidebar`, `foco-boton-primario` | ✅ |
| **Hover** | 228 elementos | `estados/hover-boton-primario`, `hover-sidebar` | ✅ |
| **Deshabilitado** | Cobrar (POS), Ejecutar movimiento, Confirmar y Facturar | `estados/pos-cobrar-deshabilitado`, `movimientos-ejecutar-deshabilitado` | ✅ |
| **Error** | Login (credenciales, sesión activa, 2FA), Cartera, Productos | `estados/login-error`, `login-conflicto`, `login-2fa`, `login-error-390`, `cartera-error`, `productos-error`, `recuperacion-paso2` | ✅ corregido (3.2) |
| **Cargando** | Sesión, Dashboard, Productos, Alertas, Cartera | `estados/app-cargando-sesion`, `dashboard-cargando`, `productos-cargando`, `alertas-cargando`, `cartera-cargando` | ✅ corregido (3.2) |
| **Vacío** | Productos sin resultados, Cartera sin clientes | `estados/productos-vacio`, `cartera-vacio` | ✅ |
| **Modales** | Confirmar borrado, promoción manual, egreso, caja | `estados/modal-confirmar`, `modal-promo`, `modal-egreso`, `modal-caja` | ✅ (ver observación 5.1) |

## 5. Observaciones (no modificadas; requieren decisión)
1. **La barra lateral queda por encima del fondo de los modales** (`z-[200]` frente a `z-50`/`z-[100]`): se ve sin oscurecer y se puede pulsar con un cobro o un arqueo a medias. Es visible en todas las capturas `modal-*`. Defecto de UX; la corrección es subir los fondos de modal por encima del menú.
2. **Los avisos (toasts) tapan los botones de acción de la esquina superior derecha** ("Nuevo cliente", "Registrar producto") durante ~5 s. Conviene moverlos a la parte inferior o al centro.
3. **En desarrollo (React StrictMode) los avisos de error salen duplicados** porque el efecto de carga corre dos veces; en producción sale uno.
4. **Si falla la consulta de la caja, el modal ofrece "Abrir caja"** aunque haya un turno abierto (la falta de respuesta se interpreta como "sin sesión"). Se observó una vez al agotarse el límite de peticiones del backend. Conviene distinguir "sin turno" de "no se pudo consultar".
5. `text-slate-400` queda en 13 usos (íconos y superficies oscuras) y `text-rose-500` en 18 (íconos, superficies oscuras y variantes `hover:`); la medición de contraste no encontró fallas en ellos.
6. La columna de producto en Productos y Movimientos sigue partiendo los nombres largos en 3 líneas (plan 12).

## 6. Cierre del rediseño
Con esta fase quedan hechas las Fases 0, 1, 1b, 2, 3 y 4 del plan. Pendiente de decisión del usuario: las observaciones de la sección 5 (en el seguimiento: P09-01, P14-01, P14-02 y P12-02). Las ramas ya están en `main`.
