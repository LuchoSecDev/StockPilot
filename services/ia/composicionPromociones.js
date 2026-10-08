/**
 * @file composicionPromociones.js
 * @description Arma la lista final de promociones: toma lo que propuso la IA (corrigiendo el
 * descuento efectivo y calculando el impacto financiero) y COMPLETA con el motor de reglas
 * determinista los productos que la IA omitió. Si OpenAI no respondió, `promocionesIA` llega
 * vacío y el motor determinista cubre el 100% (así el endpoint no depende de la IA).
 * Es pura: no toca BD ni red.
 *
 * @module services/ia/composicionPromociones
 */
const { normalizarDescuento, calcularImpactoPromocion, determinarPromocionFallback } = require('../../utils/promociones');
const { diasParaVencer } = require('./candidatosPromocion');

/**
 * @param {Array<Object>} candidatos - Salida de `elegirCandidatos`.
 * @param {Array<Object>} promocionesIA - `promotions` de la respuesta del modelo (puede estar vacío).
 * @param {Date} [ahora]
 * @returns {Array<Object>} Una promoción por cada candidato que la IA o las reglas lograron cubrir.
 */
function componerPromociones(candidatos, promocionesIA, ahora = new Date()) {
  const promociones = promocionesIA.map(p => {
    const producto = candidatos.find(c => c.id === p.id);
    if (!producto) return null;

    // 2x1 siempre es 50% de ahorro real.
    const descuento = normalizarDescuento(p.type, p.discount);
    const { discountedPrice, capitalLiberado } = calcularImpactoPromocion(producto.precio, producto.stock, descuento);

    return {
      ...p,
      id: producto.id, // id explícito de la base de datos
      discount: descuento,
      productName: producto.nombre,
      originalPrice: producto.precio,
      discountedPrice,
      impact: capitalLiberado,
      isCritical: producto.fecha_vencimiento && diasParaVencer(producto.fecha_vencimiento, ahora) < 10
    };
  }).filter(p => p !== null);

  const cubiertos = new Set(promociones.map(p => p.id));
  for (const producto of candidatos) {
    if (cubiertos.has(producto.id)) continue;

    const dias = diasParaVencer(producto.fecha_vencimiento, ahora);
    const { type, discount, reason, duration_days } = determinarPromocionFallback(dias, producto.stock);
    const { discountedPrice, capitalLiberado } = calcularImpactoPromocion(producto.precio, producto.stock, discount);

    promociones.push({
      id: producto.id,
      type,
      title: producto.nombre,
      reason,
      duration_days,
      complementary_name: null,
      discount,
      productName: producto.nombre,
      originalPrice: producto.precio,
      discountedPrice,
      impact: capitalLiberado,
      isCritical: dias !== null && dias <= 10
    });
  }

  return promociones;
}

module.exports = { componerPromociones };
