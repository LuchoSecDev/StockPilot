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
/**
 * Corrige el descuento de una promoción sugerida por la IA: un "2x1" sin porcentaje explícito
 * implica 50% de ahorro real (el cliente paga 1 de 2 unidades), aunque la IA no lo haya puesto.
 *
 * @param {string} type - Tipo de promoción ('2x1', 'descuento', 'combo', 'liquidacion').
 * @param {number} discount - Porcentaje de descuento sugerido por la IA (puede venir en 0 o vacío).
 * @returns {number} effectiveDiscount
 */
function normalizarDescuento(type, discount) {
  let effectiveDiscount = discount || 0;
  if (type === '2x1' && effectiveDiscount === 0) {
    effectiveDiscount = 50;
  }
  return effectiveDiscount;
}

function calcularImpactoPromocion(precio, stock, descuentoPct) {
  const discountedPrice = Math.round(precio * (1 - descuentoPct / 100));
  const capitalLiberado = Math.round(stock * discountedPrice);
  return { discountedPrice, capitalLiberado };
}

/**
 * Reglas deterministas para un candidato que la IA no cubrió: liquidación si vence pronto,
 * descuento moderado si vence en menos de 30 días, combo si hay sobrestock, o descuento
 * genérico por baja rotación.
 *
 * @param {number|null} diasParaVencer - Días hasta el vencimiento, o null si el producto no vence.
 * @param {number} stock
 * @returns {{type: string, discount: number, reason: string, duration_days: number}}
 */
function determinarPromocionFallback(diasParaVencer, stock) {
  let type, discount, reason, duration_days;

  if (diasParaVencer !== null && diasParaVencer <= 10) {
    type = 'liquidacion'; discount = 25; duration_days = Math.max(3, Math.floor(diasParaVencer));
    reason = `Vence en ${Math.round(diasParaVencer)} días y al ritmo actual no se agotará. Una liquidación urgente permite recuperar capital antes de la pérdida total del inventario.`;
  } else if (diasParaVencer !== null && diasParaVencer <= 30) {
    type = 'descuento'; discount = 15; duration_days = 7;
    reason = `Con vencimiento próximo en ${Math.round(diasParaVencer)} días, un descuento moderado acelera la rotación y evita pérdidas por producto no vendido a tiempo.`;
  } else if (stock > 50) {
    type = 'combo'; discount = 10; duration_days = 14;
    reason = `El alto nivel de stock genera capital inmovilizado. Un combo estratégico incentiva la compra conjunta y mejora la rotación sin sacrificar demasiado margen.`;
  } else {
    type = 'descuento'; discount = 15; duration_days = 10;
    reason = `La baja rotación reciente de este producto sugiere que un descuento puntual puede reactivar la demanda y liberar espacio en estantería para productos de mayor salida.`;
  }

  return { type, discount, reason, duration_days };
}

module.exports = { normalizarDescuento, calcularImpactoPromocion, determinarPromocionFallback };
