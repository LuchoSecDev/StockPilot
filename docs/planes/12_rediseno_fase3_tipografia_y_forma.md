# Plan 12: Rediseño Visual — Fase 3 (Tipografía y Forma)

**Estado:** Implementado y verificado con datos reales
**Fecha:** 2026-09-20
**Rama:** `feature/rediseno-fase3` (sale de `fix/consejero-ia-sugerido-cero`). *Actualización 9-oct-2026:* llegó a `main` con `feature/rediseno-fase4` (P14-04).
**Continúa:** plan 09 (paleta y tokens). Guía de origen: Fase 3 de `docs/rediseno/files/rediseno-visual-recomendaciones.md`.

---

## 1. Por qué
El color era solo una parte del "aire de plantilla": la tipografía y la forma tenían más volumen que el color (1.864 rasgos: todo en MAYÚSCULAS ITÁLICAS de peso 900, etiquetas de 8–10 px, 10 radios distintos). Además `Inter` se declaraba pero **nunca se cargaba** (la app se veía en Segoe UI, distinta en cada equipo) y `font-outfit` (29 usos) era una clase que no existía en ninguna parte.

## 2. Qué se hizo

### 2.1 Fuente y utilidades (`index.html`, `index.css`, `LandingPage.jsx`)
- **Archivo** (variable, ejes de peso y ancho) e **IBM Plex Mono** se cargan **una sola vez** en `index.html` (`preconnect` + `stylesheet`). Se eliminó el `@import` que `LandingPage.jsx` metía dentro de un `<style>` (bloqueaba el render y se repetía en cada montaje). Verificado: 4 peticiones de fuentes en la landing, `Archivo` y `IBM Plex Mono` disponibles.
- `body` usa `var(--font-sans)`; se agregó `--font-mono` al `@theme`.
- **`@utility titular`**: `font-weight: 800; font-stretch: 75%; letter-spacing: -0.005em; line-height: 1` (Archivo condensado, minúscula normal), la misma voz de la landing.
- `@media (prefers-reduced-motion: reduce)` apaga animaciones y transiciones. Sin `!important`: el CSS sin capa gana a `@layer utilities`.
- Se retiró la **textura de grano** (`.grain-bg::before`, un filtro SVG `feTurbulence` sobre toda el área principal); se conservan las reglas de layout de la clase porque el contenedor las usa.

### 2.2 Transformación de clases (46 archivos `.jsx`, salvo la landing)
Un script recorre cada `className` **con contexto del elemento** (etiqueta y texto), no por búsqueda de texto:

| Antes | Después |
|---|---|
| `font-black`, `font-extrabold` | `font-bold`; en `h1–h4` con texto grande (`text-lg` o más) → `titular`; en encabezados pequeños → `font-bold` |
| `uppercase` + `tracking-*` | se quita, **salvo en insignias/chips** (píldoras pequeñas: `ALTA DEMANDA`, `AGOTADO`…), que conservan `uppercase tracking-wide` |
| `italic`, `font-outfit`, `animate-bounce-slow` | eliminados |
| `text-[8px]`…`text-[11px]` | `text-xs` (12 px) |
| `tracking-[…]`, `widest`, `wider`, `tighter` | eliminados |
| `rounded-[2.5rem]`, `[2rem]`, `[3rem]`, `3xl`… (tarjetas y modales) | `rounded-2xl` |
| controles (`input`, `select`, `textarea`, `button`) con `rounded-xl/2xl/3xl/md/[…]` | `rounded-lg` |
| `rounded-xl` en contenedores | `rounded-2xl` (íconos pequeños de ≤ 12 unidades: `rounded-lg`) |
| `rounded-full` | se conserva (avatares, píldoras, íconos circulares) |
| `shadow-2xl`, `shadow-xl` | `shadow-lg` |
| `hover:scale-*`, `hover:-translate-y-*` (decorativos) | eliminados (se conservan `active:scale-*`, que responden a una acción) |
| `backdrop-blur-*` | solo en overlays de modal (`bg-tinta/60` + `backdrop-blur-sm`); el resto, fuera |

**Decisión de diseño (a revisar):** el primer intento conservaba mayúsculas en cualquier texto de ≤ 14 caracteres y dejaba tarjetas hermanas inconsistentes ("PRODUCTOS", "Valor Inventario", "ALERTAS"). Se cambió la regla a **mayúsculas solo en insignias**, para que las etiquetas de un mismo bloque tengan el mismo tratamiento.

## 3. Resultados medidos

