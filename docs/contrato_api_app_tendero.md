# Contrato de la API para la app nativa del Tendero

**Estado:** vigente desde la rama `feat/backend-app-tendero` (4-oct-2026). Documento de referencia del plan 07, secciones 6.2 y 6.3.
**Dónde vive y por qué:** en el repositorio del backend, porque la app está en otro repositorio y sus commits no deben disparar despliegues. Cualquier cambio de la API que afecte a la app se acuerda primero aquí.
**Cómo se garantiza que no miente:** cada endpoint tiene un ID (`[S1]`, `[K2]`…) y sus respuestas están fijadas por `tests/integration/contrato_app_tendero.test.js`. Si esa prueba falla, el contrato cambió: se acuerda con quien construye la app y se actualiza este documento. Los casos marcados **COMPORTAMIENTO ACTUAL** son hallazgos conocidos: se describen tal cual funcionan hoy y su prueba fallará a propósito cuando se corrijan.

Todo lo de este documento se verificó ejecutando las peticiones contra el servidor real (`stockpilot_test`); las respuestas son las reales, con datos de ejemplo.

---

## 1. Convenciones generales

| Tema | Regla |
|---|---|
| **Base** | `https://<servidor de Render>` (en pruebas, `http://localhost:3000`). Todas las rutas empiezan por `/api/`. |
| **Formato** | Cuerpos y respuestas en JSON. Enviar `Content-Type: application/json` en las escrituras. |
| **`Accept: application/json`** | **Obligatorio en toda petición.** Sin esa cabecera, una petición sin sesión recibe un **302 a `/`** (HTML), no un 401 JSON. Con ella recibe `401 { "error": "No autenticado" }`. |
| **Origen / CORS** | No hace falta cabecera `Origin`: CORS solo limita a los navegadores. |
| **Sesión** | Cookie `connect.sid` (`HttpOnly`; `Secure` en producción; `SameSite=Strict`, que un cliente nativo ignora). Se renueva con cada petición y **caduca a los 30 minutos sin actividad**. La app debe usar un almacén de cookies persistente y reenviarla siempre. |
| **Canal** | Solo en el login: cabecera **`X-Canal: app`**. Sin ella la sesión cuenta como `web`. Se ignora en cualquier otra petición. Ver `[S2]`. |
| **CSRF** | Toda escritura (`POST`, `PUT`, `PATCH`, `DELETE`) necesita la cabecera **`X-CSRF-Token`**. Las lecturas (`GET`) no. Ver sección 2. |
| **Importes** | Llegan como **texto con dos decimales** (`"4500.00"`). Las cantidades de stock, como número. Convertir con `Decimal`/`double.parse`, no sumar texto. |
| **Fechas** | ISO 8601 en UTC (`"2026-10-04T03:37:18.249Z"`). |
| **Forma del error** | Dos variantes, según el endpoint: `{ "error": "mensaje" }` o `{ "success": false, "error": "mensaje" }`. Mostrar `error` al usuario; decidir por el **código HTTP** y, cuando exista, por `code`. |
| **Límites de uso** | `429` con `{ "success": false, "error": "…" }` cuando se agota un límite (login, 2FA, código de recuperación). Cabeceras `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` en esas rutas. El tope general es 600 peticiones por usuario cada 15 minutos. |
| **Servidor dormido** | Render gratuito se duerme a los 15 minutos sin tráfico y tarda cerca de un minuto en responder la primera petición. Usar un tiempo de espera largo (≥ 60 s) en la primera, y mostrar «conectando…». |
| **Idempotencia** | **No existe.** Una venta, un egreso o una entrada enviados dos veces **se registran dos veces**. Ante un tiempo de espera, la app no debe reintentar a ciegas una escritura: primero consulta el estado (por ejemplo `GET /api/ventas` o `GET /api/caja/sesion`) o pide confirmación al usuario. |

## 2. Flujo de sesión paso a paso

