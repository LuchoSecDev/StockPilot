/**
 * @file promociones.js
 * @description Reglas puras del motor de promociones de `aiController.js`.
 *
 * @module utils/promociones
 */

/**
 * Precio con descuento y capital estimado a liberar (stock × precio con descuento), redondeados
 * al peso más cercano igual que en el código original.
 *
 * @param {number} precio
 * @param {number} stock
 * @param {number} descuentoPct - Porcentaje de descuento (0-100).
 * @returns {{discountedPrice: number, capitalLiberado: number}}
 */
function calcularImpactoPromocion(precio, stock, descuentoPct) {
  const discountedPrice = Math.round(precio * (1 - descuentoPct / 100));
  const capitalLiberado = Math.round(stock * discountedPrice);
  return { discountedPrice, capitalLiberado };
}

module.exports = { calcularImpactoPromocion };