| Rasgo (JSX, sin landing) | Antes | Después |
|---|---:|---:|
| `font-black` | 614 | **0** |
| `uppercase` | 543 | **18** (solo insignias) |
| `italic` | 116 | **0** |
| `font-outfit` | 29 | **0** |
| tamaños < 12 px (`text-[8..11px]`) | 432 | **0** |
| `tracking-[…]` / `widest` / `tighter` | 77 / 322 / 111 | **0 / 0 / 0** |
| radios arbitrarios `rounded-[…]` | 123 | **0** |
| `rounded-3xl` / `rounded-xl` | 27 / 178 | **0 / 0** |
| escala de radios | 10 valores | **3**: `lg` (279), `2xl` (281), `full` (102) |
| `backdrop-blur` | 39 (`sm/md/xl`) | **32, todos `-sm` en overlays** |
| `shadow-2xl` / `shadow-xl` | (sin medir) | **0** |
| `hover:scale-*` / `hover:-translate-y-*` | 24 / 18 | **0 / 0** |
| titulares con `titular` | 0 | 88 |
| CSS compilado | 84,8 kB | **79,6 kB** |

Comprobaciones: `npm run lint` (0), `npm run build` (✅), 140 pruebas unitarias (✅), lint del backend (0). Sin errores de página en ninguna de las pantallas capturadas y **ninguna petición de escritura** durante las pruebas del cobro.

## 4. Verificación visual (datos reales de la tienda de prueba)
Capturas en `docs/rediseno/capturas/fase3/`. Método idéntico al del plan 09 (sesión reutilizada, código TOTP generado desde el secreto sin desactivar el 2FA, solo lectura).

| Pantalla | Original | Tras Fase 2 (color) | Tras Fase 3 (tipografía y forma) |
|---|---|---|---|
| Alertas · 1440 px | [original](../rediseno/capturas/antes/alertas-1440.jpg) | [Fase 2](../rediseno/capturas/despues/alertas-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/alertas-1440.jpg) |
| Analítica · 1440 px | [original](../rediseno/capturas/antes/analitica-1440.jpg) | [Fase 2](../rediseno/capturas/despues/analitica-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/analitica-1440.jpg) |
| Aprendizaje · 1440 px | [original](../rediseno/capturas/antes/aprendizaje-1440.jpg) | [Fase 2](../rediseno/capturas/despues/aprendizaje-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/aprendizaje-1440.jpg) |
| Auditoría · 1440 px | [original](../rediseno/capturas/antes/auditoria-1440.jpg) | [Fase 2](../rediseno/capturas/despues/auditoria-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/auditoria-1440.jpg) |
| Cartera (Fiados) · 1440 px | — | [Fase 2](../rediseno/capturas/despues/cartera-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/cartera-1440.jpg) |
| Colaboradores · 1440 px | [original](../rediseno/capturas/antes/colaboradores-1440.jpg) | [Fase 2](../rediseno/capturas/despues/colaboradores-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/colaboradores-1440.jpg) |
| Comunicados · 1440 px | [original](../rediseno/capturas/antes/comunicados-1440.jpg) | [Fase 2](../rediseno/capturas/despues/comunicados-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/comunicados-1440.jpg) |
| Dashboard · 1440 px | [original](../rediseno/capturas/antes/dashboard-1440.jpg) | [Fase 2](../rediseno/capturas/despues/dashboard-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/dashboard-1440.jpg) |
| Dashboard · 390 px | [original](../rediseno/capturas/antes/dashboard-390.jpg) | [Fase 2](../rediseno/capturas/despues/dashboard-390.jpg) | [Fase 3](../rediseno/capturas/fase3/dashboard-390.jpg) |
| Alerta de bienvenida · 1440 px | [original](../rediseno/capturas/antes/dashboard-alerta-1440.jpg) | [Fase 2](../rediseno/capturas/despues/dashboard-alerta-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/dashboard-alerta-1440.jpg) |
| Landing · 1440 px | — | — | [Fase 3](../rediseno/capturas/fase3/landing-1440.jpg) |
| Login · 1440 px | [original](../rediseno/capturas/antes/login-1440.jpg) | [Fase 2](../rediseno/capturas/despues/login-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/login-1440.jpg) |
| Login · 390 px | [original](../rediseno/capturas/antes/login-390.jpg) | [Fase 2](../rediseno/capturas/despues/login-390.jpg) | [Fase 3](../rediseno/capturas/fase3/login-390.jpg) |
| Movimientos · 1440 px | [original](../rediseno/capturas/antes/movimientos-1440.jpg) | [Fase 2](../rediseno/capturas/despues/movimientos-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/movimientos-1440.jpg) |
| Perfil · 1440 px | [original](../rediseno/capturas/antes/perfil-1440.jpg) | [Fase 2](../rediseno/capturas/despues/perfil-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/perfil-1440.jpg) |
| Punto de venta · 1440 px | [original](../rediseno/capturas/antes/pos-1440.jpg) | [Fase 2](../rediseno/capturas/despues/pos-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/pos-1440.jpg) |
| Punto de venta · 390 px | [original](../rediseno/capturas/antes/pos-390.jpg) | [Fase 2](../rediseno/capturas/despues/pos-390.jpg) | [Fase 3](../rediseno/capturas/fase3/pos-390.jpg) |
| POS con carrito · 1440 px | [original](../rediseno/capturas/antes/pos-carrito-1440.jpg) | [Fase 2](../rediseno/capturas/despues/pos-carrito-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/pos-carrito-1440.jpg) |
| Modal de pago · 1440 px | [original](../rediseno/capturas/antes/pos-pago-1440.jpg) | [Fase 2](../rediseno/capturas/despues/pos-pago-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/pos-pago-1440.jpg) |
| Modal de pago (listo para facturar) · 1440 px | [original](../rediseno/capturas/antes/pos-pago-listo-1440.jpg) | [Fase 2](../rediseno/capturas/despues/pos-pago-listo-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/pos-pago-listo-1440.jpg) |
| Productos · 1440 px | [original](../rediseno/capturas/antes/productos-1440.jpg) | [Fase 2](../rediseno/capturas/despues/productos-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/productos-1440.jpg) |
| Modal de producto · 1440 px | [original](../rediseno/capturas/antes/productos-modal-1440.jpg) | [Fase 2](../rediseno/capturas/despues/productos-modal-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/productos-modal-1440.jpg) |
| Proveedores · 1440 px | [original](../rediseno/capturas/antes/proveedores-1440.jpg) | [Fase 2](../rediseno/capturas/despues/proveedores-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/proveedores-1440.jpg) |
| Recuperar contraseña · 1440 px | [original](../rediseno/capturas/antes/recuperacion-1440.jpg) | [Fase 2](../rediseno/capturas/despues/recuperacion-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/recuperacion-1440.jpg) |
| Recuperar contraseña · 390 px | [original](../rediseno/capturas/antes/recuperacion-390.jpg) | [Fase 2](../rediseno/capturas/despues/recuperacion-390.jpg) | [Fase 3](../rediseno/capturas/fase3/recuperacion-390.jpg) |
| Registro · 1440 px | [original](../rediseno/capturas/antes/registro-1440.jpg) | [Fase 2](../rediseno/capturas/despues/registro-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/registro-1440.jpg) |
| Registro · 390 px | [original](../rediseno/capturas/antes/registro-390.jpg) | [Fase 2](../rediseno/capturas/despues/registro-390.jpg) | [Fase 3](../rediseno/capturas/fase3/registro-390.jpg) |
| Reportes · 1440 px | [original](../rediseno/capturas/antes/reportes-1440.jpg) | [Fase 2](../rediseno/capturas/despues/reportes-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/reportes-1440.jpg) |
| Simulador · 1440 px | [original](../rediseno/capturas/antes/simulador-1440.jpg) | [Fase 2](../rediseno/capturas/despues/simulador-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/simulador-1440.jpg) |
| Tiendas · 1440 px | [original](../rediseno/capturas/antes/tiendas-1440.jpg) | [Fase 2](../rediseno/capturas/despues/tiendas-1440.jpg) | [Fase 3](../rediseno/capturas/fase3/tiendas-1440.jpg) |

