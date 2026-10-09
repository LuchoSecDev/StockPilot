# Plan 09: Rediseño Visual — Paleta "cuaderno del tendero" y Sistema de Tokens

**Estado:** Fases 0, 1, 1b y 2 implementadas y verificadas. **Fase 3 (tipografía y forma): ver plan 12. Fase 4 (verificación): ver plan 14.**
**Fecha:** 2026-09-19
**Rama:** `feature/rediseno-visual` (mezclada en `main`, igual que las fases 3 y 4: P14-04)
**Guías de origen:** `docs/rediseno/files/` (`CONTEXTO-REDISENO.md`, `rediseno-visual-recomendaciones.md`, `adenda-plan-rediseno.md`, `implementation_plan remodelación.md`). Precedencia: adenda > plan de recomendaciones > contexto.

---

## 1. Contexto y objetivo

La interfaz original se sentía genérica ("SaaS con IA"): `slate-800` + índigo, degradados, "glows" de color, todo en MAYÚSCULAS ITÁLICAS de peso 900 y etiquetas de 8–10 px. Primero se rediseñó la landing (`LandingPage.jsx`) con una identidad propia y este plan lleva **la misma paleta a toda la aplicación** sin tocar lógica, props, rutas ni backend.

**Concepto:** el mundo del tendero. Azul del esfero con que se anota el cuaderno, tinta, papel y un amarillo de resaltador usado con moderación.

| Token | Valor | Uso |
|---|---|---|
| `tinta` / `tinta-2` | `#14173F` / `#3A3F6E` | texto base y fondos oscuros / texto secundario |
| `azul` / `azul-hondo` | `#252C93` / `#1C2277` | acción principal en superficies **claras** / hover |
| `papel` | `#EEF0F8` | fondo de la app |
| `resaltador` / `resaltador-hondo` | `#FFD84A` / `#FFC81A` | acción principal en superficies **oscuras** y CTA puntual |
| `exito` · `peligro` · `aviso` (+ `-suave`) | `#0B6B45` · `#B42A26` · `#8A5300` | estados |
| `ambar` | `#E08A00` | solo rellenos, barras e íconos. **Nunca texto** |

Reglas de contraste ya calculadas (no negociables): azul sobre tinta = **1,52:1** (no usar azul sobre fondo oscuro); resaltador sobre blanco = 1,38:1 (necesita anillo); `slate-400` sobre blanco = 2,96:1 (solo decorativo).

**Stack:** React 19 + Vite 5 + Tailwind **v4.2** vía `@tailwindcss/vite`. No hay `tailwind.config.js`: los tokens viven en `@theme` dentro de `frontend/src/index.css`.

---

## 2. Qué se hizo, por fase

| Commit | Fase | Contenido |
|---|---|---|
| `7718dc5` | 1 | Bloque `@theme` con marca, estados y neutros con matiz azul; reasignación de las rampas `indigo/violet/purple/fuchsia`, `emerald`, `rose`, `amber`; `theme-color`/`manifest`; `data-surface="dark"`. |
| `02b46b6` | 1b | Superficies con hex escrito a mano: fondos de las vistas de acceso a `bg-tinta` plano (sin degradado ni "blobs"), Sidebar a `bg-tinta` con ítem activo `border-l-4 border-resaltador`, `DashboardLayout` a `bg-papel`, botón de Recuperación en azul. |
| `34b3807` | 2 · A | Estructura y acceso: Sidebar, layout, Login, Registro, Recuperación, Forzar clave, RegistroTendero, App, `ToastContext`. |
| `1447867` | 2 · B | Uso diario: Dashboard, Productos, POS, Alertas, notificaciones y modales. |
| `7fef9a9` | 2 · C | Resto de pantallas + `src/theme/chartColors.js` (gráficas sin hex sueltos). |
| `8ae43d7` | lint | 79 hallazgos de ESLint corregidos en frontend y backend (ver plan 10). |
| `06164b4` | decisión 7.1 | Botones `Cobrar` y `Confirmar y Facturar` en amarillo resaltador (opción A). |

