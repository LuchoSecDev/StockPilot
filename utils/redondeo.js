/**
 * @file redondeo.js
 * @description `techoSeguro`: reemplazo de `Math.ceil` para cálculos de cantidades (stock,
 * reposición, ajustes de IA) donde el valor de entrada viene de una división. JS representa esas
 * fracciones en binario con un error mínimo (p. ej. `2.2 * 25` da `55.00000000000001`, no `55`
 * exacto), y `Math.ceil` no tiene tolerancia para eso: sube al entero siguiente aunque el
 * resultado real sea un entero exacto. Redondear a 6 decimales antes de `Math.ceil` absorbe ese
 * ruido sin esconder ninguna fracción genuina — 6 decimales da margen de sobra para cualquier
 * cantidad real de este dominio (unidades de producto, días, pesos).
 *
 * @module utils/redondeo
 */

/**
 * @param {number} x
 * @returns {number} Equivalente a `Math.ceil(x)`, sin el salto de +1 causado por ruido de punto
 *   flotante cuando `x` debería ser un entero exacto.
 */
function techoSeguro(x) {
  return Math.ceil(Number(x.toFixed(6)));
}

module.exports = { techoSeguro };