Lo que se revisó a ojo en cada pantalla: titulares condensados coherentes con la landing, etiquetas consistentes dentro de cada bloque, ningún texto desbordado por el paso de 8–11 px a 12 px, y el botón de cobro amarillo (decisión final **A**, ver plan 09).

## 5. Observaciones
- **Tabla de Movimientos:** la columna "Observaciones" queda fuera de vista y requiere desplazamiento horizontal. Ya ocurría antes de la Fase 3 (visible en las capturas de la Fase 2); conviene reducir columnas o permitir salto de línea.
- **Columna de producto estrecha en Productos y Movimientos:** los nombres largos ("Leche Alqueria Entera 1L") se parten en 3 líneas. Un `min-w` en esa celda lo resuelve.
- **Productos con stock por debajo del mínimo aparecen como "AGOTADO"** aunque tengan unidades (p. ej. Papas Margarita, 11 uds.). Es la lógica de estado, no del diseño; conviene distinguir "Agotado" de "Bajo el mínimo".
- **`titular` fija `line-height: 1`:** en encabezados que se parten en dos líneas quedan muy juntas; si molesta, subir a `1.05` en la utilidad.
- El `text-slate-400` (251 usos) y `text-amber-500` como texto (13) siguen pendientes de la revisión de contraste (Fase 4).

## 6. Pendiente (Fase 4)
Matriz pantallas × estados (hover, foco con Tab, deshabilitado, error, cargando, vacío) × viewports (1440, 1024, 390) y revisión de contraste de los grises de texto.