```
1. POST /api/login            (X-Canal: app, sin CSRF)         → 200 { user }   |  200 { require2FA } | 409 | 401
2. GET  /api/csrf-token       (con la cookie de sesión)         → 200 { csrfToken }
3. [si require2FA]  POST /api/2fa/verify  (X-CSRF-Token)       → 200 { user }
4. GET  /api/session-info     (opcional)                        → userId, tiendaId, rol, límite de egreso…
5. …cualquier escritura con  X-CSRF-Token: <el token del paso 2>
6. POST /api/logout           (X-CSRF-Token)                    → 200
```

Reglas del token CSRF:
- Se **pide después** de iniciar sesión (paso 2). El login regenera la sesión, así que **un token pedido antes del login deja de valer**.
- Con 2FA, se pide después del paso 1 (la sesión «a medias» ya tiene cookie) y **sigue valiendo** después del paso 3.
- El token es el mismo mientras dure la sesión: no hace falta pedir uno nuevo por cada escritura.
- Ante un `500` con el mensaje `Error interno: invalid csrf token`, volver a pedir el token y reintentar **una vez** (ver la nota C4 más abajo).

**Una sesión por canal.** Un Tendero puede tener a la vez una sesión `web` y una `app`. Un segundo login en el mismo canal recibe `409 SESSION_ACTIVE`; la app puede ofrecer «cerrar la otra sesión» y repetir el login con `"force": true`, lo que invalida solo la sesión de la app anterior. El Administrador no tiene este candado.

---

## 3. Sesión y seguridad

### [S1] `GET /api/csrf-token`
Sin cuerpo. **200** `{ "csrfToken": "<64+ caracteres hexadecimales>" }`. Funciona con o sin sesión; el token pertenece a la sesión actual.
**Prueba:** `contrato_app_tendero.test.js › [S1]`.

### [S2] `POST /api/login`
Sin CSRF. Cabecera opcional `X-Canal: app` (mayúsculas y espacios se toleran; cualquier otro valor cuenta como web).
**Cuerpo:** `{ "login": "<usuario o correo>", "password": "…", "force": true? }`

| Código | Cuerpo | Cuándo |
|---|---|---|
| **200** | `{ "success": true, "message": "Login exitoso", "user": { "nombres", "rol": "Tendero"\|"Administrador", "cambioClaveForzoso": false, "needs2FASetup": false } }` | Credenciales correctas, sin 2FA. Deja la cookie de sesión. |
| **200** | `{ "success": true, "require2FA": true, "message": "…" }` | La cuenta tiene 2FA: falta el código (`[S3]`). **Todavía no hay sesión**: cualquier ruta protegida da 401. |
| **400** | `{ "success": false, "error": "Faltan campos obligatorios" }` | Falta `login` o `password`. |
| **401** | `{ "success": false, "error": "Usuario/correo o contraseña incorrectos" }` | Mismo mensaje para usuario inexistente y clave mala. |
| **409** | `{ "success": false, "error": "…", "code": "SESSION_ACTIVE" }` | Un **Tendero** ya tiene sesión **en ese canal**. Repetir con `"force": true` la reemplaza. |
| **429** | `{ "success": false, "error": "…" }` | 10 intentos fallidos por IP cada 15 min (un 409 también cuenta como fallido). |

Notas para la app: si `cambioClaveForzoso` es `true`, la cuenta debe cambiar la contraseña antes de usarla (en la web: `PUT /api/perfil/first-password`; **no forma parte de esta versión de la app**). Si `needs2FASetup` es `true` (Administrador sin 2FA configurado), la configuración inicial se hace en la web.
**Pruebas:** `contrato_app_tendero.test.js › [S2]`; el candado por canal, `sesion_por_canal.test.js`.

### [S3] `POST /api/2fa/verify` — completar el login con segundo factor
Con `X-CSRF-Token` (pedido tras el login). **Cuerpo:** `{ "token": "123456" }` (código de 6 dígitos de la app autenticadora).

