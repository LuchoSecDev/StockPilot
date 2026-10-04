# Propuesta P22-10: matriz de roles (rol × endpoint de escritura)

**Estado:** propuesta para que Luis decida. No se cambió ningún código.
**Fecha:** 2026-09-28 · **Base:** `main` local tras los merges de P22-09, `requireAdmin` en tienda y `fix/seed-produccion`.
**Cómo se armó:** se listaron **todas** las rutas `POST/PUT/PATCH/DELETE` de `routes/*.js` y se separaron las que solo exigen `requireLogin`. La columna «Interfaz hoy» sale de leer `frontend/src` (App.jsx, Sidebar.jsx y cada página/hook); «Confirmado» significa que se ejecutó contra `stockpilot_test`.

Roles que existen: `Administrador` y `Tendero`. Símbolos de la propuesta: **A** = solo Administrador · **T** = también el Tendero · **?** = decisión tuya.

## 1. Rutas de escritura con solo `requireLogin`

| # | Ruta | Qué hace | Interfaz hoy (Tendero) | Propuesta | Por qué |
|---|---|---|---|---|---|
| 1 | `PUT /api/productos/:id/link-barcode` | Asocia un código de barras a un producto | **Lo ve** (modal del escáner) | **T** | Es trabajo normal de piso: escanear al recibir mercancía. |
| 2 | `POST /api/productos/bulk` | Carga masiva `.xlsx`/`.csv` | No lo ve (`isAdmin`) | **A** | Puede crear cientos de productos con precios. La interfaz ya lo trata así. |
| 3 | `POST /api/productos/admin` | Crear producto | Botón oculto, **pero el escaneo de un código desconocido lo deja llegar** | **A** ? | Fija precio y costo. Ver decisión D1. |
| 4 | `PUT /api/productos/:id` | Editar producto (incluye precio y costo) | Botón oculto, **pero el escaneo de un código existente abre el modal de edición** | **A** ? | Precio y costo son decisiones del dueño. Ver D1. |
| 5 | `PUT /api/productos/agregar/:id` | Suma stock a un producto | **Ningún llamado en el frontend** (usa `inventario/entrada`) | **T** o eliminarla | Duplica a `inventario/entrada`; si nadie la usa, conviene borrarla (menos superficie). |
| 6 | `PUT /api/productos/inhabilitar/:id` y `/habilitar/:id` | Pausa o reactiva un producto en venta | No lo ve | **A** | Cambia lo que se puede vender. |
| 7 | `POST /api/promociones` | Descuento manual | No lo ve | **A** | Afecta márgenes. |
| 8 | `DELETE /api/productos/:id` | Elimina producto | No lo ve | **A** | Destructivo. |
| 9 | `POST /api/inventario/entrada` | Entrada de mercancía | No llega (`/movimientos` es admin) **salvo por el modal «Sumar stock» del escaneo** | **T** | Recibir mercancía es tarea del Tendero; ya deja rastro en `MovimientosStock`. |
| 10 | `POST /api/inventario/salida` | Salida manual (merma, consumo) | No llega | **A** ? | Una salida sin venta puede encubrir faltantes. Ver D2. |
| 11 | `POST /api/inventario/ajuste` | Ajuste por conteo físico | No llega | **A** ? | Ver D2 (el plan 22 dice que un conteo puede ser tarea del Tendero). |
| 12 | `POST /api/alertas/generate` | Recalcula alertas | Botón oculto (`isAdmin`) | **A** | Alineado con la interfaz; el motor ya corre solo tras cada venta o entrada. |
| 13 | `PATCH /api/alertas/:id/resolve` | Archiva una alerta | **Lo ve** («✓ Marcar Resuelta») | **T** | Tarea normal del Tendero; ya filtra por tienda. |
| 14 | `POST /api/alertas/test-summary` | **Envía por correo el resumen semanal** a los usuarios de la tienda | No llega (`/reportes` es admin) | **A** | El propio comentario del código dice «solo admins» pero no lo exige. Es un bug. |
| 15 | `POST /api/reportes` | Crea un reporte | No llega | **A** | Reportes de ventas y financieros. |
| 16 | `PUT /api/reportes/:id`, `DELETE /api/reportes/:id` | Edita o borra un reporte | No llega | **A** + filtro de tienda | **Confirmado: falla de aislamiento** (sección 2, C1). |
| 17 | `POST /api/exportar/ventas` | Exporta las ventas | **Lo ve** (pestaña Historial) | **A** ? | Exporta todas las ventas de la tienda. Ver D3. |
| 18 | `POST /api/exportar/reportes` | Exporta reportes | Sin llamado en el frontend | **A** | Sin uso conocido. |
| 19 | `POST /api/feedback/evaluate/:orderId` | Evalúa la precisión de la IA de una orden | No llega (`/aprendizaje` es admin) | **A** + filtro de tienda | **Confirmado: falla de aislamiento** (sección 2, C2). |
| 20 | `POST /api/ia/apply-strategy` | Aplica un precio sugerido por la IA | **Lo ve** («Activar Oferta», «Ejecutar Ahora» en el Dashboard) | **A** ? | Cambia precios. Ver D3. |
| 21 | `POST /api/ordenes/borrador/solicitar` | El Tendero pide un producto al administrador | **Lo ve** («Solicitar al Administrador») | **T** | Está hecha a propósito para el Tendero. |
| 22 | `POST /api/clientes`, `POST /api/clientes/:id/abonos` | Crear cliente fiado y registrar abonos | No llega (`/cartera` es admin) | **A** ? | Ver D4. |
| 23 | `POST /api/caja/abrir`, `/cerrar` | Abrir y cerrar turno | **Lo ve** | **T** | Es el flujo diario del Tendero. |
| 24 | `POST /api/caja/egreso` | Registra un egreso de caja chica | **Lo ve**, con tope por rol | **T** | Ya tiene el límite `limite_egreso_tendero`. |
| 25 | `POST /api/registrar-venta`, `/registrar-venta-carrito` | Ventas | **Lo ve** | **T** | Función principal del Tendero. |
| 26 | `PATCH /api/notificaciones/:id/read`, `/read-all` | Marca notificaciones | **Lo ve** | **T** | Cada usuario solo las suyas. |

