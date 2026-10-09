# 🔔 Plan 06: Sistema de Notificaciones Avanzadas StockPilot

**Estado (revisado el 9-oct-2026):** Fases 1 y 2 implementadas (P06-01). Pendiente: umbrales de metas editables desde el panel del administrador (P06-02, trabajo futuro).

## Contexto

La infraestructura base ya existe: tabla `NotificacionesUsuario`, modelo `Notification.js`, rutas `notificationRoutes.js`, y el `NotificationCenter.jsx` ya consume notificaciones de usuario (egresos aprobados/rechazados). Este plan extiende esa base con 5 módulos nuevos.

---

## Fases de Implementación

### Fase 1 — Triggers Automáticos (Sin UI nueva)

Estas funcionalidades se activan solas al ocurrir eventos existentes.

#### 1. ⚠️ Advertencias de Descuadres Automáticas
**Trigger:** Al cerrar caja (`closeSession` en `cashRegisterController.js`), si la `diferencia` supera un umbral (ej. ±$5,000), se crea una notificación.
- Evaluar `arqueo.diferencia`.
- Crear `Notification.create()` para el tendero (tipo: `descuadre_caja`).

#### 2. 🏷️ Notificaciones de Cambios de Precio
**Trigger:** Al editar un producto (`updateProduct` en `productController.js`), si el precio nuevo difiere del anterior, se notifica a todos los tenderos de la tienda.
- Comparar `precioAnterior` con `precioNuevo`.
- Enviar notificación tipo `cambio_precio`.

---

### Fase 2 — Funcionalidades con UI Nueva

#### 3. 📢 Anuncios Globales (Broadcasts)
El Admin necesita un botón/formulario para enviar un mensaje a todos los tenderos.
- **Backend:** Agregar `Notification.broadcast()` y endpoint `POST /api/notificaciones/broadcast`.
- **Frontend (Decisión de Diseño):** Crear una sección nueva en el menú lateral ("Comunicados" o "Mensajería") para no saturar el Punto de Venta.
- **Ajuste Adicional:** Permitir al admin elegir el tipo de prioridad de la notificación (urgente vs normal) para disparar acciones visuales/sonoras en la campanita.

#### 4. 📦 Avisos Logísticos (Órdenes de Compra)
**Trigger:** Cuando el Admin **envía** una orden en `suppliersController.js`.
- Notificar a todos los tenderos de la tienda: "Se ha enviado el pedido a X proveedor. Estar pendientes." (tipo: `orden_enviada`).

#### 5. 🎯 Gamificación — Metas y Felicitaciones
- Evaluar las ventas diarias al momento de registrar una nueva venta (`saleController.js`).
- Comparar contra umbrales fijos iniciales ($300K, $500K, $1M).
- Generar notificación tipo `meta_ventas`.
- *A futuro:* Estos umbrales fijos podrán ser editables desde el panel de admin.

---

## Cambios en el Frontend: NotificationCenter.jsx

Actualizar los mapeadores de íconos y estilos para los nuevos tipos.

| Tipo | Ícono | Color | Animación (Urgente) |
|------|-------|-------|----------------------|
| `egreso_aprobado` | ✅ CheckCircle | Emerald | Ninguna |
| `egreso_rechazado` | ❌ XCircle | Rose | Ninguna |
| `descuadre_caja` | ⚠️ AlertTriangle | Amber | Pulsar |
| `cambio_precio` | 🏷️ Tag | Violet | Ninguna |
| `anuncio_admin` | 📢 Megaphone | Indigo | Agitar + Sonido si es urgente |
| `orden_enviada` | 📦 Package | Teal | Ninguna |
| `meta_ventas` | 🏆 Trophy | Yellow/Gold | Brillo especial |