### 2.1 Migración a tokens (Fase 2)
Se aplicó la tabla de equivalencias del plan con un script de reemplazo por *token de clase* (no por texto), respetando variantes (`hover:`, `focus:`, `group-hover:`…) y preservando finales de línea CRLF/LF. Después se revisó cada archivo a mano.

| Actual | Nuevo |
|---|---|
| `bg-indigo-600`, `bg-violet-600`, `bg-blue-*` | `bg-azul` (hover `bg-azul-hondo`) |
| `text-indigo-*` (superficie clara) | `text-azul` |
| `bg-indigo-50/100` | `bg-azul/10` |
| `border-*`/`ring-indigo-*` | `border-azul/30`, `ring-azul/30` (tonos fuertes: `border-azul`) |
| `bg-slate-900/800`, `text-slate-900/800` | `bg-tinta`, `text-tinta` |
| `text-slate-700` | `text-tinta-2` |
| overlays de modal `bg-slate-900/40|50|60` | `bg-tinta/60` |
| `shadow-indigo-*` y demás sombras de color, glows `shadow-[0_0_…]`, gradientes, blobs con blur | eliminados |
| `emerald-600/100`, `rose-600/100`, `amber-700/100` | `exito/-suave`, `peligro/-suave`, `aviso/-suave` (mismo hex: renombre sin pérdida) |
| `bg-amber-500` (rellenos) | `bg-ambar` |
| `red-*`, `orange-*`/`yellow-*` | `rose-*`, `amber-*` |
| etiquetas de formulario `text-[10px] font-bold text-slate-400 uppercase…` | `text-xs font-semibold text-slate-600` |

### 2.2 Decisiones de diseño tomadas durante la implementación
- **Sobre fondo oscuro no se usa azul.** En el hero de Aprendizaje, el banner del Perfil, el panel "Ritmo de caja" y los tooltips de las gráficas, el texto secundario va en `white/70` y la acción o serie protagonista en `resaltador`. También el botón de colapsar del Sidebar.
- **`aviso` en lugar de `ambar` cuando hay texto blanco encima** (toast de advertencia, alerta de bienvenida): blanco sobre `#E08A00` da 2,7:1.
- **Recuperación, paso 3:** botón azul (antes verde), para que el flujo de acceso tenga un solo botón primario.
- **Tooltips oscuros de gráficas:** el valor va en blanco con un punto del color de la serie (el color de la serie no se lee sobre tinta).
- **Estados deshabilitados** de botones según la regla: `disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed`.

### 2.3 Gráficas (`src/theme/chartColors.js`)
Recharts pinta con atributos SVG, no con clases, así que los colores viven en un objeto `CHART` (`primary`, `secondary`, `positive`, `negative`, `soft`, `neutral`, `onDark` + colores de ejes/rejilla). Analítica, Aprendizaje y Reportes ya no llevan hex sueltos. Sobre el panel oscuro "Ritmo de caja" la serie protagonista usa `CHART.onDark` (resaltador). Todos los ejes pasaron de 8–10 px a 12 px.

### 2.4 Decisión 7.1 — botón de cobro (opción A, **decisión final**)
El usuario pidió probar primero la **opción A** y tras revisarla la confirmó ("buen contraste"): `Cobrar` (`CajaRapidaTab.jsx`) y `Confirmar y Facturar` (`PaymentModal.jsx`) pasan a
`bg-resaltador text-tinta ring-1 ring-tinta/25 hover:bg-resaltador-hondo` — "la acción que mueve dinero" es el único elemento amarillo del POS. Ambos botones usan el mismo estado deshabilitado (`disabled:bg-slate-200 disabled:text-slate-500 disabled:ring-0`), en lugar de un amarillo desvaído por opacidad; el spinner de `Confirmar y Facturar` pasa a `border-tinta` para leerse sobre amarillo. Verificado con datos reales en `pos-carrito`, `pos-pago` y `pos-pago-listo`. La opción B (verde `exito`) queda descartada.