| Código | Cuerpo | Cuándo |
|---|---|---|
| **200** | `{ "success": true, "message": "Login completado exitosamente", "user": { …igual que [S2] } }` | Código correcto. Desde aquí la sesión es válida. El canal es el del paso de la contraseña (esta petición no lo puede cambiar). |
| **400** | `{ "success": false, "error": "Token es requerido" }` | Sin `token`. |
| **401** | `{ "success": false, "error": "Código inválido o ha expirado." }` | Código incorrecto; la sesión sigue «a medias». |
| **401** | `{ "success": false, "error": "No autorizado o sesión expirada" }` | No hubo login previo (o caducó). |
| **429** | `{ "success": false, "error": "…" }` | 5 códigos incorrectos de la misma cuenta cada 15 min. |

**Prueba:** `contrato_app_tendero.test.js › [S3]`; canal con 2FA en `sesion_por_canal.test.js`.

### [S4] `GET /api/session-info`
**200** `{ "success": true, "userId", "tiendaId", "tiendaNombre", "limiteEgresoTendero": "150000.00", "rol", "nombres", "cambioClaveForzoso", "needs2FASetup", "is2FAEnabled" }`. **401** `{ "success": false, "error": "Sesión no iniciada" }` sin sesión.
Es la forma de conocer `userId`, `tiendaId` y el tope de egresos del Tendero (el login no los devuelve). No valida el candado concurrente: usar una ruta protegida (p. ej. `[K1]`) para comprobar que la sesión sigue viva.
**Prueba:** `contrato_app_tendero.test.js › [S4]`.

### [S5] `POST /api/logout`
Con `X-CSRF-Token`. **200** `{ "success": true, "message": "Sesión cerrada" }`. Destruye la sesión y libera el candado de **su** canal (no el del otro). Funciona aunque la sesión ya hubiera sido invalidada.
**Prueba:** `contrato_app_tendero.test.js › [S5]`; casos finos en `sesion_por_canal.test.js`.

### [S6] Errores que pueden salir en cualquier endpoint protegido

| Código | Cuerpo | Qué hacer |
|---|---|---|
| **401** | `{ "error": "No autenticado" }` | Sin sesión o sesión caducada: volver a la pantalla de login. |
| **401** | `{ "error": "Sesión cerrada", "message": "…", "code": "CONCURRENT_SESSION" }` | Otra sesión del mismo canal la reemplazó (login con `force`). Avisar y volver al login. |
| **302** a `/` | HTML | Faltó `Accept: application/json`. Es un error de la app, no del servidor. |
| **403** | `{ "error": "Se requieren permisos de administrador" }` | La acción es solo del Administrador. Ocultar el control. |
| **500** | `{ "success": false, "error": "Error interno: invalid csrf token" }` | **COMPORTAMIENTO ACTUAL (C4):** un CSRF faltante o inválido responde 500 en vez de 403. Pedir un token nuevo (`[S1]`) y reintentar una vez. Si el 500 persiste con un token fresco, es un error real. |
| **429** | `{ "success": false, "error": "…" }` | Esperar; `RateLimit-Reset` indica cuándo. |

**Pruebas:** `contrato_app_tendero.test.js › [S6]`; los 403 de cada ruta del Administrador, en `autorizacion_roles.test.js`.

---

## 4. Catálogo

### [C1] `GET /api/productos`
**200** un **arreglo** (sin paginación) con todos los productos de la tienda de la sesión. Campos que usa la app: `id_producto`, `codigo`, `codigo_barras` (puede ser `null`), `nombre_producto`, `categoria`, `precio` (texto), `cantidad` (número), `stock_minimo`, `estado` (`"Disponible"`/`"Inactivo"`), `nivel_stock` (`"agotado"`, `"critico"`, `"reponer"` u `"ok"`), `fecha_vencimiento`.
**COMPORTAMIENTO ACTUAL:** la respuesta al Tendero incluye también `costo_compra` y `clasificacion_abc` (datos del margen del negocio). La app no debe mostrarlos.
**Prueba:** `contrato_app_tendero.test.js › [C1]`.

