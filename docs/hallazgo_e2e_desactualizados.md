# Hallazgo: 7 de las 11 pruebas E2E de Playwright están desactualizadas frente al frontend

**Fecha:** 2026-09-28 (registrado 2026-10-03) · **Estado:** sin corregir, por decisión de Luis ("no los arregles ahora").
**Cómo se midió:** `npx playwright test` en la rama `fix/i0-matriz-roles`, con backend de pruebas contra
`stockpilot_test` (sembrada con `npm run seed`) y frontend de Vite. Resultado: **4 pasan, 7 fallan**.
Los mismos 7 fallan sin los cambios de I0 (no los causó esa rama).

## Los 7 fallos y su causa

| # | Archivo · prueba | Falla | Causa | Evidencia |
|---|---|---|---|---|
| 1 | `dashboard.spec.js` · Login → Dashboard → Inventario | espera `text=Seleccione...` | El login ya no tiene selector de rol (la spec fue escrita en abril) | VERIFIED: `LoginPage.jsx` no contiene «Seleccione» ni `CustomSelect` |
| 2 | `flujo-principal.spec.js` · 1. Registro de Administrador | espera `#nombreTienda` | El registro renombró los campos a `#store_name` y `#store_address` | VERIFIED: `RegisterPage.jsx` líneas 175–189 |
| 3 | `flujo-principal.spec.js` · 2. Inicio de sesión | se queda en `/login` | Depende de la cuenta que debía crear la prueba 1, que falla | INFERRED (no probé la prueba 2 aislada) |
| 4 | `flujo-principal.spec.js` · 3. Crear colaborador | se queda en `/login` | Igual que la 3 | INFERRED |
| 5 | `security.spec.js` · 2. Inyección SQL en login | espera `.Toastify__toast--error` | La app usa su propio `ToastContext`, no la librería Toastify | VERIFIED: ningún `Toastify` en `frontend/src` |
| 6 | `security.spec.js` · 3. XSS en login/registro | espera `#nombreTienda` | Mismo renombrado que la 2 | VERIFIED |
| 7 | `performance.spec.js` · Landing < 1500 ms | midió 5.300 ms | **No es de selectores**: se midió contra el servidor de desarrollo de Vite (módulos sin empaquetar). El umbral tendría sentido contra `vite build` + `preview` | INFERRED: no medí contra el build |

Las 4 que pasan: carga de la página de login, error con credenciales inválidas, y las dos rutas protegidas
sin sesión de `security.spec.js`.

## Qué implica
- Estas pruebas hoy **no protegen nada**: tres de los flujos centrales (registro, login con cuenta nueva, alta de
  colaborador) no tienen cobertura E2E efectiva, y la prueba de inyección SQL no llega a comprobar lo que dice.
- La pieza que sí cubre esos flujos son las pruebas de integración (`tests/integration/`), pero esas no ejercitan la interfaz.
- Además, `dashboard.spec.js` depende del usuario `admin/admin123` de la semilla, que ahora solo se puede crear con
  `npm run seed` (guardia: base local `_test`, o `--base-local`).
- Al reactivarlas hay que considerar el 2FA obligatorio del Administrador (`needs2FASetup`): sin una cuenta con 2FA ya
  configurado o un modo de pruebas explícito, la interfaz del Administrador queda bloqueada tras el login.

## Alcance sugerido para cuando se decida arreglarlas (no se hizo)
1. Actualizar selectores (`#store_name`, `#store_address`, sin selector de rol) y el chequeo de errores a lo que
   renderiza `ToastContext`.
2. Decidir cómo manejar el 2FA del Administrador en E2E.
3. Mover la prueba de rendimiento a `vite build` + `preview` (o subir el umbral para el servidor de desarrollo).
4. Añadir un E2E nuevo para lo agregado en I0: el Tendero escanea un código y solo ve «Sumar stock»; no ve
   «Reporte» ni «Activar Oferta».
