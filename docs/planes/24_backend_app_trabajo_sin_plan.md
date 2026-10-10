# Plan 24: Backend para la app del Tendero — registro del trabajo hecho sin plan previo

**Estado (9-oct-2026):** registro. Todo lo de la sección 2 ya está en `main` y subido a `origin`. Este plan no propone código nuevo: deja constancia de lo que se hizo entre el 3 y el 6 de octubre directamente contra el contrato de la app (`docs/contrato_api_app_tendero.md`) y que no tenía plan ni fila en `docs/seguimiento_planes.xlsx`. Quedan dos pendientes (sección 4).
**Fecha:** 2026-10-09
**Origen:** revisión de los planes 01 a 23 contra el historial de git (9-oct). Luis aclaró que esas ramas salieron de sesiones de prueba con otros agentes y que los planes afectados no se actualizaron. La regla del proyecto es que cada cambio quede documentado como evidencia del desarrollo.
**Relacionado con:** plan 07 (app del Tendero, sección 6), plan 21 (P21-09, P21-13 y apertura de caja atómica, P21-14), plan 22 (sección 5, «Backend para la app») y `docs/propuesta_verificacion_de_pagos.md`.

---

## 1. Qué cubre y qué no

- **Sí:** los cambios de comportamiento de la API que entraron con las ramas de la app y que ningún plan describía.
- **No:** lo que ya está en otro plan y en el seguimiento: sesión por canal y `Ventas.canal` (P07-02), limitadores de `verify-reset-code` y del limitador global (P21-09 y P21-13), apertura de caja con transacción y bloqueo (P21-14), recepción con confirmación (P21-10) y modo básico (P19-06).

## 2. Cambios registrados

Cada fila tiene su prueba de integración en `tests/integration/` y su sección en el contrato.

| ID | Qué cambió | Rama y merge a `main` | Pruebas | Contrato |
|---|---|---|---|---|
| P24-01 | **Correcciones del contrato.** El Tendero ya no recibe `costo_compra` ni datos de margen. Una venta fiada exige un cliente de la misma tienda y respeta su cupo de crédito. Un producto inexistente en el carrito responde 404. El historial y las estadísticas usan el precio al que se vendió, no el precio actual. Resolver una alerta inexistente o ajena responde 404. `link-barcode` rechaza códigos duplicados dentro de la tienda (también frente al SKU). Nuevo listado de ventas del turno, con `canal`. `POST /api/forgot-password` limitado (3 por correo y 10 por IP cada 15 minutos). | `feat/backend-app-tendero`, 3-oct (`cb028d9`) | `datos_de_margen`, `ventas_fiado_validaciones`, `ventas_precio_historico`, `link_barcode`, `ventas_turno`, `limitador_olvido_contrasena` | `[C1]`, `[C3]`, `[V2]`, `[V3]`, `[A2]`; resumen en la sección 11 |
| P24-02 | **Idempotencia de la venta** con la cabecera `Idempotency-Key`: la misma clave con la misma venta devuelve la venta ya registrada, con otra venta responde 422. **`metodo_pago` validado:** un «efectivo» en minúscula dejaba la venta fuera del arqueo. | `feat/idempotencia-ventas`, 4-oct (`a4dce1f`) | `ventas_idempotencia`, `ventas_metodo_pago` | `[V2]` |
| P24-03 | **Candado de sesión caducada.** Un Tendero que no cerraba sesión recibía 409 en cada inicio de sesión aunque su sesión ya hubiera caducado. Ahora el candado solo bloquea mientras la sesión siga viva; si el almacén de sesiones falla, se conserva el bloqueo. | `fix/candado-sesion-caducada`, 4-oct (`1c2ee25`) | `sesion_candado_caducada` | `[S2]` |
| P24-04 | **Arqueo previo `[K5]`:** ver la diferencia antes de cerrar la caja. El monto declarado se valida de verdad en `[K3]` y `[K5]` (antes un `null` o un texto pasaban). **Desglose por método de pago** en el arqueo y en el historial (`ventas_por_metodo`, `abonos_por_metodo`). | `feat/caja-arqueo-previo`, 6-oct a las 00:02 (`6ce89ff`) | `contrato_app_tendero › [K5]`, `caja_historial` | `[K3]`, `[K5]` |
| P24-05 | **El historial de sesiones de caja (`GET /api/caja/historial`) es solo del Administrador.** Antes la API se lo entregaba a cualquier usuario con sesión, aunque la web escondiera la pestaña. Es un cambio de la matriz de roles hecho fuera de la fase I0. | `feat/caja-arqueo-previo` (mismo merge) | `caja_historial_autorizacion` | `[K3]` (nota del desglose) y sección 10 |

Además, solo documentación (sin cambio de código): ejemplos reales de petición y respuesta en `docs/ejemplos_app_tendero/` y el tope de la foto de egreso (`docs/contrato-foto-y-ejemplos`, 4-oct); productos sin código de barras, que se buscan por SKU en `[C2]`, y el límite de cantidades enteras (`docs/productos-sin-codigo-de-barras`, 4-oct); y el primer cambio de contraseña `[S7]` (`feat/contrato-cambio-clave`, 4-oct).

## 3. Efectos que conviene tener presentes

- **La matriz de roles creció.** La decisión del 28-sep (D1 a D4, `docs/propuesta_matriz_roles_P22-10.md`) no menciona el historial de caja. Hay que anotarlo allí para que la matriz siga siendo la única referencia (P24-05).
- **El arqueo ya muestra los otros métodos de pago,** así que la opción 2 de `docs/propuesta_verificacion_de_pagos.md` quedó hecha. El sistema sigue sin verificar que un pago con tarjeta o transferencia se haya recibido: el desglose muestra lo que registró el Tendero.
- **La web no envía `Idempotency-Key`:** la protección contra ventas duplicadas por reintento solo aplica a quien la mande (la app).

## 4. Pendientes que salen de aquí

| ID | Pendiente | Cuándo |
|---|---|---|
| P24-06 | Opciones 1 (referencia de pago opcional) y 3 (foto del comprobante) de la propuesta de verificación de pagos. Decisión de Luis del 4-oct: por ahora se confía en lo registrado. | Si la visita o el piloto lo piden (la pregunta va en el guion, P07-03) |
| P24-07 | Solo la venta tiene idempotencia. Según el contrato (sección 1), un egreso `[K4]` o una entrada de mercancía `[M1]` enviados dos veces se registran dos veces. Hoy lo mitiga la app, que consulta el estado antes de reintentar. | Antes de que la app maneje dinero en tiendas reales |

## 5. Cómo se verificó este registro (9-oct-2026)

- Ramas y fechas: reflog de `main` y de `origin/main` en el repositorio local. `origin/main` está en `5faab39` (8-oct, 15:12) e incluye todos los merges de la sección 2.
- Pruebas: los archivos citados existen en `tests/integration/`. **No se ejecutaron en esta revisión**; los resultados en verde son los que registró cada rama al mezclarse.
- Contrato: secciones citadas de `docs/contrato_api_app_tendero.md` (versión del 6-oct).