### [C2] `GET /api/productos/barcode/:code`
**200** `{ "success": true, "data": { …producto } }` · **404** `{ "success": false, "error": "Producto no encontrado" }` (no existe, o es de otra tienda). Es la consulta del escáner al vender.
**Prueba:** `contrato_app_tendero.test.js › [C2]`.

### [C3] `PUT /api/productos/:id/link-barcode`
Con CSRF. **Cuerpo:** `{ "codigo_barras": "7701234000099" }`. El Tendero puede (matriz de roles I0).

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "message": "Código vinculado correctamente" }` |
| **400** | `{ "success": false, "error": "Código de barras es requerido" }` |
| **404** | `{ "success": false, "error": "Producto no encontrado" }` (no existe o es de otra tienda) |

**COMPORTAMIENTO ACTUAL (hallazgo):** no se comprueba que el código no lo tenga ya otro producto de la tienda: se puede dejar el mismo código en dos productos y `[C2]` devolvería uno cualquiera. Hasta corregirlo, la app debe consultar `[C2]` antes de vincular y avisar al usuario si el código ya existe.
**Prueba:** `contrato_app_tendero.test.js › [C3]`.

---

## 5. Caja

La caja es **por vendedor**: la caja abierta del Administrador no cuenta como la del Tendero. Sin caja abierta no se puede vender (`[V2]` → 403) ni registrar egresos (`[K4]` → 400).

### [K1] `GET /api/caja/sesion`
**200** `{ "active": false }` o `{ "active": true, "session": { "id_sesion", "id_tienda", "id_vendedor", "monto_apertura": "50000.00", "monto_cierre_declarado": null, "monto_cierre_calculado": null, "diferencia": null, "fecha_apertura", "fecha_cierre": null, "estado": "Abierta" } }`.
**Prueba:** `contrato_app_tendero.test.js › [K1]`.

### [K2] `POST /api/caja/abrir`
Con CSRF. **Cuerpo:** `{ "monto_apertura": 50000 }` (número ≥ 0; el 0 es válido).

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "message": "Caja abierta exitosamente", "id_sesion": 12 }` |
| **400** | `{ "error": "Ya tienes una sesión de caja abierta." }` |
| **400** | `{ "error": "El monto de apertura no es válido." }` (ausente, negativo, no numérico) |

La apertura es **atómica por vendedor**: varias peticiones simultáneas abren una sola caja (las demás reciben el 400).
**Pruebas:** `contrato_app_tendero.test.js › [K2]`; la atomicidad, `caja_apertura_concurrencia.test.js`.

### [K3] `POST /api/caja/cerrar`
Con CSRF. **Cuerpo:** `{ "monto_cierre_declarado": 60000 }` (lo que el Tendero contó).

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "message": "Caja cerrada exitosamente (Arqueo completo)", "arqueo": { "monto_apertura", "ventas_efectivo", "abonos_efectivo", "egresos", "monto_cierre_calculado", "monto_cierre_declarado", "diferencia" } }` (todos números). `diferencia = declarado − calculado`; calculado = apertura + ventas en efectivo + abonos en efectivo − egresos. Un descuadre significativo genera una notificación. |
| **400** | `{ "error": "No hay ninguna caja abierta para cerrar." }` |
| **400** | `{ "error": "El monto de cierre declarado no es válido." }` (ausente o negativo; la caja sigue abierta) |

**Prueba:** `contrato_app_tendero.test.js › [K3]`.

### [K4] `POST /api/caja/egreso`
Con CSRF. **Cuerpo:** `{ "monto": 10000, "motivo": "Bolsas y hielo", "categoria": "Otro", "foto_soporte": "data:image/jpeg;base64,…"? }`. `categoria` por defecto `"Otro"`. `foto_soporte` opcional: solo JPEG o PNG en base64 (`data:image/jpeg;base64,` o `data:image/png;base64,`), máximo ~2 MB.

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "message": "Egreso registrado correctamente.", "id_egreso": 7 }` — queda en estado «Registrado», pendiente de aprobación del Administrador. |
| **400** | `{ "error": "No hay ninguna caja abierta. No puedes registrar gastos." }` |
| **400** | `{ "error": "El monto debe ser mayor a 0." }` |
| **400** | `{ "error": "Debes proporcionar un motivo válido (mínimo 5 caracteres)." }` |
| **400** | `{ "error": "Por seguridad, tu rol no permite registrar gastos mayores a $150.000. Consulta al administrador." }` (el tope sale de `limiteEgresoTendero` en `[S4]`; el monto igual al tope es válido) |
| **400** | `{ "error": "Formato de imagen no permitido. Solo se acepta JPG o PNG." }` / `"La imagen supera el tamaño máximo permitido de 2MB."` |