---

## 3. Resultados medidos

| Métrica | Antes | Después |
|---|---|---|
| CSS compilado | 113,39 kB (17,06 kB gzip) | **84,8 kB (13,8 kB gzip)** |
| Ocurrencias `indigo/violet/purple/fuchsia` en JSX | 734 | **0** |
| Sombras de color y glows | 128 | **0** |
| Hex de la paleta vieja fuera de `index.css` | 100 (13 archivos) | **0** |
| `bg-[#334155]`, `border-[#334155]`, `bg-[#f8fafc]` | 3 | **0** |
| Botones primarios distintos en el flujo de acceso/cobro | 4 | 1 azul (acceso) + 1 amarillo (cobro) |
| Archivos `frontend/src` tocados por el rediseño | — | 49 (+ `chartColors.js`) |

Criterios de aceptación de la Fase 2 (todos en 0):
```bash
grep -rEn --include='*.jsx' --include='*.js' -e '-(indigo|violet|purple|fuchsia)-[0-9]' frontend/src   # 0
grep -rEn --include='*.jsx' --include='*.js' -e 'shadow-(indigo|violet|rose|emerald|amber)-[0-9]|shadow-\[0_0_' frontend/src   # 0
grep -rEn --include='*.jsx' --include='*.js' -e '#(6366f1|4f46e5|4338ca|818cf8|8b5cf6|1e293b|0f172a|334155)' frontend/src   # 0
```
Al terminar se retiraron del `@theme` las rampas transitorias `indigo/violet/purple/fuchsia` y las familias sueltas; se conservan `slate`, `emerald`, `rose` y `amber`.

---

## 4. Cómo se verificó

1. **Build y lint** tras cada grupo (`npm run build`; `npm run lint`, que quedó en 0 problemas, ver plan 10).
2. **Capturas** en `docs/rediseno/capturas/antes/` (commit `c5839ce`, anterior al rediseño, servido desde un `git worktree` temporal en el puerto 5174) y `docs/rediseno/capturas/despues/` (rama actual, puerto 5173), a 1440×900 y 390×844, contra el backend real (`localhost:3000`) y la tienda de prueba. Las capturas son JPEG (calidad 80) para no inflar el repositorio.

### Capturas (antes / después)
Toda captura de este listado se hizo con datos reales de la tienda de prueba, sin escribir en la BD.