Ya protegidas con `requireAdmin` (sin cambios): tendero, proveedores y órdenes, tiendas (`update`, `estado`, `crear`, `switch`), notificaciones `broadcast`, borradores de orden (crear, editar línea, quitar línea, asignar proveedor), egresos aprobar/rechazar (P22-09).
Rutas de `authRoutes` (perfil, 2FA, recuperación) no llevan `requireLogin` en la ruta: cada controlador revisa la sesión y quedaron caracterizadas en R0; no entran en esta matriz.

### Decisiones que necesito de Luis

- **D1. ¿El Tendero puede crear o editar productos por el escáner?** Hoy no ve los botones, pero el escáner del catálogo abre el modal de edición (producto existente) o el de creación (código nuevo) sin mirar el rol. Recomendación: **A** para crear y editar; el Tendero que escanea un código existente entra directo a «Sumar stock» (que usa `inventario/entrada`, permitido) y con un código desconocido ve «pídele al administrador que lo registre». **Esto sí cambia la interfaz** (sección 3).
- **D2. Salida y ajuste de inventario:** ¿solo Administrador (como hoy en la interfaz) o el Tendero con aviso al administrador? El plan 22 (1.4) dice que un conteo físico puede ser tarea normal del Tendero. Mi recomendación conservadora: **A** ahora; abrirlo después con notificación si el piloto lo pide.
- **D3. Exportar ventas y aplicar estrategias de precio de IA:** hoy el Tendero ve ambos controles. Recomendación: **A**, y en el Dashboard el Tendero ve «Solicitar al Administrador» (el mismo patrón que ya existe para las compras).
- **D4. Clientes fiados y abonos:** la interfaz ya los deja solo al Administrador. ¿Es intencional? Si el Tendero cobra abonos en el mostrador, hay que dejarlo en **T**.

## 2. Hallazgos críticos nuevos (no estaban en R0; los encontré armando esta matriz)

**C1. Reportes: cualquier usuario edita o borra los de cualquier tienda.** `Report.update(id, …)` y `Report.delete(id)` hacen `WHERE id = ?` sin `id_tienda`. **Confirmado:** un Tendero de la tienda B cambió el título de un reporte de la tienda A y luego lo borró (200 y 200). Es el mismo defecto que P22-09.
*Solución (poco código, ~12 líneas):* pasar `req.session.tiendaId` a `update`, `delete` y `findById` y agregar `AND id_tienda = ?`; responder 404 si no hay filas; sumar `requireAdmin`. Pruebas: 2 nuevas (404 entre tiendas, filas intactas) y 1 de camino feliz.

