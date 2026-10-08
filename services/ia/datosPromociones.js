/**
 * @file datosPromociones.js
 * @description Lecturas de base de datos que necesita el flujo de promociones con IA. Solo trae
 * datos; las decisiones (a quién se promociona, qué se le dice a la IA) viven en
 * `candidatosPromocion.js`, `composicionPromociones.js` y `prompts.js`.
 *
 * @module services/ia/datosPromociones
 */
const db = require('../../config/database');
const { leerEntradasMotor } = require('../inventory/entradasMotor');

/**
 * Productos de la tienda que pueden entrar en promoción (disponibles y sin otra promoción
 * vigente), con la forma que espera `elegirCandidatos`.
 * Misma velocidad 7d/30d que usan Consejero, Proveedores y Simulador. Vencimiento y «ya tiene
 * promo activa» son propios de esta pantalla (el motor no los trae), así que se buscan aparte y se cruzan.
 * @param {number} tiendaId
 * @returns {Promise<Array<Object>>}
 */
async function leerFilasElegibles(tiendaId) {
  const entradas = await leerEntradasMotor(db, tiendaId);
  const elegibles = await db.allAsync(
    `SELECT id_producto, fecha_vencimiento FROM Productos
     WHERE id_tienda = ? AND estado = 'Disponible'
       AND (fecha_fin_promocion IS NULL OR fecha_fin_promocion < CURRENT_DATE)
       AND precio_original IS NULL`,
    [tiendaId]
  );
  const vencimientoPorProducto = new Map(elegibles.map(r => [r.id_producto, r.fecha_vencimiento]));

  return entradas
    .filter(item => vencimientoPorProducto.has(item.id_producto))
    .map(item => ({
      id: item.id_producto,
      nombre: item.nombre_producto,
      stock: item.stock_actual,
      precio: item.precio,
      categoria: item.categoria,
      fecha_vencimiento: vencimientoPorProducto.get(item.id_producto),
      stock_seguridad: item.stock_seguridad,
      stock_minimo: item.stock_minimo,
      lead_time: item.lead_time,
      frecuencia_compra_dias: item.frecuencia_compra_dias,
      velocity_30d: item.velocity_30d,
      velocity_7d: item.velocity_7d,
    }));
}

/**
 * Las últimas 10 promociones que el dueño creó a mano (human-in-the-loop).
 * @param {number} tiendaId
 * @returns {Promise<Array<Object>>}
 */
function leerPromocionesManuales(tiendaId) {
  return db.allAsync(`
    SELECT pm.descuento_porcentaje, pm.motivo, p.nombre_producto, p.categoria, p.stock_minimo
    FROM Promociones_Manuales pm
    JOIN Productos p ON pm.id_producto = p.id_producto
    WHERE pm.id_tienda = ?
    ORDER BY pm.fecha_creacion DESC
    LIMIT 10
  `, [tiendaId]);
}

module.exports = { leerFilasElegibles, leerPromocionesManuales };