| Pantalla | Antes | Después |
|---|---|---|
| Alertas · 1440 px | [antes](../rediseno/capturas/antes/alertas-1440.jpg) | [después](../rediseno/capturas/despues/alertas-1440.jpg) |
| Analítica · 1440 px | [antes](../rediseno/capturas/antes/analitica-1440.jpg) | [después](../rediseno/capturas/despues/analitica-1440.jpg) |
| Aprendizaje · 1440 px | [antes](../rediseno/capturas/antes/aprendizaje-1440.jpg) | [después](../rediseno/capturas/despues/aprendizaje-1440.jpg) |
| Auditoría · 1440 px | [antes](../rediseno/capturas/antes/auditoria-1440.jpg) | [después](../rediseno/capturas/despues/auditoria-1440.jpg) |
| Cartera (Fiados) · 1440 px | — (la pantalla no existía) | [después](../rediseno/capturas/despues/cartera-1440.jpg) |
| Colaboradores · 1440 px | [antes](../rediseno/capturas/antes/colaboradores-1440.jpg) | [después](../rediseno/capturas/despues/colaboradores-1440.jpg) |
| Comunicados · 1440 px | [antes](../rediseno/capturas/antes/comunicados-1440.jpg) | [después](../rediseno/capturas/despues/comunicados-1440.jpg) |
| Dashboard · 1440 px | [antes](../rediseno/capturas/antes/dashboard-1440.jpg) | [después](../rediseno/capturas/despues/dashboard-1440.jpg) |
| Dashboard · 390 px | [antes](../rediseno/capturas/antes/dashboard-390.jpg) | [después](../rediseno/capturas/despues/dashboard-390.jpg) |
| Alerta de bienvenida · 1440 px | [antes](../rediseno/capturas/antes/dashboard-alerta-1440.jpg) | [después](../rediseno/capturas/despues/dashboard-alerta-1440.jpg) |
| Login · 1440 px | [antes](../rediseno/capturas/antes/login-1440.jpg) | [después](../rediseno/capturas/despues/login-1440.jpg) |
| Login · 390 px | [antes](../rediseno/capturas/antes/login-390.jpg) | [después](../rediseno/capturas/despues/login-390.jpg) |
| Movimientos · 1440 px | [antes](../rediseno/capturas/antes/movimientos-1440.jpg) | [después](../rediseno/capturas/despues/movimientos-1440.jpg) |
| Perfil · 1440 px | [antes](../rediseno/capturas/antes/perfil-1440.jpg) | [después](../rediseno/capturas/despues/perfil-1440.jpg) |
| Punto de venta · 1440 px | [antes](../rediseno/capturas/antes/pos-1440.jpg) | [después](../rediseno/capturas/despues/pos-1440.jpg) |
| Punto de venta · 390 px | [antes](../rediseno/capturas/antes/pos-390.jpg) | [después](../rediseno/capturas/despues/pos-390.jpg) |
| POS con carrito · 1440 px | [antes](../rediseno/capturas/antes/pos-carrito-1440.jpg) | [después](../rediseno/capturas/despues/pos-carrito-1440.jpg) |
| Modal de pago · 1440 px | [antes](../rediseno/capturas/antes/pos-pago-1440.jpg) | [después](../rediseno/capturas/despues/pos-pago-1440.jpg) |
| Modal de pago (listo para facturar) · 1440 px | [antes](../rediseno/capturas/antes/pos-pago-listo-1440.jpg) | [después](../rediseno/capturas/despues/pos-pago-listo-1440.jpg) |
| Productos · 1440 px | [antes](../rediseno/capturas/antes/productos-1440.jpg) | [después](../rediseno/capturas/despues/productos-1440.jpg) |
| Modal de producto · 1440 px | [antes](../rediseno/capturas/antes/productos-modal-1440.jpg) | [después](../rediseno/capturas/despues/productos-modal-1440.jpg) |
| Proveedores · 1440 px | [antes](../rediseno/capturas/antes/proveedores-1440.jpg) | [después](../rediseno/capturas/despues/proveedores-1440.jpg) |
| Recuperar contraseña · 1440 px | [antes](../rediseno/capturas/antes/recuperacion-1440.jpg) | [después](../rediseno/capturas/despues/recuperacion-1440.jpg) |
| Recuperar contraseña · 390 px | [antes](../rediseno/capturas/antes/recuperacion-390.jpg) | [después](../rediseno/capturas/despues/recuperacion-390.jpg) |
| Registro · 1440 px | [antes](../rediseno/capturas/antes/registro-1440.jpg) | [después](../rediseno/capturas/despues/registro-1440.jpg) |
| Registro · 390 px | [antes](../rediseno/capturas/antes/registro-390.jpg) | [después](../rediseno/capturas/despues/registro-390.jpg) |
| Reportes · 1440 px | [antes](../rediseno/capturas/antes/reportes-1440.jpg) | [después](../rediseno/capturas/despues/reportes-1440.jpg) |
| Simulador · 1440 px | [antes](../rediseno/capturas/antes/simulador-1440.jpg) | [después](../rediseno/capturas/despues/simulador-1440.jpg) |
| Tiendas · 1440 px | [antes](../rediseno/capturas/antes/tiendas-1440.jpg) | [después](../rediseno/capturas/despues/tiendas-1440.jpg) |

El flujo de cobro (carrito y modales de pago) se capturó **sin confirmar ninguna venta**: solo se llena el carrito en el navegador y se abre el modal. El script registró las peticiones `POST/PUT/DELETE` durante la prueba: **ninguna**.