El Tendero **no** aprueba ni rechaza egresos: `PUT /api/caja/egreso/:id/aprobar|rechazar` → 403.
**Pruebas:** `contrato_app_tendero.test.js › [K4]`; aprobación y 409 en `autorizacion_roles.test.js`.

---

## 6. Vender

### [V1] `GET /api/clientes`
**200** `{ "success": true, "clientes": [ { "id_cliente", "nombre", "celular", "limite_credito": "100000.00", "fecha_registro", "total_fiado", "total_abonado", "saldo_pendiente": 0 } ] }`, solo de la tienda. Sirve para elegir a quién se le fía.
El Tendero **no** puede crear clientes (`POST /api/clientes`) ni registrar abonos (`POST /api/clientes/:id/abonos`): ambos 403 (decisión D4).
**Prueba:** `contrato_app_tendero.test.js › [V1]`.

### [V2] `POST /api/registrar-venta-carrito`
Con CSRF. **Esta es la ruta de venta que usa la app** (`POST /api/registrar-venta`, de un solo producto, existe pero su respuesta no trae `id_venta`).
**Cuerpo:**
```json
{
  "items": [ { "id_producto": 1, "cantidad": 2 } ],
  "metodo_pago": "Efectivo",
  "efectivo_recibido": 10000,
  "id_cliente": 3
}
```
`metodo_pago`: `"Efectivo"` (por defecto), `"Tarjeta"`, `"Transferencia"` o `"Fiado"` — los mismos textos que usa la web. **El servidor no valida el valor** (guarda cualquier texto) y el arqueo de caja solo suma las ventas cuyo método es exactamente `"Efectivo"`: un texto distinto (p. ej. `"efectivo"`) deja la venta fuera del cuadre. `efectivo_recibido` opcional (por defecto, el total; el cambio se calcula). `id_cliente` **obligatorio si es `"Fiado"`**.

| Código | Cuerpo | Cuándo |
|---|---|---|
| **200** | `{ "success": true, "message": "Venta registrada correctamente", "id_venta": 21 }` | La venta, el descuento de stock y el movimiento de Kardex se hacen en **una transacción**. Se guarda `Ventas.canal` = el de la sesión (`web`/`app`). Si es fiado, la venta queda «Pendiente» y suma al saldo del cliente. |
| **403** | `{ "success": false, "error": "Debes abrir tu caja antes de realizar ventas." }` | Sin caja abierta. |
| **400** | `{ "success": false, "error": "El carrito debe contener al menos un producto" }` | `items` vacío o ausente. |
| **400** | `… "Cada ítem debe tener producto y cantidad"` · `… "Las cantidades deben ser mayores a 0"` | Ítem mal formado. |
| **400** | `… "El cliente es obligatorio para ventas fiadas."` | Fiado sin `id_cliente`. |
| **400** | `… "Stock insuficiente para el producto: <nombre>"` | No alcanza el stock; no se descuenta nada. |
| **400** | `… "Error interno procesando la venta"` | **COMPORTAMIENTO ACTUAL:** también es lo que devuelve un `id_producto` inexistente o de otra tienda (debería ser 404). |

