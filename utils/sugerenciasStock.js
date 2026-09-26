/**
 * @file sugerenciasStock.js
 * @description Umbrales sugeridos de stock (reorder point) para un producto sin historial
 * de ventas propio, a partir del promedio de ventas diarias (propio o de su categoría) y el
 * tiempo de entrega del proveedor.
 *
 * @module utils/sugerenciasStock
 */

/**
 * Stock de seguridad = colchón de 2 días de venta. Stock mínimo = ventas durante el lead time
 * más ese colchón. Ambos con un piso mínimo (2 y 5 respectivamente) para no sugerir valores
 * irrisorios cuando las ventas diarias son casi nulas.
 *
 * @param {number} avgDailySales
 * @param {number} leadTime - Días de entrega del proveedor.
 * @returns {{stockSeguridad: number, stockMinimo: number}}
 */
function sugerirUmbralesStock(avgDailySales, leadTime) {
  let stockSeguridad = Math.ceil(avgDailySales * 2);
  let stockMinimo = Math.ceil((avgDailySales * leadTime) + stockSeguridad);

  if (stockMinimo < 5) stockMinimo = 5;
  if (stockSeguridad < 2) stockSeguridad = 2;

  return { stockSeguridad, stockMinimo };
}

module.exports = { sugerirUmbralesStock };