### 4.1 Cómo se resolvió el 2FA en las pruebas (sin desactivarlo)
El usuario `admin` de la tienda de prueba tiene 2FA activo. En lugar de **desactivar** la función (que habría modificado la BD y dejado la cuenta con menos seguridad), el script de pruebas:

1. Inicia sesión por la interfaz con usuario y contraseña. **La contraseña se pasa por la variable de entorno `STOCKPILOT_TEST_PASS`; nunca se escribe en el código ni se commitea.**
2. Ante la pantalla "Código de 6 dígitos", lee `two_factor_secret` del usuario en la BD local (solo `SELECT`) y genera el código vigente con `otplib` (`authenticator.generate(secreto)`), exactamente el mismo algoritmo TOTP que usa la app del autenticador.
3. Guarda el estado de la sesión (`storageState` de Playwright) en un archivo **fuera del repositorio** y lo reutiliza para todas las capturas.

**Por qué guardar la sesión:** el backend limita `/api/2fa/verify` a **5 intentos por 15 minutos** (`middleware/rateLimiter.js`). Varios inicios de sesión seguidos activan el 429; la solución correcta es iniciar sesión una vez y reutilizar la sesión, no saltarse el limitador.

Además, la propia aplicación **impide desactivar el 2FA a los administradores** (`authController.disable2FA` responde 403 por política de seguridad), así que generar el código TOTP es el único camino que no obliga a tocar la BD.

**Otros límites del backend que conviene conocer al automatizar pruebas** (`middleware/rateLimiter.js`): global 600 peticiones/15 min por usuario, IA (`/api/ia`) 60/15 min, login 10 fallidos/15 min. Cuando se agotan, la sesión puede caer y la app redirige a `/login`. Por eso el script de capturas verifica tras cada navegación que no se haya redirigido a `/login`, procesa las rutas por lotes y, si el límite se agota, espera a que se reinicie la ventana (cabecera `RateLimit-Reset`) en vez de reintentar. Al terminar se borró el archivo de sesión guardada.

### 4.2 Solo lectura
Las pruebas con backend real **no confirman ventas, no abren ni cierran caja y no guardan formularios**. Solo navegan y abren modales para capturarlos.

---

## 5. Pendiente

- **Fase 3 (tipografía y forma):** implementada en la rama `feature/rediseno-fase3`, ver `docs/planes/12_rediseno_fase3_tipografia_y_forma.md`.
- **Fase 4 (verificación):** implementada en la rama local `feature/rediseno-fase4`, ver `docs/planes/14_rediseno_fase4_verificacion.md`.

## 6. Observaciones fuera del alcance visual (reportadas, no corregidas salvo indicación)

- **El sidebar (`z-[200]`) queda por encima del overlay de los modales** (`z-[100]` en `PaymentModal`): con el modal de pago abierto se puede navegar con un cobro a medias. Defecto de UX confirmado en las capturas.
- **Auditoría:** 5 tarjetas en `lg:grid-cols-4` dejan la quinta ("Última consulta") huérfana. Confirmado en captura.
- **Consejero IA "Sugerido: +0u"** *(resuelto en la rama `fix/consejero-ia-sugerido-cero`, plan 11)*: no era un problema de mapeo; se analizaban productos con stock de sobra.
- **Historial de ventas sin paginación:** `HistorialVentasTab.cargarMasVentas` existe pero nunca se conectó a un botón; solo se ve la primera página.
- `react-router-dom` y `axios` están en `devDependencies` y son dependencias de ejecución.
- Chunks > 500 kB (`index` 636 kB, `ui` 437 kB): carga diferida de `recharts` pendiente.
- Un token `--color-*` de `@theme` solo se emite si alguna clase lo usa. `ToastContext` referencia `var(--color-exito|peligro|aviso|azul)` desde JS: si dejaran de existir utilidades que usen esos tokens, dejarían de pintarse.