El canal **no** se puede elegir en la venta: se toma de la sesión.
**COMPORTAMIENTO ACTUAL (hallazgos que afectan a la app):**
- **El límite de crédito del cliente no se aplica:** una venta fiada por más que el `limite_credito` se acepta. La app puede avisar al usuario comparando `saldo_pendiente + total` con `limite_credito` de `[V1]`, pero el servidor no lo impide.
- **El `id_cliente` no se valida contra la tienda:** se acepta un cliente de otra tienda. La app solo debe ofrecer los clientes de `[V1]`.
**Pruebas:** `contrato_app_tendero.test.js › [V2]`; el canal, `ventas_canal.test.js`; la concurrencia sobre el mismo producto, `venta_concurrencia.test.js`.

### [V3] `GET /api/ventas`
`?limit=` (por defecto 100) y `?offset=`. **200** `{ "data": [ { "id_venta", "fecha_salida", "cantidad", "nombre_producto", "categoria", "precio_unitario", "precio_total", "nombre_vendedor" } ], "total", "limit", "offset", "hasMore" }`. Una fila **por producto vendido**, de **toda la tienda** (no solo del vendedor ni del turno) y **sin** `canal`.
Para «ventas del turno» no hay hoy un endpoint propio: es una **brecha** de esta versión (plan 07, 6.2, «si alcanza el tiempo»).
**Prueba:** `contrato_app_tendero.test.js › [V3]`.

---

## 7. Recibir mercancía

