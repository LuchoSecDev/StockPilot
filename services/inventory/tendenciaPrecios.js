/**
 * @file tendenciaPrecios.js
 * @description Historial de cambios de precio de una tienda, listo para graficar.
 *
 * @module services/inventory/tendenciaPrecios
 */
const db = require('../../config/database');

const MAX_CAMBIOS = 100;

/**
 * Convierte una fila de `Historial_Precios` al formato de la gráfica.
 * `fecha_cambio` llega como `Date` (TIMESTAMPTZ en node-postgres): se pasa a texto ISO `YYYY-MM-DD`.
 * @param {Object} fila
 * @returns {{fecha: string, producto: string, precioAnterior: number, precioNuevo: number, variacion: number}}
 */
function aPuntoDeTendencia(fila) {
  return {
    fecha: new Date(fila.fecha_cambio).toISOString().split('T')[0],
    producto: fila.nombre_producto,
    precioAnterior: Number(fila.precio_anterior),
    precioNuevo: Number(fila.precio_nuevo),
    variacion: Number(fila.precio_nuevo) - Number(fila.precio_anterior)
  };
}

/**
 * @param {number} tiendaId
 * @returns {Promise<Array<Object>>} Hasta 100 cambios, del más antiguo al más reciente.
 */
async function obtenerTendenciaPrecios(tiendaId) {
  const filas = await db.allAsync(`
    SELECT hp.*, p.nombre_producto, hp.fecha_cambio
    FROM Historial_Precios hp
    JOIN Productos p ON hp.id_producto = p.id_producto
    WHERE p.id_tienda = ?
    ORDER BY hp.fecha_cambio ASC
    LIMIT ${MAX_CAMBIOS}
  `, [tiendaId]);

  return filas.map(aPuntoDeTendencia);
}

module.exports = { obtenerTendenciaPrecios };
