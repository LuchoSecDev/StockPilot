/**
 * @file guardrailsIA.js
 * @description Guardrail de ajuste de IA para carritos inteligentes: recorta el porcentaje que
 * sugiere la IA a un rango seguro según la clasificación ABC del producto/ítem (A: hasta +100%,
 * B: hasta +50%, C: hasta +20%; piso de -50% para cualquier clase), y aplica ese ajuste a una
 * cantidad o carga base.
 *
 * Extraído de `aiController.js` (ajuste de recomendaciones) y `suppliersController.js` (carrito
 * inteligente de proveedor), donde el mismo cálculo vivía duplicado con nombres de variable
 * distintos. Sin cambio de comportamiento respecto al código original en ninguno de los dos.
 *
 * @module utils/guardrailsIA
 */

/**
 * @param {number} baseLoad - Cantidad o carga base antes del ajuste de IA.
 * @param {number} adjNum - Porcentaje de ajuste sugerido por la IA (puede ser negativo).
 * @param {string} claseABC - Clasificación ABC del producto/ítem ('A', 'B' o cualquier otro valor = C).
 * @returns {{clampedAdj: number, finalTotal: number}}
 */
function aplicarAjusteIA(baseLoad, adjNum, claseABC) {
  const limit = claseABC === 'A' ? 100 : (claseABC === 'B' ? 50 : 20);
  const clampedAdj = Math.min(Math.max(adjNum, -50), limit);
  const finalTotal = Math.ceil(baseLoad * (1 + clampedAdj / 100));
  return { clampedAdj, finalTotal };
}

module.exports = { aplicarAjusteIA };