### [M1] `POST /api/inventario/entrada`
Con CSRF. **Cuerpo:** `{ "id_producto": 1, "cantidad": 6, "observacion": "Pedido del lunes"? }` (`cantidad` entera > 0).

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "message": "Entrada registrada", "data": { "id": 4, "producto": "Leche", "tipo": "Entrada", "cantidad": 6, "stockAnterior": 0, "stockNuevo": 6 } }` — suma el stock, deja el movimiento en el Kardex con el usuario y regenera las alertas. |
| **400** | `{ "success": false, "error": "Producto y cantidad (positiva) son requeridos" }` |
| **404** | `{ "success": false, "error": "Producto no encontrado" }` (no existe o es de otra tienda) |

No hay tope contra lo pedido en una orden de compra (hallazgo P21-10): la app solo registra cantidades recibidas.
**Prueba:** `contrato_app_tendero.test.js › [M1]`.

---

## 8. Alertas

### [A1] `GET /api/alertas`
`?limit=`. **200** `{ "success": true, "alerts": [...], "data": [...] }` — `alerts` y `data` son **la misma lista** de alertas activas (usar `alerts`). Cada alerta: `id_alerta`, `id_producto`, `tipo` (p. ej. `"stock_critico"`), `severidad` (`"critico"`, `"advertencia"`, `"info"`), `mensaje`, `fecha_creacion`, `resuelta` (0), `nombre_producto`, `codigo`, `datos_json` (texto JSON del motor; no depender de él).
`GET /api/alertas/stats` → `{ "success": true, "stats": { "critico", "advertencia", "info", "total" } }` para la insignia del menú.
Regenerar alertas (`POST /api/alertas/generate`) es del Administrador (403).
**Prueba:** `contrato_app_tendero.test.js › [A1]`.

### [A2] `PATCH /api/alertas/:id/resolve`
Con CSRF, cuerpo `{}`. **200** `{ "success": true, "message": "Alerta archivada." }`. El Tendero puede.
**COMPORTAMIENTO ACTUAL:** un id inexistente o de otra tienda también da 200 (sin 404), y no toca la alerta ajena.
**Prueba:** `contrato_app_tendero.test.js › [A2]`.

---

## 9. Opcionales

### [O1] `POST /api/ordenes/borrador/solicitar` — el Tendero pide un producto al Administrador
Con CSRF. **Cuerpo:** `{ "id_producto": 1, "cantidad": 5, "urgencia": "alta"? }`.

| Código | Cuerpo |
|---|---|
| **200** | `{ "success": true, "id_orden": 4, "proveedor": "Distribuidora" }` — agrega la línea al borrador de pedido del proveedor del producto y avisa a los administradores. |
| **400** | `… "Indica un producto y una cantidad válida."` · `… "Este producto no tiene proveedor asignado; pide al administrador que lo asigne primero."` |
| **404** | `{ "success": false, "error": "Producto no encontrado." }` (no es de la tienda) |
| **409** | `{ "success": false, "error": "Ese producto ya está en un pedido en borrador; …" }` |

**Prueba:** `contrato_app_tendero.test.js › [O1]`.

### [O2] `/api/notificaciones`
`GET /api/notificaciones?limit=5` → `{ "success": true, "notifications": [ { "id_notificacion", "tipo", "titulo", "mensaje", … } ] }` · `GET /api/notificaciones/count` → `{ "success": true, "count": 3 }` · `PATCH /api/notificaciones/:id/read` y `PATCH /api/notificaciones/read-all` → `{ "success": true }`. Solo las del propio usuario.
**Prueba:** `contrato_app_tendero.test.js › [O2]`.

---

## 10. Lo que la app NO debe llamar (es del Administrador y responde 403 al Tendero)

Crear, editar, borrar y pausar productos; carga masiva; promociones manuales; salidas y ajustes de inventario; generar alertas; reportes y exportaciones; estrategias de precio de la IA; crear clientes y registrar abonos; aprobar o rechazar egresos; proveedores y órdenes de compra; tiendas y colaboradores.
La lista completa y su prueba (Tendero → 403, la base no cambia) están en `autorizacion_roles.test.js` (matriz de roles P22-10).

## 11. Hallazgos abiertos que tocan a la app (resumen)

| ID | Qué | Efecto en la app | Propuesta |
|---|---|---|---|
| C4 | CSRF inválido responde 500, no 403 | La app no distingue un error real de un token vencido | Que el manejador global respete `err.status` (≈5 líneas) |
| — | `link-barcode` permite códigos duplicados | Dos productos con el mismo código; `[C2]` ambiguo | Responder 409 si otro producto de la tienda ya lo tiene |
| — | Ventas fiadas sin límite de crédito y con `id_cliente` sin validar contra la tienda | Se puede fiar sobre el cupo y ligar una venta a un cliente ajeno | Validar cliente y cupo dentro de la transacción de la venta |
| — | Producto inexistente en el carrito da 400 «Error interno…» | Mensaje poco claro | 404 con «Producto no encontrado» |
| — | `GET /api/productos` expone `costo_compra` al Tendero | Dato de margen visible en el dispositivo | Quitar esos campos para el rol Tendero |
| — | No hay endpoint de «ventas del turno» ni `canal` en `GET /api/ventas` | Brecha de la función opcional | Filtro por vendedor/sesión de caja |
| P21-10 | Recepción de mercancía de una orden sin tope | No aplica a `[M1]` (entrada libre), sí a la recepción de órdenes en la web | Decisión de negocio pendiente |

## 12. Cómo cambiar este contrato
1. Proponer el cambio en este documento (rama del backend), indicando si rompe a la app.
2. Cambiar el código **y** `contrato_app_tendero.test.js` en el mismo commit.
3. Avisar a quien construye la app antes de desplegar. Los cambios compatibles (campos nuevos en las respuestas) no rompen; renombrar o quitar campos, cambiar códigos de estado o hacer obligatorio un campo sí.
4. Durante las seis semanas del piloto solo se despliegan correcciones de errores (plan 22, sección 5).
