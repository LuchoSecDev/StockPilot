# Plan 05: Egresos de Caja Chica (Nivel 2)

**Estado (revisado el 9-oct-2026):** Implementado. Egresos con motivo, foto opcional y aprobación (`ExpenseModal.jsx`, `/api/caja/egreso`, prueba `caja.test.js`). Desde el 28-sep solo el Administrador aprueba o rechaza, solo los de su tienda y solo desde «Registrado» (P22-09). La sección 4 (Redis en producción) sigue pendiente: P05-01.

Este documento detalla la implementación del módulo de egresos/gastos operativos menores que salen del efectivo de la caja durante la jornada laboral, con controles de seguridad y trazabilidad completa.

## 1. Contexto del Problema

Actualmente, al cierre de caja el sistema compara: `Apertura + Ventas en Efectivo` vs `Dinero Declarado`. Si durante el día el tendero sacó dinero de la gaveta para pagar un gasto legítimo (ej. repartidor, bolsas, limpieza) sin registrarlo, el arqueo arroja un **faltante falso**.

La solución es permitir que el tendero registre egresos con motivo obligatorio y evidencia fotográfica opcional, manteniéndose una auditoría completa visible para el administrador.

## 2. Modificación del cálculo de arqueo

La fórmula de cierre de caja cambiará de:
`Esperado = Apertura + Ventas Efectivo`
a:
`Esperado = Apertura + Ventas Efectivo - Egresos Registrados`
Esto afecta directamente al modelo `CashRegister.js` y a la interfaz de cierre de caja.

## 3. Cambios Propuestos

### Base de Datos (PostgreSQL)

**Tabla `EgresosCaja` en `init_pg.sql`**
- `foto_soporte` se almacena como texto base64 en la BD. Esto mitiga riesgos de Path Traversal (OWASP A01) y ejecución de scripts maliciosos (OWASP A03).
- `estado` del egreso (Registrado, Aprobado, Rechazado).
- Restricciones de tamaño máximo (~2MB por foto) y tipos MIME (JPEG, PNG).

### Backend (Node.js / Express)

**`models/CashRegister.js`**
- Nuevos métodos: `createExpense`, `getExpensesBySession`, `getExpensesByStore`, `approveExpense`, `rejectExpense`, `getSessionExpensesTotal`.

**`controllers/cashRegisterController.js` y Rutas**
- `POST /api/caja/egreso` → `registerExpense`
- `GET /api/caja/egresos` → `getExpenses`
- `PUT /api/caja/egreso/:id/aprobar` → `approveExpense` (solo admin)
- `PUT /api/caja/egreso/:id/rechazar` → `rejectExpense` (solo admin)

### Frontend (React)

**`ExpenseModal.jsx`**
- Formulario de registro de egreso (Monto, Categoría, Motivo).
- Botón para adjuntar foto opcional (validación max 2MB y conversión a base64 de manera local en el navegador).

**`PuntoVentaPage.jsx` y `CashRegisterModal.jsx`**
- Botón "Registrar Gasto" visible con sesión abierta.
- Historial de caja refleja egresos, y éstos son restados del total esperado.
- Vista para el Administrador que permite visualizar la evidencia fotográfica y Aprobar/Rechazar egresos.

---

## 4. Notas sobre Infraestructura: Reactivación de Redis en Producción

Actualmente, el sistema cuenta con **Degradación Elegante (Fallback Dinámico)** para las sesiones. Si la variable de entorno `REDIS_URL` no está definida, el backend utiliza de forma automática **PostgreSQL (`connect-pg-simple`)** para persistir la sesión de los usuarios. Esta configuración es ultra estable y rápida, ideal para la etapa actual, pues evita generar costos extra o sufrir interrupciones por límites y pausas ("Cold Starts") propias de bases de datos Redis en capas gratuitas (como Upstash Free).

**¿Cuándo y cómo reactivar Redis?**

1. **Cuándo activarlo:**
   - **Crecimiento masivo:** Cuando existan cientos o miles de usuarios interactuando simultáneamente en el sistema.
   - **Escalamiento horizontal:** Cuando se desplieguen múltiples instancias del backend de StockPilot en Render (cluster) y requieran memoria compartida para sincronizar las Sesiones y el *Rate Limiting*.
   - **Caché avanzado:** Para agilizar consultas pesadas (ej. reportes históricos, catálogos grandes) y bajarle la carga a PostgreSQL.

2. **Recomendaciones para activarlo sin errores:**
   - Asegurarse de contratar un proveedor de Redis continuo (no *Serverless Free Tier* que hiberne), como **Render Redis** u otro proveedor de pago con alta disponibilidad.
   - Ajustar de ser necesario parámetros adicionales de timeout en `config/redis.js` para asegurar reconexiones limpias sobre TLS (`rediss://`).
   - Para habilitarlo en Producción, solo será necesario agregar la variable `REDIS_URL` en el dashboard de Render; el backend la detectará y conmutará automáticamente en su próximo reinicio.
