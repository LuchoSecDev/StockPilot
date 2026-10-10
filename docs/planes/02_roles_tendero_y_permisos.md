# Plan 02: Restricción de Vistas y Permisos para Rol Tendero / Colaborador

**Estado:** Implementado y Verificado  
**Fecha:** 2026-09-17  

> **Nota (9-oct-2026):** este plan restringió lo que el Tendero **ve** en la interfaz. La autorización en el servidor (rutas de tienda, egresos, productos, reportes, exportaciones) se completó después, con la fase I0 del plan 22 (matriz de roles P22-10, 28-sep a 3-oct). Ver también P02-01 y P24-05 en `docs/seguimiento_planes.xlsx`.

---

## 1. Contexto y Requerimientos
El rol "Tendero" o colaborador operativo de la tienda solo debe tener acceso a las funciones esenciales del día a día (atender clientes, registrar ventas y consultar productos sin modificarlos). No debe acceder a métricas financieras de alto nivel, configuraciones globales ni administración de usuarios.

---

## 2. Decisiones y Cambios Realizados

1. **Vistas Disponibles para Tendero:**
   - ✅ **Punto de Venta / Ventas:** Acceso completo para registrar ventas, abrir y cerrar su turno de caja.
   - ✅ **Catálogo de Productos:** Solo lectura. Puede ver existencias, precios y código de barras.
   - ❌ **Acciones Bloqueadas en Productos:** La columna "Acciones" (editar producto, eliminar producto) se oculta completamente para el rol Tendero (`ProductTable.jsx`).
   - ❌ **Consejero IA:** Se deshabilitó / ocultó el acceso directo o botones no operativos para tenderos en esta área, evitando consultas de estrategia o analítica propietaria del dueño.
   - ❌ **Configuración y Tiendas:** Bloqueado por middleware de sesión y guards del frontend.

2. **Alineación de Interfaz:**
   - Se ajustó el posicionamiento vertical de las pestañas en `PuntoVentaPage.jsx` para que "Caja Rápida", "Historial de Ventas" e "Historial de Caja" mantengan la misma altura estética y navegación fluida.