**C2. Evaluación de IA: cualquiera evalúa órdenes de otra tienda, y ve sus datos.** `evaluateOrderInternal(orderId)` busca la orden solo por `id_orden`. **Confirmado:** un Tendero de la tienda B llamó `POST /api/feedback/evaluate/<orden de A>` y recibió 200 con el **nombre y las ventas de los productos de A**, y se escribió una fila en `Feedback_IA` de esa orden (altera las métricas de aprendizaje de A).
*Solución (~8 líneas):* en el manejador HTTP `evaluateOrder`, antes de llamar a la función interna, comprobar que la orden es de la tienda de la sesión (`SELECT 1 FROM Ordenes_Compra WHERE id_orden = ? AND id_tienda = ?`) y responder 404 si no; más `requireAdmin` en la ruta. **No** se cambia `evaluateOrderInternal`: el otro llamador es el scheduler (`schedulerService.js:194`), que a propósito evalúa órdenes de todas las tiendas sin sesión. Pruebas: 2 nuevas. Nota: `feedbackController` está excluido de la cobertura y sin pruebas (`/* v8 ignore */`), así que hay que caracterizarlo antes de tocarlo.

**C3. `POST /api/alertas/test-summary` sin `requireAdmin`** (fila 14): cualquier usuario dispara el envío de correos a la tienda. Solución: 1 línea.

**C4. Un CSRF inválido responde 500, no 403.** El manejador global de `app.js` ignora `err.status`, así que `ForbiddenError: invalid csrf token` sale como «Server Error» y llena el log de errores. Solución (~5 líneas): si `err.status` está entre 400 y 499, responder ese código. Riesgo bajo, pero hay que revisar cómo maneja la interfaz un 403 de CSRF (hoy ve 500).

**C5 (menor). `clienteRoutes` hace `router.use(requireLogin)` sobre `/api`**, así que cualquier ruta inexistente bajo `/api` responde 401/302 a un usuario sin sesión en vez de 404. No es explotable; conviene sacar el `use` global cuando se toque ese archivo.

## 3. Qué cambiaría en las pantallas si se aprueba la propuesta

| Pantalla | Hoy (Tendero) | Con la propuesta |
|---|---|---|
| Catálogo → escanear código existente | Abre el modal de edición completo (precio, costo…) | Abre solo «Sumar stock» (D1) |
| Catálogo → escanear código desconocido | Ofrece vincular o crear producto | Solo vincular; para crear, «pídeselo al administrador» (D1) |
| Punto de Venta → Historial | Botón «Exportar ventas» visible | Oculto (D3) |
| Dashboard → Estrategias de Venta | «Activar Oferta» y «Ejecutar Ahora» visibles | Oculto; en su lugar «Solicitar al Administrador» (D3) |
| Alertas, Caja, Ventas, notificaciones | Sin cambio | Sin cambio |
| Todo lo que ya estaba oculto (Movimientos, Reportes, Cartera, Aprendizaje…) | Oculto | Igual; ahora el backend también lo rechaza con 403 |

Para un Tendero que solo usa la interfaz, el cambio visible se limita a esas 4 filas. Para quien llame a la API a mano, todo lo marcado **A** pasa a 403.

## 4. Tamaño del trabajo y pruebas

- **Backend:** una línea `requireAdmin` por ruta (unas 15 rutas) más los filtros de tienda de C1 y C2. Cambio **pequeño y mecánico**; el riesgo está en la interfaz, no en el servidor.
- **Interfaz:** 3 componentes (`useProductosPage.js`/`ProductosPage.jsx` para el escáner, `HistorialVentasTab.jsx`, `DashboardPage.jsx`), unas 30 a 60 líneas en total.
- **Pruebas:** los 7 casos de `autorizacion_roles.test.js` con la marca `// I0` se invierten a 403 (o quedan en 200 los que la matriz deje en **T**), más una prueba de 403 por cada ruta nueva de la lista y 6 a 8 pruebas de aislamiento entre tiendas (C1, C2). Esperable: unas 25 pruebas de integración nuevas o modificadas.
- **Orden sugerido:** primero C1, C2 y C3 (fallas reales y pequeñas, no dependen de tus decisiones); después la matriz D1 a D4; C4 y C5 cuando toques el manejador de errores.
