/**
 * @file db.js (helpers)
 * @description Limpieza de datos entre pruebas de integración. Vacía todas las tablas de la app
 * (pero nunca borra ni recrea el esquema) para que cada prueba arranque de una base conocida.
 * Requiere que tests/integration/setupTestDb.js ya haya corrido (DATABASE_URL apuntando a
 * stockpilot_test) — se importa siempre después, nunca antes, de ese guard.
 *
 * @module tests/integration/helpers/db
 */

const db = require('../../../config/database');

// Todas las tablas de la app (ver database/init_pg.sql). CASCADE arrastra las FK entre ellas,
// así que el orden de la lista no importa. RESTART IDENTITY reinicia los SERIAL a 1 en cada
// limpieza, para que los IDs de una prueba sean predecibles y no dependan del orden de corrida.
const TABLAS = [
  'abonos', 'alertas', 'auditoria_ia', 'cache_ia', 'clientes', 'egresoscaja', 'feedback_ia',
  'historial_precios', 'movimientosstock', 'notificacionesusuario', 'ordenes_detalle',
  'ordenes_compra', 'productos', 'promociones_manuales', 'proveedores', 'reportes',
  'sesioncaja', 'session', 'usuarios', 'ventasproductos', 'ventas', 'tienda'
];

async function limpiarBaseDePruebas() {
  await db.pool.query(`TRUNCATE ${TABLAS.join(', ')} RESTART IDENTITY CASCADE`);
}

module.exports = { limpiarBaseDePruebas };
